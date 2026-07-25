/**
 * Flattens one finished PlantationSite (+ its Personnel) from the new
 * wizard's richer draft model into the existing flat PlantationSubmission
 * shape (types/plantation.ts) and writes it via the existing
 * saveSubmission() — so it shows up in the Map, Dashboard, and Registry
 * tabs immediately, without any of those needing to learn a second data
 * shape. A submission with N sites becomes N legacy PlantationSubmission
 * rows, linked back to the same draft via a shared id prefix.
 */

import { saveSubmission } from '../../../lib/db';
import type { PlantationSubmission, SeedlingEntry } from '../../../types/plantation';
import type { PlantationSite, Personnel, SubmissionInfo } from '../types/submission';
import type { ValidationTask } from './validationRouter';

export function flattenSiteToLegacySubmission(
  site: PlantationSite,
  personnel: Personnel | undefined,
  submissionInfo: SubmissionInfo,
  routing: ValidationTask,
  entryMode: 'dae_officer' | 'citizen'
): PlantationSubmission {
  const seedlings: SeedlingEntry[] = site.plants
    .filter((p) => p.speciesName)
    .map((p) => ({
      id: p.plant_id,
      plantTypeId: p.category || undefined,
      speciesName: p.speciesName,
      count: p.quantity,
    }));

  // Legacy schema has no separate "planter" field (only caretaker) — fold
  // planter identity into remarks rather than silently dropping it.
  const planterNote =
    personnel && personnel.planterName
      ? `রোপণকারী: ${personnel.planterName}${personnel.planterMobile ? ` (${personnel.planterMobile})` : ''}`
      : '';

  const earliestPlantationDate =
    site.plants
      .map((p) => p.plantationDate)
      .filter(Boolean)
      .sort()[0] || new Date().toISOString().slice(0, 10);

  const hasOrchardPolygon = site.geofence.mode === 'orchard' && !!site.geofence.polygon && site.geofence.polygon.length >= 3;

  return {
    id: site.site_id, // stable — traceable back to the wizard draft's site
    entryMode,

    region: site.location.division,
    district: site.location.district,
    upazila: site.location.upazila,
    union: site.location.union,
    blockId: routing.status === 'assigned' ? routing.blockId : undefined,
    blockName: routing.status === 'assigned' ? routing.blockName : undefined,
    village: site.location.villageOrRoad,

    seedlings,
    plantationDate: earliestPlantationDate,

    latitude: site.location.latitude,
    longitude: site.location.longitude,
    accuracy: site.location.accuracy,

    caretakerName: personnel?.caretakerName || '',
    caretakerMobile: personnel?.caretakerMobile || '',

    saaoId: routing.status === 'assigned' ? routing.saaoId : undefined,
    saaoName: routing.status === 'assigned' ? routing.saaoName || '' : '',
    saaoMobile: routing.status === 'assigned' ? routing.saaoMobile || '' : '',

    monitoringOfficerName: '',
    monitoringOfficerMobile: '',

    remarks: planterNote || undefined,

    areaSqMeters: site.geofence.areaSqMeters,

    photos: site.plants.flatMap((p) => p.photos),

    trackingMethod: hasOrchardPolygon ? 'area' : 'census',
    geoPolygon: hasOrchardPolygon
      ? JSON.stringify({
          type: 'Polygon',
          coordinates: [site.geofence.polygon!.map(([lat, lng]) => [lng, lat])], // GeoJSON is [lng, lat]
        })
      : undefined,

    timestamp: submissionInfo.submissionDate,
    synced: false,
  };
}

/** Flattens and persists every site in a finished draft. Returns the
 *  legacy submission ids written, in site order. */
export async function submitAllSites(
  sites: PlantationSite[],
  personnelList: Personnel[],
  submissionInfo: SubmissionInfo,
  routingBySiteId: Record<string, ValidationTask>,
  entryMode: 'dae_officer' | 'citizen'
): Promise<string[]> {
  const ids: string[] = [];
  for (const site of sites) {
    const personnel = personnelList.find((p) => p.site_id === site.site_id);
    const routing = routingBySiteId[site.site_id];
    const legacy = flattenSiteToLegacySubmission(site, personnel, submissionInfo, routing, entryMode);
    await saveSubmission(legacy);
    ids.push(legacy.id);
  }
  return ids;
}
