import { GoogleGenAI } from '@google/genai';

export const EMBEDDING_MODEL = 'gemini-embedding-2';
export const CHAT_MODEL = 'gemini-4-hydrogen';
export const EMBEDDING_DIMENSIONS = 768;

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const ai = getGeminiClient();
  if (!ai) {
    return Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return Array(EMBEDDING_DIMENSIONS).fill(0);
  }

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: trimmed,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error('Failed to generate embedding vector from Gemini API');
  }

  return values;
}
