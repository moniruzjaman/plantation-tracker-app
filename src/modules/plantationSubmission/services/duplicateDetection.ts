/**
 * Duplicate-submission detection (fraud-proofing).
 *
 * Compares the site currently being filled in against the national
 * App_Entry sheet (same source as the ম্যাপ tab, via /api/sheet/list) and
 * flags any existing entry that's suspiciously close: within
 * DUPLICATE_DISTANCE_METERS of this site's GPS point, planted within
 * DUPLICATE_DATE_WINDOW_DAYS of this site's plant, and matching species
 * name. This catches both accidental re-submission of the same tree and
 * two different officers double-counting the same planting event — it
 * does not (and cannot, from the browser) prove fraud, so it's presented
 * as a review flag the officer must explicitly acknowledge, never a hard
 * block on its own.
 */

import { distanceMeters } from '../../../utils/photoEvidence';
import type { PlantationSite } from '../types/submission';

export const DUPLICATE_DISTANCE_METERS = 15;
export const DUPLICATE_DATE_WINDOW_DAYS = 21;

export interface DuplicateMatch {
  submissionId: string;
  officerName: string;
  distanceMeters: number;
  plantingDate: string;
  speciesName: string;
}

interface SheetEntryForCheck {
  submissionId: string;
  officerName: string;
  latitude: number;
  longitude: number;
  plantingDate: string;
  seedlings: { speciesName: string }[];
}

// In-memory cache so re-running the check as the officer types doesn't
// re-fetch the whole national sheet on every keystroke — 5 minutes is
// plenty fresh for a fraud-flag check (not a live map).
let cache: { data: SheetEntryForCheck[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchEntriesForDuplicateCheck(): Promise<SheetEntryForCheck[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    // Offline: skip the check silently rather than blocking the form —
    // the officer can't do anything about a network-dependent check with
    // no network, and this must never prevent an offline draft save.
    return cache?.data ?? [];
  }

  try {
    const res = await fetch('/api/sheet/list');
    const data = await res.json();
    if (data.status === 'disabled' || (data.ok === false && !Array.isArray(data.entries))) {
      cache = { data: [], fetchedAt: Date.now() };
      return [];
    }
    const raw: any[] = Array.isArray(data.entries) ? data.entries : [];
    const parsed: SheetEntryForCheck[] = raw
      .map((r) => ({
        submissionId: String(r.submissionId || ''),
        officerName: String(r.officerName || ''),
        latitude: parseFloat(String(r.latitude).replace(',', '.')),
        longitude: parseFloat(String(r.longitude).replace(',', '.')),
        plantingDate: String(r.plantingDate || ''),
        seedlings: Array.isArray(r.seedlings)
          ? r.seedlings.map((sd: any) => ({ speciesName: String(sd.speciesName || '') }))
          : [],
      }))
      .filter((e) => Number.isFinite(e.latitude) && Number.isFinite(e.longitude));
    cache = { data: parsed, fetchedAt: Date.now() };
    return parsed;
  } catch {
    // Never let a failed fraud-check fetch block the form — return
    // whatever we last had cached (possibly nothing).
    return cache?.data ?? [];
  }
}

function daysBetween(isoA: string, isoB: string): number | null {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.abs(a - b) / 86400000;
}

function normalizeSpecies(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Returns one match per (existing entry, species) pair that's within the
 * distance and date-window thresholds of any plant on `site`. Excludes
 * the site's own previous submission (by submissionId) so re-editing an
 * already-submitted site doesn't flag against itself.
 */
export function detectDuplicates(
  site: PlantationSite,
  existingEntries: SheetEntryForCheck[],
  ownSubmissionId?: string
): DuplicateMatch[] {
  const hasPoint = site.location.latitude !== 0 || site.location.longitude !== 0;
  if (!hasPoint || site.plants.length === 0) return [];

  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();

  for (const entry of existingEntries) {
    if (ownSubmissionId && entry.submissionId === ownSubmissionId) continue;
    const distance = distanceMeters(site.location.latitude, site.location.longitude, entry.latitude, entry.longitude);
    if (distance > DUPLICATE_DISTANCE_METERS) continue;

    for (const plant of site.plants) {
      if (!plant.speciesName.trim()) continue;
      const days = daysBetween(plant.plantationDate, entry.plantingDate);
      if (days === null || days > DUPLICATE_DATE_WINDOW_DAYS) continue;

      const speciesMatch = entry.seedlings.some(
        (sd) => normalizeSpecies(sd.speciesName) === normalizeSpecies(plant.speciesName)
      );
      if (!speciesMatch) continue;

      const key = `${entry.submissionId}:${normalizeSpecies(plant.speciesName)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      matches.push({
        submissionId: entry.submissionId,
        officerName: entry.officerName,
        distanceMeters: Math.round(distance),
        plantingDate: entry.plantingDate,
        speciesName: plant.speciesName,
      });
    }
  }

  return matches;
}
