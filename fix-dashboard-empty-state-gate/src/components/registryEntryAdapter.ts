import type { PlantationSubmission } from '../types/plantation';
import type { SheetPlantationEntry } from '../hooks/useSheetPlantations';

/**
 * A PlantationSubmission-shaped view of a live App_Entry sheet row, so
 * RegistryTab's existing filter/search/render logic (which only knows
 * about PlantationSubmission) can display sheet entries without a
 * parallel code path. Every field RegistryTab or RegistryDetailModal
 * actually reads is populated from real sheet data; fields that don't
 * exist in the flatter SheetPlantationEntry shape (photos, verification
 * GPS, VM0047 fields, etc.) get safe empty defaults rather than being
 * fabricated.
 *
 * `source: 'sheet'` distinguishes these from real local submissions so
 * the UI can badge them ("📡 App_Entry") -- this is a display-only tag,
 * not part of PlantationSubmission itself.
 */
export type RegistryEntry = PlantationSubmission & { source: 'local' | 'sheet' };

/** Sheet dates have known data-quality issues (see useSheetPlantations.ts) --
 *  falls back to epoch rather than throwing on an unparseable value, so a
 *  single bad row can't crash the whole registry list. */
function safeIsoDate(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

export function sheetEntryToRegistryEntry(entry: SheetPlantationEntry): RegistryEntry {
  return {
    id: `sheet-${entry.submissionId}`,
    source: 'sheet',
    entryMode: 'dae_officer', // App_Entry is DAE-collected field data
    region: entry.district,
    district: entry.district,
    upazila: entry.upazila,
    union: entry.union,
    village: entry.village,
    seedlings: entry.seedlings.map((sd, i) => ({
      id: `${entry.submissionId}-${i}`,
      speciesName: sd.speciesName,
      count: sd.quantity,
    })),
    plantationDate: entry.plantingDate,
    latitude: entry.latitude,
    longitude: entry.longitude,
    accuracy: 0,
    caretakerName: entry.farmerName,
    caretakerMobile: entry.farmerMobile,
    saaoName: entry.saaoName,
    saaoMobile: '',
    monitoringOfficerName: entry.officerName,
    monitoringOfficerMobile: '',
    photos: [],
    synced: true, // by definition -- it's already on the sheet
    timestamp: safeIsoDate(entry.plantingDate),
  };
}

export function localToRegistryEntry(s: PlantationSubmission): RegistryEntry {
  return { ...s, source: 'local' };
}
