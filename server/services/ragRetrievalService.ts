import { Types } from 'mongoose';
import {
  KnowledgeChunk,
  type KnowledgeSourceType,
} from '../models/KnowledgeChunk.ts';
import { generateEmbedding, isGeminiConfigured } from '../utils/geminiClient.ts';

export interface RetrievalFilter {
  propertyId?: string;
  sourceType?: KnowledgeSourceType;
  category?: string;
  roomId?: string;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  title: string;
  sourceType: KnowledgeSourceType;
  sourceSection: string;
  category?: string;
  score: number;
  updatedAt: Date;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function computeLexicalScore(query: string, text: string): number {
  const stopWords = new Set([
    'the',
    'is',
    'are',
    'a',
    'an',
    'in',
    'on',
    'at',
    'for',
    'to',
    'of',
    'and',
    'or',
    'what',
    'how',
    'much',
    'can',
    'do',
    'you',
    'me',
    'tell',
    'about',
    'there',
    'any',
    'with',
  ]);

  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !stopWords.has(t));

  if (tokens.length === 0) return 0;

  const haystack = text.toLowerCase();
  let matches = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      matches++;
    }
  }
  return matches / tokens.length;
}

function buildMongoFilter(filter?: RetrievalFilter): Record<string, unknown> {
  const mongoFilter: Record<string, unknown> = {};
  if (!filter) return mongoFilter;

  if (filter.propertyId && Types.ObjectId.isValid(filter.propertyId)) {
    mongoFilter['metadata.propertyId'] = new Types.ObjectId(filter.propertyId);
  }
  if (filter.sourceType) {
    mongoFilter['metadata.sourceType'] = filter.sourceType;
  }
  if (filter.category) {
    mongoFilter['metadata.category'] = filter.category;
  }
  if (filter.roomId && Types.ObjectId.isValid(filter.roomId)) {
    mongoFilter['metadata.roomId'] = new Types.ObjectId(filter.roomId);
  }
  return mongoFilter;
}

export async function retrieveRelevantChunks(params: {
  query: string;
  topK?: number;
  filter?: RetrievalFilter;
}): Promise<{
  chunks: RetrievedChunk[];
  searchMode: 'atlas_vector_search' | 'hybrid_cosine_fallback';
}> {
  const topK = params.topK ?? 5;
  const mongoFilter = buildMongoFilter(params.filter);

  let queryVector: number[] = [];
  if (isGeminiConfigured()) {
    try {
      queryVector = await generateEmbedding(params.query);
    } catch (err) {
      console.warn('[RAGRetrieval] Query embedding failed, falling back to lexical search:', err);
    }
  }

  const hasValidQueryVector =
    queryVector.length > 0 && queryVector.some((val) => val !== 0);

  // 1. Try MongoDB Atlas Vector Search ($vectorSearch) first
  if (hasValidQueryVector) {
    try {
      const atlasResults = await KnowledgeChunk.aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector,
            numCandidates: Math.max(topK * 10, 40),
            limit: topK + 3,
            ...(Object.keys(mongoFilter).length > 0 ? { filter: mongoFilter } : {}),
          },
        },
        {
          $project: {
            content: 1,
            metadata: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ]);

      if (atlasResults.length > 0) {
        const ranked: RetrievedChunk[] = atlasResults
          .map((doc) => {
            const lexical = computeLexicalScore(
              params.query,
              `${doc.metadata.title} ${doc.metadata.sourceSection} ${doc.content}`
            );
            const hybridScore = Number(doc.score ?? 0) * 0.8 + lexical * 0.2;
            return {
              id: doc._id.toString(),
              content: doc.content as string,
              title: doc.metadata.title as string,
              sourceType: doc.metadata.sourceType as KnowledgeSourceType,
              sourceSection: doc.metadata.sourceSection as string,
              category: doc.metadata.category as string | undefined,
              score: Number(hybridScore.toFixed(4)),
              updatedAt: new Date(doc.metadata.updatedAt),
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);

        return {
          chunks: ranked,
          searchMode: 'atlas_vector_search',
        };
      }
    } catch (err) {
      // Expected if Atlas vector_index hasn't been created yet or running on local MongoDB
      console.info(
        '[RAGRetrieval] Atlas $vectorSearch unavailable, using in-process cosine + lexical fallback.',
        err instanceof Error ? err.message : ''
      );
    }
  }

  // 2. Resilient Hybrid Cosine + Lexical Fallback
  const candidates = await KnowledgeChunk.find(mongoFilter).lean();
  const scored: RetrievedChunk[] = candidates.map((doc) => {
    const vectorScore =
      hasValidQueryVector &&
      Array.isArray(doc.embedding) &&
      doc.embedding.some((v) => v !== 0)
        ? Math.max(0, cosineSimilarity(queryVector, doc.embedding))
        : 0;

    const lexical = computeLexicalScore(
      params.query,
      `${doc.metadata.title} ${doc.metadata.sourceSection} ${doc.content}`
    );

    const combinedScore = hasValidQueryVector
      ? vectorScore * 0.72 + lexical * 0.28
      : lexical;

    return {
      id: doc._id.toString(),
      content: doc.content,
      title: doc.metadata.title,
      sourceType: doc.metadata.sourceType,
      sourceSection: doc.metadata.sourceSection,
      category: doc.metadata.category,
      score: Number(combinedScore.toFixed(4)),
      updatedAt: new Date(doc.metadata.updatedAt),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    chunks: scored.slice(0, topK),
    searchMode: 'hybrid_cosine_fallback',
  };
}
