/**
 * Shared helpers + types for the api/ routes.
 */

import crypto from 'crypto';
import fs from 'fs';

/** Compute SHA-256 hash of a file (used for SeedSync.sourceFileHash). */
export function sha256File(filePath: string): string {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return '';
  }
}

/** Count total seedlings across all seedling arrays (legacy v1 format support). */
export function countV1Seedlings(draft: any): number {
  let sum = 0;
  const countVariety = (list: any) => {
    if (Array.isArray(list)) {
      list.forEach((item: any) => {
        sum += (parseInt(item.count) || 0) + (parseInt(item.graftingCount) || 0);
      });
    }
  };
  countVariety(draft.fruitSeedlings);
  countVariety(draft.forestSeedlings);
  countVariety(draft.medicinalSeedlings);
  return sum;
}

/** Count seedlings from v2 PlantationSubmission.seedlings array. */
export function countV2Seedlings(draft: any): number {
  if (Array.isArray(draft.seedlings)) {
    return draft.seedlings.reduce((sum: number, s: any) => sum + (parseInt(s.count) || 0), 0);
  }
  return countV1Seedlings(draft);
}

/** Standard JSON error response. */
export function sendError(res: any, status: number, message: string, extra?: any) {
  return res.status(status).json({ error: message, ...extra });
}

/** Standard JSON success response. */
export function sendSuccess(res: any, data: any, extra?: any) {
  return res.status(200).json({ status: 'success', ...data, ...extra });
}

/** Set common CORS + JSON headers on a Vercel response. */
export function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Email');
}

/** Parse a JSON body from a Vercel request, handling both pre-parsed and raw. */
export async function parseBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  // Vercel sometimes gives us a stream we need to await
  if (req.read && typeof req.read === 'function') {
    try {
      const raw = await new Promise<string>((resolve, reject) => {
        let data = '';
        req.on('data', (chunk: any) => (data += chunk));
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Extract email from query or X-User-Email header, lowercased + trimmed. */
export function getRequesterEmail(req: any): string {
  const raw =
    (req.query?.requester as string) ||
    (req.headers?.['x-user-email'] as string) ||
    '';
  return raw.toString().toLowerCase().trim();
}
