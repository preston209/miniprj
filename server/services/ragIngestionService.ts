import crypto from 'crypto';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Types } from 'mongoose';
import { extractText } from 'unpdf';
import {
  KnowledgeChunk,
  type KnowledgeSourceType,
} from '../models/KnowledgeChunk.ts';
import { Property } from '../models/Property.ts';
import { Room } from '../models/Room.ts';
import { generateEmbedding, isGeminiConfigured } from '../utils/geminiClient.ts';
import {
  syncPropertyMenuAndRulesToKnowledge,
  syncRoomToKnowledge,
} from './knowledgeSyncService.ts';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
  separators: ['\n\n', '\n', '. ', ', ', ' ', ''],
});

function computeHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export interface IngestDocumentInput {
  propertyId: string | Types.ObjectId;
  roomId?: string | Types.ObjectId | null;
  sourceType: KnowledgeSourceType;
  sourceSection: string;
  title: string;
  category?: string;
  content: string;
}

export interface IngestResult {
  chunksCreated: number;
  embeddedWithGemini: boolean;
  sourceSection: string;
  title: string;
}

export async function ingestDocument(
  input: IngestDocumentInput
): Promise<IngestResult> {
  const propertyObjectId =
    typeof input.propertyId === 'string'
      ? new Types.ObjectId(input.propertyId)
      : input.propertyId;

  const roomObjectId =
    input.roomId && typeof input.roomId === 'string'
      ? new Types.ObjectId(input.roomId)
      : input.roomId instanceof Types.ObjectId
      ? input.roomId
      : null;

  const cleanedContent = input.content.replace(/\0/g, '').trim();
  if (!cleanedContent) {
    throw new Error('Cannot ingest empty document content.');
  }

  const rawChunks = await splitter.splitText(cleanedContent);
  const chunks = rawChunks.map((c) => c.trim()).filter((c) => c.length > 0);

  if (chunks.length === 0) {
    throw new Error('Document produced zero text chunks after splitting.');
  }

  // Remove previous chunks for the same logical document section so updates are clean
  const deleteFilter: Record<string, unknown> = {
    'metadata.propertyId': propertyObjectId,
    'metadata.sourceType': input.sourceType,
    'metadata.sourceSection': input.sourceSection,
  };
  if (roomObjectId) {
    deleteFilter['metadata.roomId'] = roomObjectId;
  }
  await KnowledgeChunk.deleteMany(deleteFilter);

  const geminiReady = isGeminiConfigured();
  const docsToInsert = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];
    const embeddingInput = `${input.title} (${input.sourceSection})\n${chunkText}`;
    const embedding = await generateEmbedding(embeddingInput);
    const contentHash = computeHash(
      `${input.sourceType}:${input.sourceSection}:${i}:${chunkText}`
    );

    docsToInsert.push({
      content: chunkText,
      embedding,
      contentHash,
      chunkIndex: i,
      metadata: {
        sourceType: input.sourceType,
        sourceSection: input.sourceSection,
        title: input.title,
        propertyId: propertyObjectId,
        roomId: roomObjectId,
        category: input.category ?? input.sourceType,
        updatedAt: new Date(),
      },
    });
  }

  await KnowledgeChunk.insertMany(docsToInsert);

  return {
    chunksCreated: docsToInsert.length,
    embeddedWithGemini: geminiReady,
    sourceSection: input.sourceSection,
    title: input.title,
  };
}

export async function ingestUploadedFile(params: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  propertyId: string;
  sourceType: KnowledgeSourceType;
  sourceSection?: string;
  title?: string;
  category?: string;
}): Promise<IngestResult> {
  const lowerName = params.originalname.toLowerCase();
  const isPdf = params.mimetype === 'application/pdf' || lowerName.endsWith('.pdf');
  const isTextOrMd =
    params.mimetype === 'text/plain' ||
    params.mimetype === 'text/markdown' ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.txt');

  if (!isPdf && !isTextOrMd) {
    throw new Error('Unsupported file format. Only PDF, Markdown (.md), and TXT files are allowed.');
  }

  let extractedText = '';
  if (isPdf) {
    const pdfResult = await extractText(new Uint8Array(params.buffer), {
      mergePages: true,
    });
    extractedText = Array.isArray(pdfResult.text)
      ? pdfResult.text.join('\n\n')
      : String(pdfResult.text ?? '');
  } else {
    extractedText = params.buffer.toString('utf8');
  }

  const normalized = extractedText.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    throw new Error('No readable text could be extracted from the uploaded file.');
  }
  if (normalized.length > 200000) {
    throw new Error('Extracted document exceeds maximum 200,000 character limit.');
  }

  const baseName = params.originalname.replace(/\.[^/.]+$/, '');
  const resolvedTitle = params.title?.trim() || baseName;
  const resolvedSection =
    params.sourceSection?.trim() || `Uploaded Document: ${params.originalname}`;

  return ingestDocument({
    propertyId: params.propertyId,
    sourceType: params.sourceType,
    sourceSection: resolvedSection,
    title: resolvedTitle,
    category: params.category ?? 'uploaded_doc',
    content: normalized,
  });
}

