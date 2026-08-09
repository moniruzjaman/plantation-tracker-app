/**
 * Client-side auth bootstrap helper.
 *
 * Flow:
 *   1. On first install, app calls `fetchBootstrapList()` to get the allow-list
 *      from `/api/auth/bootstrap`.
 *   2. If a remembered email (localStorage 'bootstrap_email') matches an
 *      allow-list entry → auto-create a UserProfile with the allow-list's
 *      role/name/mobile/designation pre-populated. No manual form fill needed.
 *   3. If no email remembered or no match → user must enter email + name +
 *      mobile manually. Name + mobile are MANDATORY for non-allow-list users.
 *   4. The first allow-list admin email becomes the "built-in email" that
 *      lets the user explore the app immediately on first install.
 */

export type ServerRole = 'admin' | 'cadre' | 'officer' | 'citizen';

export interface AllowListUser {
  email: string;
  role: ServerRole;
  name: string;
  mobile: string;
  designation: string;
  district: string;
  upazila: string;
  blockId: string;
}

export interface BootstrapResponse {
  status: string;
  count: number;
  mandatoryFields: string[];
  tokenBoostFields: string[];
  users: AllowListUser[];
}

export interface ServerUserProfile {
  id: string;
  email: string;
  name: string;
  mobile: string;
  role: ServerRole;
  nid: string | null;
  jobId: string | null;
  designation: string | null;
  district: string | null;
  upazila: string | null;
  blockId: string | null;
  photoUrl: string | null;
  xp: number;
  greenTokens: number;
  streakCount: number;
  profileCompletionBonus: boolean;
  bootstrapSource: string | null;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileUpsertResponse {
  status: string;
  profile: ServerUserProfile;
  bonusAwarded: boolean;
  bonusTokens: number;
  fromAllowList: boolean;
}

export interface SeedSyncStatus {
  status: string;
  lastSync: {
    id: string;
    syncedAt: string;
    recordCount: number;
    sourceFileName: string;
    sourceFileHash: string;
    syncedByEmail: string | null;
    notes: string | null;
  } | null;
  seedSubmissionsInDb: number;
  workbookPath: string;
  workbookExists: boolean;
}

export interface SeedSyncResponse {
  status: string;
  syncId: string;
  upsertedCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: string[];
  sourceFileHash: string;
  syncedAt: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || '';
const BOOTSTRAP_EMAIL_KEY = 'bootstrap_email';
const BOOTSTRAP_FETCHED_KEY = 'bootstrap_list_fetched_at';

/** Fetches the public allow-list from the server. Cached in localStorage for 1 hour. */
export async function fetchBootstrapList(forceRefresh = false): Promise<BootstrapResponse> {
  const cachedAt = parseInt(localStorage.getItem(BOOTSTRAP_FETCHED_KEY) || '0', 10);
  const oneHourMs = 60 * 60 * 1000;
  if (!forceRefresh && Date.now() - cachedAt < oneHourMs) {
    // Re-fetch only if cache is stale
  }
  const resp = await fetch(`${API_BASE}/api/auth/bootstrap`);
  if (!resp.ok) throw new Error(`Bootstrap fetch failed: HTTP ${resp.status}`);
  const data = (await resp.json()) as BootstrapResponse;
  localStorage.setItem(BOOTSTRAP_FETCHED_KEY, Date.now().toString());
  return data;
}

/** Look up an email in a bootstrap list (case-insensitive). */
export function findAllowListEntry(
  list: BootstrapResponse,
  email: string,
): AllowListUser | null {
  if (!email) return null;
  const lower = email.toLowerCase().trim();
  return list.users.find((u) => u.email.toLowerCase().trim() === lower) || null;
}

/** Returns the "built-in" admin email — the first allow-list entry with role=admin. */
export function getBuiltInAdminEmail(list: BootstrapResponse): string | null {
  return list.users.find((u) => u.role === 'admin')?.email || null;
}

/** Returns the remembered bootstrap email from localStorage (if any). */
export function getRememberedEmail(): string | null {
  return localStorage.getItem(BOOTSTRAP_EMAIL_KEY);
}

/** Saves the bootstrap email to localStorage so it persists across sessions. */
export function rememberEmail(email: string): void {
  localStorage.setItem(BOOTSTRAP_EMAIL_KEY, email.toLowerCase().trim());
}

/** Upserts a user profile on the server. Returns the profile + bonus info. */
export async function upsertProfile(payload: {
  email: string;
  name?: string;
  mobile?: string;
  nid?: string;
  jobId?: string;
  designation?: string;
  district?: string;
  upazila?: string;
  blockId?: string;
  photoUrl?: string;
  xp?: number;
  greenTokens?: number;
  streakCount?: number;
}): Promise<ProfileUpsertResponse> {
  const resp = await fetch(`${API_BASE}/api/auth/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `Profile upsert failed: HTTP ${resp.status}`);
  }
  return (await resp.json()) as ProfileUpsertResponse;
}

/** Fetches the server-side profile for an email (or null if not yet created). */
export async function fetchServerProfile(email: string): Promise<{
  profile: ServerUserProfile | null;
  fromAllowList: boolean;
  allowListEntry: AllowListUser | null;
}> {
  const resp = await fetch(`${API_BASE}/api/auth/me?email=${encodeURIComponent(email)}`);
  if (!resp.ok) throw new Error(`Profile fetch failed: HTTP ${resp.status}`);
  return (await resp.json());
}

/** Fetches seed sync status (last sync time + count of seed submissions in DB). */
export async function fetchSeedSyncStatus(): Promise<SeedSyncStatus> {
  const resp = await fetch(`${API_BASE}/api/seed/sync-status`);
  if (!resp.ok) throw new Error(`Sync status fetch failed: HTTP ${resp.status}`);
  return (await resp.json()) as SeedSyncStatus;
}

/** Triggers an admin-only bulk upsert of seed plantation records into the DB. */
export async function syncSeedRecords(
  records: any[],
  syncedByEmail: string,
): Promise<SeedSyncResponse> {
  const resp = await fetch(`${API_BASE}/api/seed/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records, syncedByEmail }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || `Seed sync failed: HTTP ${resp.status}`);
  }
  return (await resp.json()) as SeedSyncResponse;
}
