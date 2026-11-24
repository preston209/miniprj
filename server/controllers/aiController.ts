import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { KnowledgeChunk } from '../models/KnowledgeChunk.ts';
import { Property } from '../models/Property.ts';
import { streamRagConciergeChat } from '../services/ragChatService.ts';
import {
  deleteKnowledgeDocument,
  getKnowledgeDocumentContent,
  ingestDocument,
  ingestUploadedFile,
  listKnowledgeDocuments,
  reindexPropertyKnowledge,
} from '../services/ragIngestionService.ts';

const sourceTypeEnum = z.enum([
  'house_rules',
  'policy',
  'neighborhood_guide',
  'room_inventory',
  'weekly_menu',
  'faq',
  'uploaded_doc',
]);

const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        text: z.string().max(6000),
      })
    )
    .max(20)
    .optional(),
  filter: z
    .object({
      propertyId: z
        .string()
        .refine((v) => Types.ObjectId.isValid(v), 'Invalid propertyId')
        .optional(),
      sourceType: sourceTypeEnum.optional(),
      category: z.string().trim().max(60).optional(),
      roomId: z
        .string()
        .refine((v) => Types.ObjectId.isValid(v), 'Invalid roomId')
        .optional(),
    })
    .optional(),
});

const ingestTextSchema = z.object({
  propertyId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), 'Invalid propertyId')
    .optional(),
  sourceType: sourceTypeEnum.default('faq'),
  sourceSection: z.string().trim().min(2).max(160),
  title: z.string().trim().min(2).max(160),
  category: z.string().trim().max(60).optional(),
  content: z.string().trim().min(10).max(100000),
});

const uploadFieldsSchema = z.object({
  propertyId: z
    .string()
    .refine((v) => Types.ObjectId.isValid(v), 'Invalid propertyId')
    .optional(),
  sourceType: sourceTypeEnum.default('uploaded_doc'),
  sourceSection: z.string().trim().max(160).optional(),
  title: z.string().trim().max(160).optional(),
  category: z.string().trim().max(60).optional(),
});

const deleteDocSchema = z.object({
  propertyId: z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid propertyId'),
  sourceType: sourceTypeEnum,
  sourceSection: z.string().trim().min(1).max(200),
});

function writeSseEvent(res: Response, event: string, data: unknown): void {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function chatStream(req: Request, res: Response): Promise<void> {
  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid chat message payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let clientClosed = false;
  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
    }
  });

  try {
    const result = await streamRagConciergeChat({
      message: parsed.data.message,
      history: parsed.data.history,
      filter: parsed.data.filter,
      callbacks: {
        onSources: (payload) => {
          if (!clientClosed) writeSseEvent(res, 'sources', payload);
        },
        onToolCall: (payload) => {
          if (!clientClosed) writeSseEvent(res, 'tool_call', payload);
        },
        onUiAction: (payload) => {
          if (!clientClosed) writeSseEvent(res, 'ui_action', payload);
        },
        onDelta: (text) => {
          if (!clientClosed) writeSseEvent(res, 'delta', { text });
        },
      },
    });

    if (!clientClosed) {
      writeSseEvent(res, 'done', {
        fullText: result.fullText,
        citations: result.citations.map((c) => ({
          title: c.title,
          sourceSection: c.sourceSection,
          sourceType: c.sourceType,
          score: c.score,
        })),
      });
      res.end();
    }
  } catch (err) {
    console.error('[AI Chat SSE Error]', err);
    const rawMsg =
      err instanceof Error
        ? err.message
        : 'Unable to complete AI Concierge response right now.';
    let friendly = rawMsg;
    if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE')) {
      friendly =
        'The AI model is temporarily busy (high demand). Please retry your question in a few seconds.';
    } else if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      friendly =
        'AI request quota temporarily reached. Please wait a moment and try again.';
    } else if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED')) {
      friendly =
        'Gemini API key configuration issue. Please verify GEMINI_API_KEY in Settings > Secrets.';
    }
    if (!clientClosed) {
      writeSseEvent(res, 'error', { error: friendly });
      res.end();
    }
  }
}

