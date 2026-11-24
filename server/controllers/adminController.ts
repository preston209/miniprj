import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  clearSampleNonAdminData,
  importRealPgData,
  realPgImportSchema,
} from '../services/realImportService.ts';

const importRequestSchema = z.object({
  data: realPgImportSchema,
  markdownRules: z.string().max(100000).optional(),
  markdownTitle: z.string().trim().max(160).optional(),
  replaceExisting: z.boolean().default(true),
});

export async function resetSampleData(_req: Request, res: Response): Promise<void> {
  const deleted = await clearSampleNonAdminData();
  res.json({
    message:
      'Sample/non-admin PG records cleared cleanly. Admin user accounts were preserved.',
    deleted,
  });
}

export async function importRealDataHandler(req: Request, res: Response): Promise<void> {
  const parsed = importRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid PG import JSON payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const summary = await importRealPgData({
    data: parsed.data.data,
    markdownRules: parsed.data.markdownRules,
    markdownTitle: parsed.data.markdownTitle,
    replaceExisting: parsed.data.replaceExisting,
  });

  res.status(201).json({
    message: `Imported "${summary.propertyName}" with ${summary.roomsCreated} rooms, ${summary.bedsCreated} beds, and ${summary.knowledgeChunksCreated} RAG chunks.`,
    summary,
  });
}
