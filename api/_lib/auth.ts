/**
 * Admin allow-list loader + helpers.
 *
 * Reads `seed/admins.json` from the repo. On Vercel, this file is bundled
 * into the serverless function's working directory at deploy time (it sits
 * at the repo root, alongside /api). On local dev (npm run dev via server.ts)
 * it's read from process.cwd()/seed.
 *
 * The list is loaded once per cold start and cached on globalThis so warm
 * invocations reuse the parsed array. To force a refresh, redeploy or
 * call POST /api/auth/bootstrap/refresh (TODO — not yet wired).
 */

import fs from 'fs';
import path from 'path';

export type AllowListRole = 'admin' | 'cadre' | 'officer' | 'citizen';

export interface AllowListEntry {
  email: string;
  role: AllowListRole;
  name?: string;
  mobile?: string;
  designation?: string;
  district?: string;
  upazila?: string;
  blockId?: string;
  notes?: string;
}

const globalForAllowList = globalThis as unknown as {
  __ALLOW_LIST?: AllowListEntry[];
  __ALLOW_LIST_LOADED_AT?: number;
};

function resolveAdminsPath(): string {
  // /api/_lib/auth.ts → repo root is 3 levels up (../.. → /api, ../.. → repo root)
  // But on Vercel, process.cwd() IS the repo root already. Try both.
  const candidates = [
    path.join(process.cwd(), 'seed', 'admins.json'),
    path.join(__dirname, '..', '..', '..', 'seed', 'admins.json'),
    path.join(__dirname, '..', '..', '..', '..', 'seed', 'admins.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0]; // return the first candidate for the error message
}

function loadAllowList(): AllowListEntry[] {
  try {
    const fp = resolveAdminsPath();
    if (!fs.existsSync(fp)) {
      console.warn('[Auth] seed/admins.json not found — bootstrap disabled');
      return [];
    }
    const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    const list = Array.isArray(raw?.users) ? raw.users : [];
    console.log(`[Auth] Loaded ${list.length} allow-list entries from ${fp}`);
    return list;
  } catch (err) {
    console.error('[Auth] Failed to load allow-list:', err);
    return [];
  }
}

export function getAllowList(): AllowListEntry[] {
  // Cache forever per cold start — admins.json is a deploy-time asset.
  if (!globalForAllowList.__ALLOW_LIST) {
    globalForAllowList.__ALLOW_LIST = loadAllowList();
  }
  return globalForAllowList.__ALLOW_LIST;
}

/** Look up an email in the allow-list (case-insensitive). */
export function findInAllowList(email: string): AllowListEntry | null {
  if (!email) return null;
  const lower = email.toLowerCase().trim();
  const list = getAllowList();
  return list.find((e) => e.email.toLowerCase().trim() === lower) || null;
}