export async function getKnowledgeBase(req: Request, res: Response): Promise<void> {
  const propertyId =
    typeof req.query.propertyId === 'string' && Types.ObjectId.isValid(req.query.propertyId)
      ? req.query.propertyId
      : undefined;

  const documents = await listKnowledgeDocuments(propertyId);
  const totalChunks = await KnowledgeChunk.countDocuments(
    propertyId ? { 'metadata.propertyId': new Types.ObjectId(propertyId) } : {}
  );

  res.json({
    documents,
    totalChunks,
  });
}

export async function getKnowledgeDocContent(req: Request, res: Response): Promise<void> {
  const sourceTypeParsed = sourceTypeEnum.safeParse(req.query.sourceType);
  const sourceSection =
    typeof req.query.sourceSection === 'string' ? req.query.sourceSection.trim() : '';

  if (!sourceTypeParsed.success || !sourceSection) {
    res.status(400).json({ error: 'Valid sourceType and sourceSection query params are required.' });
    return;
  }

  let propertyId =
    typeof req.query.propertyId === 'string' && Types.ObjectId.isValid(req.query.propertyId)
      ? req.query.propertyId
      : undefined;

  if (!propertyId) {
    const primary = await Property.findOne({ isActive: true }).select('_id').lean();
    if (!primary) {
      res.status(404).json({ error: 'No active property found.' });
      return;
    }
    propertyId = primary._id.toString();
  }

  const document = await getKnowledgeDocumentContent({
    propertyId,
    sourceType: sourceTypeParsed.data,
    sourceSection,
  });

  if (!document) {
    res.status(404).json({ error: 'Knowledge document not found.' });
    return;
  }

  res.json({ document });
}

export async function ingestTextKnowledge(req: Request, res: Response): Promise<void> {
  const parsed = ingestTextSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid knowledge document payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  let resolvedPropertyId = parsed.data.propertyId;
  if (!resolvedPropertyId) {
    const primary = await Property.findOne({ isActive: true }).select('_id').lean();
    if (!primary) {
      res.status(404).json({ error: 'No active PG property found.' });
      return;
    }
    resolvedPropertyId = primary._id.toString();
  }

  const result = await ingestDocument({
    propertyId: resolvedPropertyId,
    sourceType: parsed.data.sourceType,
    sourceSection: parsed.data.sourceSection,
    title: parsed.data.title,
    category: parsed.data.category,
    content: parsed.data.content,
  });

  res.status(201).json({
    message: `Ingested "${result.title}" into ${result.chunksCreated} chunk(s).`,
    result,
  });
}

export async function uploadKnowledgeFile(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'Please attach a PDF, Markdown (.md), or TXT file.' });
    return;
  }

  const parsed = uploadFieldsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid document metadata fields.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  let resolvedPropertyId = parsed.data.propertyId;
  if (!resolvedPropertyId) {
    const primary = await Property.findOne({ isActive: true }).select('_id').lean();
    if (!primary) {
      res.status(404).json({ error: 'No active PG property found.' });
      return;
    }
    resolvedPropertyId = primary._id.toString();
  }

  try {
    const result = await ingestUploadedFile({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      propertyId: resolvedPropertyId,
      sourceType: parsed.data.sourceType,
      sourceSection: parsed.data.sourceSection,
      title: parsed.data.title,
      category: parsed.data.category,
    });

    res.status(201).json({
      message: `Uploaded & indexed "${result.title}" (${result.chunksCreated} chunks).`,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to parse and ingest file.';
    res.status(400).json({ error: message });
  }
}

export async function reindexKnowledge(req: Request, res: Response): Promise<void> {
  const propertyId =
    typeof req.body?.propertyId === 'string' && Types.ObjectId.isValid(req.body.propertyId)
      ? req.body.propertyId
      : undefined;

  const summary = await reindexPropertyKnowledge(propertyId);
  res.json({
    message: 'Knowledge base re-indexed and synchronized.',
    summary,
  });
}

export async function removeKnowledgeDocument(req: Request, res: Response): Promise<void> {
  const parsed = deleteDocSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid delete document request.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const deletedCount = await deleteKnowledgeDocument(parsed.data);
  res.json({
    message: `Removed ${deletedCount} knowledge chunk(s).`,
    deletedCount,
  });
}
