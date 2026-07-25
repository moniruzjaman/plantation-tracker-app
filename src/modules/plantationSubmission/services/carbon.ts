/**
 * Carbon estimate service for the new submission wizard's "Environmental
 * Intelligence" read-only display. Wraps the existing VM0047-oriented
 * calculator in utils/carbonStock.ts (already a real implementation, not
 * a placeholder) — kept as a thin service layer so this module has one
 * seam to swap in a different methodology later without touching UI code.
 */

import { calculateCarbonStock } from '../../../utils/carbonStock';
import type { PlantEntry } from '../types/submission';

export interface CarbonEstimateResult {
  estimatedTons: number;
  estimatedAt: string;
}

/** Estimates carbon for a site's current plant list. Uses a nominal
 *  1-year-since-planting assumption for a fresh submission — this is a
 *  day-zero estimate, not a survival-verified figure; that comes later
 *  from the monitoring/re-inspection workflow this module hands off to. */
export function getCarbonEstimateForPlants(plants: PlantEntry[], areaHectares = 1): CarbonEstimateResult {
  const seedlings = plants
    .filter((p) => p.speciesName)
    .map((p) => ({ id: p.plant_id, speciesName: p.speciesName, count: p.quantity }));

  const report = calculateCarbonStock(seedlings, [], areaHectares, 1);
  return {
    estimatedTons: report.totalCarbonStockMg || 0,
    estimatedAt: new Date().toISOString(),
  };
}
