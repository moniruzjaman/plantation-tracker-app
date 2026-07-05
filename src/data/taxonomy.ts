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
  // বনজ
  { id: 'mehogoni', name: 'মেহগনি', plantTypeId: 'forest', scientificName: 'Swietenia macrophylla' },
  { id: 'akashmoni', name: 'আকাশমণি', plantTypeId: 'forest', scientificName: 'Acacia auriculiformis' },
  { id: 'segun', name: 'সেগুন', plantTypeId: 'forest', scientificName: 'Tectona grandis' },
  { id: 'shishu', name: 'শিশু', plantTypeId: 'forest', scientificName: 'Dalbergia sissoo' },
  { id: 'raintree', name: 'রেইনট্রি', plantTypeId: 'forest', scientificName: 'Samanea saman' },

  // ফলদ
  { id: 'mango', name: 'আম', plantTypeId: 'fruit', scientificName: 'Mangifera indica' },
  { id: 'jackfruit', name: 'কাঁঠাল', plantTypeId: 'fruit', scientificName: 'Artocarpus heterophyllus' },
  { id: 'litchi', name: 'লিচু', plantTypeId: 'fruit', scientificName: 'Litchi chinensis' },
  { id: 'guava', name: 'পেয়ারা', plantTypeId: 'fruit', scientificName: 'Psidium guajava' },
  { id: 'coconut', name: 'নারিকেল', plantTypeId: 'fruit', scientificName: 'Cocos nucifera' },

  // ঔষধি
  { id: 'neem', name: 'নিম', plantTypeId: 'medicinal', scientificName: 'Azadirachta indica' },
  { id: 'aloe', name: 'ঘৃতকুমারী', plantTypeId: 'medicinal', scientificName: 'Aloe vera' },

  // শোভাবর্ধনকারী
  { id: 'krishnachura', name: 'কৃষ্ণচূড়া', plantTypeId: 'ornamental', scientificName: 'Delonix regia' },

  // বাঁশ/বেত
  { id: 'bamboo', name: 'বাঁশ', plantTypeId: 'bamboo_cane', scientificName: 'Bambusoideae' },
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
