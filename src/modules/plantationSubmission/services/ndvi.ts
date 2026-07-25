/**
 * NDVI service for the new submission wizard's "Environmental
 * Intelligence" read-only display. Wraps the existing, already-real
 * (not placeholder) NASA GIBS-based sampler in utils/realtimeNdvi.ts —
 * kept as a thin service layer here (rather than importing that util
 * directly from steps/) so this module has one seam to swap in a
 * different NDVI provider later without touching UI code.
 */

import { sampleNDVIAt } from '../../../utils/realtimeNdvi';

export interface NdviResult {
  ndvi: number;
  sampledAt: string;
}

export async function getNdviForPoint(latitude: number, longitude: number): Promise<NdviResult> {
  const sample = await sampleNDVIAt(latitude, longitude);
  return { ndvi: sample.ndvi, sampledAt: new Date().toISOString() };
}
