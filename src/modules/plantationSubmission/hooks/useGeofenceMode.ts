import type { GeofenceMode, PlantationSite } from '../types/submission';

/** Orchard mode kicks in past this quantity even if area isn't known yet. */
export const ORCHARD_QUANTITY_THRESHOLD = 20;

/** Orchard mode also kicks in past this area, regardless of quantity —
 *  covers the case of a small number of widely-spaced large trees that
 *  still cover a big footprint (e.g. a homestead orchard boundary).
 *  2000 m² ≈ 0.5 acre — a reasonable line between "point + radius is
 *  good enough" and "this really needs an actual boundary". */
export const ORCHARD_AREA_THRESHOLD_SQM = 2000;

/**
 * Derives which geofence mode applies, per the spec:
 *   1 plant              -> single_tree (point only)
 *   2–20 plants           -> small_plantation (point + optional radius)
 *   >20 plants OR area over threshold -> orchard (polygon mandatory)
 */
export function deriveGeofenceMode(totalQuantity: number, estimatedAreaSqMeters?: number): GeofenceMode {
  if (totalQuantity <= 1) return 'single_tree';
  if (totalQuantity > ORCHARD_QUANTITY_THRESHOLD) return 'orchard';
  if (estimatedAreaSqMeters && estimatedAreaSqMeters > ORCHARD_AREA_THRESHOLD_SQM) return 'orchard';
  return 'small_plantation';
}

export function useGeofenceMode(totalQuantity: number, estimatedAreaSqMeters?: number): GeofenceMode {
  return deriveGeofenceMode(totalQuantity, estimatedAreaSqMeters);
}

/** Resolves the effective geofence mode for a site: an explicit
 *  `geofence.manualMode` (set via the Plant section's একক গাছ / ছোট বাগান /
 *  বাগান save buttons) always wins; otherwise falls back to the
 *  quantity/area auto-derivation. */
export function resolveGeofenceMode(site: PlantationSite): GeofenceMode {
  if (site.geofence.manualMode) return site.geofence.manualMode;
  const totalQuantity = site.plants.reduce((sum, p) => sum + (p.quantity || 0), 0);
  return deriveGeofenceMode(totalQuantity, site.geofence.areaSqMeters);
}
