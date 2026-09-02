/**
 * Administrative directory: Upazila -> Union/Municipality -> Block -> SAAO,
 * plus per-upazila Monitoring Officer pools.
 *
 * STATUS: schema is final; data arrays are empty placeholders pending the
 * official Block/Union/Upazila list (in progress as of 2026-07-03).
 *
 * Fill pattern once data arrives:
 *   1. Add every Union/Municipality to PARENT_UNITS
 *   2. Add every Block to BLOCKS (3 per Union, 1 per Municipality)
 *   3. Add every SAAO to SAAO_DIRECTORY (1 per Block)
 *   4. Add every Monitoring Officer to MONITORING_OFFICER_DIRECTORY
 *      (UAO/AEO/AEO/AAO per upazila — up to 4 candidates)
 *
 * Nothing elsewhere in the app needs to change when this data is filled —
 * the lookup helpers below are what components call, not the raw arrays.
 */

import type {
  AdministrativeParentUnit,
  Block,
  SaaoDirectoryEntry,
  MonitoringOfficerDirectoryEntry,
} from '../types/plantation';

export const KURIGRAM_UPAZILAS = [
  'কুড়িগ্রাম সদর',
  'নাগেশ্বরী',
  'ভুরুঙ্গামারী',
  'ফুলবাড়ী',
  'রাজারহাট',
  'উলিপুর',
  'চিলমারী',
  'রৌমারী',
  'রাজিবপুর',
] as const;

export const PARENT_UNITS: AdministrativeParentUnit[] = [
  // TODO: populate with official Union + Municipality list per upazila.
];

export const BLOCKS: Block[] = [
  // TODO: populate — 3 blocks per Union, 1 block per Municipality.
];

export const SAAO_DIRECTORY: SaaoDirectoryEntry[] = [
  // TODO: populate — one SAAO per Block.
];

export const MONITORING_OFFICER_DIRECTORY: MonitoringOfficerDirectoryEntry[] = [
  // TODO: populate — UAO / 2x AEO / AAO per upazila.
];

// ---------- Lookup helpers ----------

export function getParentUnitsByUpazila(upazila: string): AdministrativeParentUnit[] {
  return PARENT_UNITS.filter((u) => u.upazila === upazila);
}

/** Suggestion list for the editable Union combobox — names only, since
 *  the form stores the union as free text, not an id, until the
 *  official list is loaded and this can become a real lookup. */
export function getUnionNameSuggestions(upazila: string): string[] {
  return getParentUnitsByUpazila(upazila).map((u) => u.name);
}

export function getBlocksByParentUnit(parentUnitId: string): Block[] {
  return BLOCKS.filter((b) => b.parentUnitId === parentUnitId);
}

/** Suggestion list for the editable Block combobox, resolved by the
 *  free-text union name the user typed/picked (falls back to empty
 *  until PARENT_UNITS/BLOCKS are populated). */
export function getBlockNameSuggestions(upazila: string, unionName: string): string[] {
  const parentUnit = getParentUnitsByUpazila(upazila).find((u) => u.name === unionName);
  if (!parentUnit) return [];
  return getBlocksByParentUnit(parentUnit.id).map((b) => b.name);
}

export function getSaaoByBlock(blockId: string): SaaoDirectoryEntry | undefined {
  return SAAO_DIRECTORY.find((s) => s.blockId === blockId);
}

/** Reverse lookup: pick a SAAO by name/mobile search, resolve their
 *  full location chain in one shot. This is what the SAAO dropdown
 *  in dae_officer mode actually calls — search first, autofill follows. */
export function searchSaao(query: string): SaaoDirectoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SAAO_DIRECTORY.filter(
    (s) => s.name.toLowerCase().includes(q) || s.mobile.includes(q)
  );
}

export function resolveSaaoLocation(saao: SaaoDirectoryEntry): {
  block?: Block;
  parentUnit?: AdministrativeParentUnit;
} {
  const block = BLOCKS.find((b) => b.id === saao.blockId);
  const parentUnit = block ? PARENT_UNITS.find((u) => u.id === block.parentUnitId) : undefined;
  return { block, parentUnit };
}

export function getMonitoringOfficersByUpazila(
  upazila: string
): MonitoringOfficerDirectoryEntry[] {
  return MONITORING_OFFICER_DIRECTORY.filter((o) => o.upazila === upazila);
}

/** True once real data has been loaded — components use this to decide
 *  whether to offer the directory dropdown at all or fall straight back
 *  to manual text entry (keeps the form usable during the data-collection
 *  gap instead of showing an empty, broken-looking dropdown). */
export function isDirectoryReady(): boolean {
  return SAAO_DIRECTORY.length > 0 || MONITORING_OFFICER_DIRECTORY.length > 0;
}
