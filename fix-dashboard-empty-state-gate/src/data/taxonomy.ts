/**
 * Plant Type -> Species taxonomy.
 *
 * Seeded with DAE's standard categories (matches what v1 called
 * fruit/forest/medicinal, now generalized and extensible) plus a starter
 * species list per type. Both levels support "+ new entry" from the form;
 * user-added entries are appended with `pending: true` and must be
 * approved (promoted to `pending: false`) before they count as canonical —
 * this keeps aggregation clean instead of accumulating typo-duplicates
 * (আম vs আম্র vs Mango) over time.
 *
 * Approval is intentionally not wired to a UI yet — that's an
 * officer/admin-role screen for a later pass. For now `approveSpecies` /
 * `approvePlantType` exist so that pass has something to call.
 *
 * v2: Added `carbonFactor` (IPCC Tier 2) for VM0047 carbon stock calculation.
 */

import type { PlantType, Species } from '../types/plantation';

export const PLANT_TYPES: PlantType[] = [
  { id: 'forest', name: 'বনজ' },
  { id: 'fruit', name: 'ফলদ' },
  { id: 'medicinal', name: 'ঔষধি' },
  { id: 'ornamental', name: 'শোভাবর্ধনকারী' },
  { id: 'bamboo_cane', name: 'বাঁশ/বেত' },
];

export const SPECIES: Species[] = [
  // বনজ (Forest)
  { id: 'mehogoni', name: 'মেহগনি', plantTypeId: 'forest', scientificName: 'Swietenia macrophylla', carbonFactor: 0.50 },
  { id: 'akashmoni', name: 'আকাশমণি', plantTypeId: 'forest', scientificName: 'Acacia auriculiformis', carbonFactor: 0.45 },
  { id: 'segun', name: 'সেগুন', plantTypeId: 'forest', scientificName: 'Tectona grandis', carbonFactor: 0.48 },
  { id: 'shishu', name: 'শিশু', plantTypeId: 'forest', scientificName: 'Dalbergia sissoo', carbonFactor: 0.52 },
  { id: 'raintree', name: 'রেইনট্রি', plantTypeId: 'forest', scientificName: 'Samanea saman', carbonFactor: 0.42 },

  // ফলদ (Fruit)
  { id: 'mango', name: 'আম', plantTypeId: 'fruit', scientificName: 'Mangifera indica', carbonFactor: 0.42 },
  { id: 'jackfruit', name: 'কাঁঠাল', plantTypeId: 'fruit', scientificName: 'Artocarpus heterophyllus', carbonFactor: 0.44 },
  { id: 'litchi', name: 'লিচু', plantTypeId: 'fruit', scientificName: 'Litchi chinensis', carbonFactor: 0.40 },
  { id: 'guava', name: 'পেয়ারা', plantTypeId: 'fruit', scientificName: 'Psidium guajava', carbonFactor: 0.46 },
  { id: 'coconut', name: 'নারিকেল', plantTypeId: 'fruit', scientificName: 'Cocos nucifera', carbonFactor: 0.38 },

  // ঔষধি (Medicinal)
  { id: 'neem', name: 'নিম', plantTypeId: 'medicinal', scientificName: 'Azadirachta indica', carbonFactor: 0.51 },
  { id: 'aloe', name: 'ঘৃতকুমারী', plantTypeId: 'medicinal', scientificName: 'Aloe vera', carbonFactor: 0.15 },

  // শোভাবর্ধনকারী (Ornamental)
  { id: 'krishnachura', name: 'কৃষ্ণচূড়া', plantTypeId: 'ornamental', scientificName: 'Delonix regia', carbonFactor: 0.43 },

  // বাঁশ/বেত (Bamboo/Cane)
  { id: 'bamboo', name: 'বাঁশ', plantTypeId: 'bamboo_cane', scientificName: 'Bambusoideae', carbonFactor: 0.47 },
];

// ---------- Pending-entry queue ----------
// In-memory for now; swap for the real backend queue once the
// Dexie/sync rework lands (same pattern as the rest of this module).

let pendingCounter = 0;

export function addPendingPlantType(name: string): PlantType {
  const entry: PlantType = { id: `pending_type_${++pendingCounter}`, name, pending: true };
  PLANT_TYPES.push(entry);
  return entry;
}

export function addPendingSpecies(name: string, plantTypeId: string): Species {
  const entry: Species = {
    id: `pending_species_${++pendingCounter}`,
    name,
    plantTypeId,
    pending: true,
  };
  SPECIES.push(entry);
  return entry;
}

export function approvePlantType(id: string): void {
  const t = PLANT_TYPES.find((p) => p.id === id);
  if (t) t.pending = false;
}

export function approveSpecies(id: string): void {
  const s = SPECIES.find((sp) => sp.id === id);
  if (s) s.pending = false;
}

export function getSpeciesByPlantType(plantTypeId: string): Species[] {
  return SPECIES.filter((s) => s.plantTypeId === plantTypeId);
}

/** Look up a species' carbon factor by Bengali name. Falls back to 0.47. */
export function getSpeciesCarbonFactor(speciesName: string): number {
  const sp = SPECIES.find(s => s.name === speciesName);
  return sp?.carbonFactor ?? 0.47;
}