/**
 * Gemini AI singleton. Same caching pattern as prisma.ts — warm invocations
 * reuse the same GoogleGenAI instance instead of re-instantiating on every
 * request.
 */

import { GoogleGenAI } from '@google/genai';

const globalForAI = globalThis as unknown as {
  __AI?: GoogleGenAI | undefined;
};

export function getAI(): GoogleGenAI {
  if (!globalForAI.__AI) {
    globalForAI.__AI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });
  }
  return globalForAI.__AI;
}
