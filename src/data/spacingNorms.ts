/**
 * Planting-distance norms per plant type, used to soft-flag reported
 * seedling counts against site area for review — never to auto-correct
 * or block a submission.
 *
 * IMPORTANT: the numbers below are indicative placeholders (typical
 * forestry/orchard spacing figures), NOT confirmed DAE standards. Per
 * the 2026-07-03 decision: use per-plant-type spacing for the future
 * carbon-claim value (better data = any report format later), but the
 * *official* report always uses DAE's standard reporting figures/count
 * as entered — this file must never influence what goes into the
 * official export, only the review flag shown to the monitoring officer.
 *
 * TODO: replace with DAE's confirmed spacing standards per plant type
 * before relying on this for anything beyond an internal review hint.
 */

import type { PlantationSubmission } from '../types/plantation';

/** Average spacing in meters between plants of this type. Roadside/avenue
 *  planting along a line is a special case (linear, not grid) and isn't
 *  represented here — line plantings should generally be excluded from
 *  this check rather than flagged as anomalies. */
export const INDICATIVE_SPACING_METERS: Record<string, number> = {
  forest: 2, // ~2m x 2m grid, dense forestry planting
  fruit: 6, // ~6m x 6m, orchard-style spacing
  medicinal: 1.5,
  ornamental: 4,
  bamboo_cane: 3,
};

export interface SpacingCheckResult {
  expectedCount: number;
  reportedCount: number;
  deviationRatio: number; // reportedCount / expectedCount
  flagged: boolean; // true if deviation is large enough to warrant review
}

/** Soft-flag threshold: reported count more than 2x or less than 0.5x the
 *  area-based estimate gets flagged for the monitoring officer to look at.
 *  Deliberately loose — homestead/scattered/roadside plantings won't fit
 *  a clean grid and shouldn't be treated as errors by default. */
const FLAG_LOW_RATIO = 0.5;
const FLAG_HIGH_RATIO = 2.0;

export function checkSpacing(
  areaSqMeters: number,
  plantTypeId: string,
  reportedCount: number
): SpacingCheckResult | null {
  const spacing = INDICATIVE_SPACING_METERS[plantTypeId];
  if (!spacing || !areaSqMeters || areaSqMeters <= 0) return null;

  const expectedCount = Math.round(areaSqMeters / (spacing * spacing));
  if (expectedCount <= 0) return null;

  const deviationRatio = reportedCount / expectedCount;
  const flagged = deviationRatio < FLAG_LOW_RATIO || deviationRatio > FLAG_HIGH_RATIO;

  return { expectedCount, reportedCount, deviationRatio, flagged };
}

/** Convenience wrapper for a full submission — checks each seedling row
 *  that has a resolved plantTypeId against the site's total area, and
 *  sets `spacingFlag` if any row is flagged. Called on submit, purely
 *  informational — does not block or alter the submission. */
export function evaluateSubmissionSpacing(
  submission: Pick<PlantationSubmission, 'areaSqMeters' | 'seedlings'>
): boolean {
  if (!submission.areaSqMeters) return false;
  return submission.seedlings.some((s) => {
    if (!s.plantTypeId) return false;
    const result = checkSpacing(submission.areaSqMeters!, s.plantTypeId, s.count);
    return result?.flagged ?? false;
  });
}
