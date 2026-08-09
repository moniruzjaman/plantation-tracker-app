/**
 * Server API client — thin wrapper around fetch for the Prisma-backed
 * REST endpoints. All calls are optional (offline-first): if the server
 * is unreachable, they return null/empty rather than throwing.
 */

import type { PlantationSubmission } from '../types/plantation';

// ─── Types matching the Prisma REST response shapes ──────────────────────

export interface SubmissionRow {
  id: string;
  clientUid: string;
  entryMode: string;
  region: string;
  district: string;
  upazila: string;
  union: string;
  blockName: string | null;
  village: string;
  plantationDate: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  caretakerName: string;
  caretakerMobile: string;
  saaoName: string;
  saaoMobile: string;
  monitoringOfficerName: string;
  monitoringOfficerMobile: string;
  remarks: string | null;
  areaSqMeters: number | null;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
  seedlings: { id: string; speciesName: string; count: number; plantTypeId: string | null; speciesId: string | null }[];
  photos: { id: string; stage: string; url: string; capturedAt: string }[];
  _count?: { seedlings: number; photos: number };
}

export interface SubmissionsResponse {
  status: string;
  data: SubmissionRow[];
  pagination: { total: number; take: number; skip: number; hasMore: boolean };
  stats: { totalSeedlings: number; submissionCount: number };
}

export interface DashboardStats {
  status: string;
  stats: {
    totalSubmissions: number;
    syncedSubmissions: number;
    pendingSync: number;
    totalSeedlings: number;
    districts: { name: string; count: number; totalAreaSqm: number | null }[];
  };
}

// ─── Fetch helpers (offline-safe) ────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // offline — fail silently
  }
}

/** GET /api/submissions — paginated list with optional filters */
export async function fetchSubmissions(params?: {
  district?: string;
  upazila?: string;
  synced?: boolean;
  limit?: number;
  offset?: number;
}): Promise<SubmissionsResponse | null> {
  const q = new URLSearchParams();
  if (params?.district) q.set('district', params.district);
  if (params?.upazila) q.set('upazila', params.upazila);
  if (params?.synced !== undefined) q.set('synced', String(params.synced));
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch<SubmissionsResponse>(`/api/submissions${qs ? `?${qs}` : ''}`);
}

/** GET /api/submissions/stats — aggregate dashboard numbers */
export async function fetchStats(): Promise<DashboardStats | null> {
  return apiFetch<DashboardStats>('/api/submissions/stats');
}

/** GET /api/submissions/:id — single submission with seedlings + photos */
export async function fetchSubmission(id: string): Promise<{ status: string; data: SubmissionRow } | null> {
  return apiFetch<{ status: string; data: SubmissionRow }>(`/api/submissions/${id}`);
}

/** POST /api/sync — push local drafts to the Prisma database */
export async function syncToServer(drafts: PlantationSubmission[]): Promise<{
  syncedCount: number;
  xpBonus: number;
  greenTokens: number;
  totalSeedlings: number;
  message: string;
} | null> {
  return apiFetch('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ drafts }),
  });
}