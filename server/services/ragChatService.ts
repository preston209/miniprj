import {
  ThinkingLevel,
  Type,
  type Content,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import { Types } from 'mongoose';
import { Bed } from '../models/Bed.ts';
import { Property } from '../models/Property.ts';
import { Room } from '../models/Room.ts';
import {
  CHAT_MODEL,
  getGeminiClient,
} from '../utils/geminiClient.ts';
import {
  retrieveRelevantChunks,
  type RetrievedChunk,
  type RetrievalFilter,
} from './ragRetrievalService.ts';

export interface ChatTurnMessage {
  role: 'user' | 'model';
  text: string;
}

export interface StreamConciergeCallbacks {
  onSources: (payload: {
    searchMode: string;
    citations: Array<{
      title: string;
      sourceSection: string;
      sourceType: string;
      score: number;
    }>;
  }) => void;
  onToolCall: (payload: { name: string; args: Record<string, unknown> }) => void;
  onUiAction: (payload: { type: 'OPEN_TOUR_MODAL'; payload: Record<string, unknown> }) => void;
  onDelta: (text: string) => void;
}

const checkLiveBedAvailabilityDecl: FunctionDeclaration = {
  name: 'checkLiveBedAvailability',
  description:
    'Check real-time room and bed availability, monthly rent, security deposit, and vacant bed codes from the live MongoDB inventory.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sharingType: {
        type: Type.STRING,
        description: 'Optional room sharing filter: single, double, or triple.',
      },
      isAC: {
        type: Type.BOOLEAN,
        description: 'Optional filter for air-conditioned rooms (true or false).',
      },
      genderPreference: {
        type: Type.STRING,
        description: 'Optional gender wing preference: male, female, or any.',
      },
      maxMonthlyRent: {
        type: Type.NUMBER,
        description: 'Optional maximum monthly rent budget in INR.',
      },
    },
  },
};

const openTourBookingModalDecl: FunctionDeclaration = {
  name: 'openTourBookingModal',
  description:
    'Trigger the 1-click Tour Scheduling modal in the frontend UI whenever a user asks to book, schedule, visit, or tour the PG.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      suggestedSharingType: {
        type: Type.STRING,
        description: 'Preferred sharing type if mentioned: single, double, or triple.',
      },
      suggestedTourMode: {
        type: Type.STRING,
        description: 'physical or virtual video tour.',
      },
      preferredRoomNumber: {
        type: Type.STRING,
        description: 'Optional room number the user asked about (e.g. 101, 202).',
      },
      reason: {
        type: Type.STRING,
        description: 'Short note summarizing what the user wants to tour.',
      },
    },
  },
};

async function executeCheckLiveBedAvailability(args: Record<string, unknown>) {
  const query: Record<string, unknown> = {
    isActive: true,
    vacantBedsCount: { $gt: 0 },
  };

  if (
    typeof args.sharingType === 'string' &&
    ['single', 'double', 'triple'].includes(args.sharingType.toLowerCase())
  ) {
    query.sharingType = args.sharingType.toLowerCase();
  }
  if (typeof args.isAC === 'boolean') {
    query.isAC = args.isAC;
  }
  if (
    typeof args.genderPreference === 'string' &&
    ['male', 'female', 'any'].includes(args.genderPreference.toLowerCase())
  ) {
    query.genderPreference = args.genderPreference.toLowerCase();
  }
  if (typeof args.maxMonthlyRent === 'number' && args.maxMonthlyRent > 0) {
    query.monthlyRent = { $lte: args.maxMonthlyRent };
  }

  const rooms = await Room.find(query)
    .sort({ monthlyRent: 1 })
    .lean();

  const results = [];
  for (const room of rooms) {
    const vacantBeds = await Bed.find({
      roomId: room._id,
      status: 'available',
    })
      .select('bedCode')
      .lean();

    results.push({
      roomNumber: room.roomNumber,
      floor: room.floor,
      sharingType: room.sharingType,
      isAC: room.isAC,
      genderPreference: room.genderPreference,
      monthlyRentINR: room.monthlyRent,
      securityDepositINR: room.securityDeposit,
      lockInMonths: room.lockInMonths,
      noticePeriodDays: room.noticePeriodDays,
      estimatedMonthlyElectricityINR: room.estimatedMonthlyElectricity,
      vacantBedsCount: room.vacantBedsCount,
      availableBedCodes: vacantBeds.map((b) => b.bedCode),
    });
  }

  return {
    totalMatchingRooms: results.length,
    rooms: results,
  };
}

function buildSystemInstruction(propertyName: string): string {
  return `You are "PG Concierge", the official AI assistant for ${propertyName}.

STRICT GROUNDING RULES:
1. Answer ONLY using facts explicitly stated in the retrieved <context> passages OR live tool outputs (checkLiveBedAvailability).
2. NEVER invent, estimate, or hallucinate prices, discounts, curfew exceptions, deposit terms, food menu items, or neighborhood distances not present in the context or tool output.
3. If the requested information is not found in the retrieved context or live tools, politely state that you do not have that verified detail in the property knowledge base and invite the user to schedule a tour or email concierge@havenstay.in.
4. Always cite the source section in brackets, e.g. [Source: Section 3: Security Deposit, Lock-In & Refund Policy] or [Source: Live Room Inventory].
5. Keep answers concise (2–4 sentences or up to 4 crisp bullet points) with INR ₹ formatting for prices.
6. If the user asks about live bed availability or prices with specific filters, call checkLiveBedAvailability. If the user expresses intent to visit, book a room, or schedule a tour, call openTourBookingModal.`;
}

function formatContextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return 'No matching knowledge base passages were retrieved.';
  }
  return chunks
    .map(
      (chunk, idx) =>
        `[${idx + 1}] Source Section: "${chunk.sourceSection}" | Title: "${chunk.title}" | Type: ${chunk.sourceType}\n${chunk.content}`
    )
    .join('\n\n---\n\n');
}

export async function streamRagConciergeChat(params: {
  message: string;
  history?: ChatTurnMessage[];
  filter?: RetrievalFilter;
  callbacks: StreamConciergeCallbacks;
}): Promise<{ fullText: string; citations: RetrievedChunk[] }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please add it in Settings > Secrets.'
    );
  }

  let propertyName = 'HavenStay Koramangala Executive PG';
  let resolvedPropertyId = params.filter?.propertyId;
  if (resolvedPropertyId && Types.ObjectId.isValid(resolvedPropertyId)) {
    const prop = await Property.findById(resolvedPropertyId).select('name').lean();
    if (prop) propertyName = prop.name;
  } else {
    const primary = await Property.findOne({ isActive: true }).select('_id name').lean();
    if (primary) {
      propertyName = primary.name;
      resolvedPropertyId = primary._id.toString();
    }
  }

  // 1. Vector Similarity Retrieval (topK = 5) with optional metadata filtering
  const { chunks, searchMode } = await retrieveRelevantChunks({
    query: params.message,
    topK: 5,
    filter: {
      ...params.filter,
      ...(resolvedPropertyId ? { propertyId: resolvedPropertyId } : {}),
    },
  });

  params.callbacks.onSources({
    searchMode,
    citations: chunks.map((c) => ({
      title: c.title,
      sourceSection: c.sourceSection,
      sourceType: c.sourceType,
      score: c.score,
    })),
  });

  const contextBlock = formatContextBlock(chunks);
  const augmentedUserMessage = `<context>\n${contextBlock}\n</context>\n\nUser Question: ${params.message}`;

  const contents: Content[] = [
    ...(params.history ?? []).slice(-8).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: 'user',
      parts: [{ text: augmentedUserMessage }],
    },
  ];

  const tools = [
    {
      functionDeclarations: [
        checkLiveBedAvailabilityDecl,
        openTourBookingModalDecl,
      ],
    },
  ];

  let fullText = '';

  const streamTurn = async (): Promise<{
    calls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>;
    modelParts: Part[];
  }> => {
    const startStream = () =>
      ai.models.generateContentStream({
        model: CHAT_MODEL,
        contents,
        config: {
          systemInstruction: buildSystemInstruction(propertyName),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          tools,
        },
      });

    let stream: AsyncGenerator<GenerateContentResponse>;
    try {
      stream = await startStream();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('503') || msg.includes('UNAVAILABLE')) {
        await new Promise((r) => setTimeout(r, 1500));
        stream = await startStream();
      } else {
        throw err;
      }
    }

    const detectedCalls: Array<{
      id?: string;
      name?: string;
      args?: Record<string, unknown>;
    }> = [];
    const modelParts: Part[] = [];

    for await (const rawChunk of stream) {
      const chunk = rawChunk as GenerateContentResponse;
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (parts && parts.length > 0) {
        modelParts.push(...parts);
      }
      if (chunk.text) {
        fullText += chunk.text;
        params.callbacks.onDelta(chunk.text);
      }
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        for (const call of chunk.functionCalls) {
          detectedCalls.push({
            id: call.id,
            name: call.name,
            args: (call.args ?? {}) as Record<string, unknown>,
          });
        }
      }
    }

    return { calls: detectedCalls, modelParts };
  };

  // Turn 1: Stream response or capture tool calls
  let turnResult = await streamTurn();

  // Handle up to 2 rounds of actionable tool calling
  let round = 0;
  while (turnResult.calls.length > 0 && round < 2) {
    round++;
    if (turnResult.modelParts.length > 0) {
      contents.push({ role: 'model', parts: turnResult.modelParts });
    }

    const responseParts: Part[] = [];

    for (const call of turnResult.calls) {
      const toolName = call.name ?? '';
      const toolArgs = call.args ?? {};
      params.callbacks.onToolCall({ name: toolName, args: toolArgs });

      let toolOutput: Record<string, unknown> = {};

      if (toolName === 'checkLiveBedAvailability') {
        toolOutput = await executeCheckLiveBedAvailability(toolArgs);
      } else if (toolName === 'openTourBookingModal') {
        params.callbacks.onUiAction({
          type: 'OPEN_TOUR_MODAL',
          payload: toolArgs,
        });
        toolOutput = {
          opened: true,
          message:
            'Tour booking modal opened in the user interface with pre-filled preferences.',
          ...toolArgs,
        };
      } else {
        toolOutput = { error: `Unknown tool: ${toolName}` };
      }

      responseParts.push({
        functionResponse: {
          id: call.id,
          name: toolName,
          response: toolOutput,
        },
      });
    }

    contents.push({ role: 'user', parts: responseParts });
    turnResult = await streamTurn();
  }

  return { fullText, citations: chunks };
}