export async function reindexPropertyKnowledge(propertyId?: string): Promise<{
  roomsSynced: number;
  chunksReembedded: number;
}> {
  const property = propertyId
    ? await Property.findById(propertyId)
    : await Property.findOne({ isActive: true });

  if (!property) {
    throw new Error('Property not found for reindexing.');
  }

  await syncPropertyMenuAndRulesToKnowledge(property, { forceReembed: true });

  const rooms = await Room.find({ propertyId: property._id, isActive: true });
  for (const room of rooms) {
    await syncRoomToKnowledge(room, { forceReembed: true });
  }

  // Re-embed any seeded or custom chunks that still hold zero vectors
  let chunksReembedded = 0;
  if (isGeminiConfigured()) {
    const allChunks = await KnowledgeChunk.find({
      'metadata.propertyId': property._id,
    });

    for (const chunk of allChunks) {
      const isZeroVector =
        !Array.isArray(chunk.embedding) ||
        chunk.embedding.length === 0 ||
        chunk.embedding.every((val) => val === 0);

      if (isZeroVector) {
        chunk.embedding = await generateEmbedding(
          `${chunk.metadata.title} (${chunk.metadata.sourceSection})\n${chunk.content}`
        );
        chunk.metadata.updatedAt = new Date();
        await chunk.save();
        chunksReembedded++;
      }
    }
  }

  return {
    roomsSynced: rooms.length,
    chunksReembedded,
  };
}

export async function getKnowledgeDocumentContent(params: {
  propertyId: string;
  sourceType: KnowledgeSourceType;
  sourceSection: string;
}): Promise<{
  title: string;
  sourceType: KnowledgeSourceType;
  sourceSection: string;
  category?: string;
  content: string;
  chunkCount: number;
} | null> {
  const chunks = await KnowledgeChunk.find({
    'metadata.propertyId': new Types.ObjectId(params.propertyId),
    'metadata.sourceType': params.sourceType,
    'metadata.sourceSection': params.sourceSection,
  })
    .sort({ chunkIndex: 1 })
    .lean();

  if (chunks.length === 0) return null;

  return {
    title: chunks[0].metadata.title,
    sourceType: chunks[0].metadata.sourceType,
    sourceSection: chunks[0].metadata.sourceSection,
    category: chunks[0].metadata.category,
    content: chunks.map((c) => c.content).join('\n\n'),
    chunkCount: chunks.length,
  };
}

export async function listKnowledgeDocuments(propertyId?: string) {
  const matchStage: Record<string, unknown> = {};
  if (propertyId && Types.ObjectId.isValid(propertyId)) {
    matchStage['metadata.propertyId'] = new Types.ObjectId(propertyId);
  }

  const docs = await KnowledgeChunk.aggregate([
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
    {
      $sort: { chunkIndex: 1 },
    },
    {
      $group: {
        _id: {
          propertyId: '$metadata.propertyId',
          sourceType: '$metadata.sourceType',
          sourceSection: '$metadata.sourceSection',
        },
        title: { $first: '$metadata.title' },
        category: { $first: '$metadata.category' },
        chunkCount: { $sum: 1 },
        updatedAt: { $max: '$metadata.updatedAt' },
        preview: { $first: '$content' },
        hasEmbeddings: {
          $max: {
            $cond: [
              { $gt: [{ $abs: { $arrayElemAt: ['$embedding', 0] } }, 0] },
              true,
              false,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        propertyId: '$_id.propertyId',
        sourceType: '$_id.sourceType',
        sourceSection: '$_id.sourceSection',
        title: 1,
        category: 1,
        chunkCount: 1,
        updatedAt: 1,
        preview: 1,
        hasEmbeddings: 1,
      },
    },
    {
      $sort: { sourceType: 1, updatedAt: -1 },
    },
  ]);

  return docs;
}

export async function deleteKnowledgeDocument(params: {
  propertyId: string;
  sourceType: KnowledgeSourceType;
  sourceSection: string;
}): Promise<number> {
  const result = await KnowledgeChunk.deleteMany({
    'metadata.propertyId': new Types.ObjectId(params.propertyId),
    'metadata.sourceType': params.sourceType,
    'metadata.sourceSection': params.sourceSection,
  });

  return result.deletedCount ?? 0;
}
