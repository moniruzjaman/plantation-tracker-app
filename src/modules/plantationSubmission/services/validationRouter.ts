/**
 * Validation Router.
 *
 * Implements the spec's pipeline:
 *   GPS -> Administrative Boundary -> Block Mapping -> Assigned SAAO -> Validation Task
 *
 * The officer submitting never picks a validator — routing is automatic
 * from the site's location, wrapping the existing lookup chain in
 * data/administrativeDirectory.ts (Upazila -> Union -> Block -> SAAO)
 * rather than reimplementing it.
 *
 * IMPORTANT: as of this writing, administrativeDirectory.ts's PARENT_UNITS/
 * BLOCKS/SAAO_DIRECTORY arrays are empty placeholders pending the official
 * Block/Union list (see that file's header comment). Routing will
 * therefore commonly come back `status: 'unassigned'` until that data is
 * loaded — this is handled as an expected state, not an error, so the
 * wizard doesn't block submission on it.
 */

import {
  getParentUnitsByUpazila,
  getBlocksByParentUnit,
  getSaaoByBlock,
} from '../../../data/administrativeDirectory';
import type { PlantationSite } from '../types/submission';

export type RoutingStatus = 'assigned' | 'unassigned';

export interface ValidationTask {
  status: RoutingStatus;
  upazila: string;
  union: string;
  blockId?: string;
  blockName?: string;
  saaoId?: string;
  saaoName?: string;
  saaoMobile?: string;
  reason?: string; // populated when status === 'unassigned'
}

export function routeToValidator(site: PlantationSite): ValidationTask {
  const { upazila, union } = site.location;

  if (!upazila || !union) {
    return {
      status: 'unassigned',
      upazila,
      union,
      reason: 'উপজেলা/ইউনিয়ন তথ্য অসম্পূর্ণ — সাইট ধাপে ঠিকানা নিশ্চিত করুন',
    };
  }

  const parentUnit = getParentUnitsByUpazila(upazila).find((u) => u.name === union);
  if (!parentUnit) {
    return {
      status: 'unassigned',
      upazila,
      union,
      reason: 'এই ইউনিয়নের প্রশাসনিক ডিরেক্টরি এখনো লোড হয়নি',
    };
  }

  const blocks = getBlocksByParentUnit(parentUnit.id);
  if (blocks.length === 0) {
    return {
      status: 'unassigned',
      upazila,
      union,
      reason: 'এই ইউনিয়নের ব্লক তথ্য এখনো লোড হয়নি',
    };
  }

  // Deterministic block pick — first block under the union. Once real
  // block *boundaries* (not just names) are loaded, this is the seam to
  // swap in an actual point-in-polygon block match instead.
  const block = blocks[0];
  const saao = getSaaoByBlock(block.id);

  if (!saao) {
    return {
      status: 'unassigned',
      upazila,
      union,
      blockId: block.id,
      blockName: block.name,
      reason: 'এই ব্লকের জন্য কোনো SAAO নির্ধারিত নেই',
    };
  }

  return {
    status: 'assigned',
    upazila,
    union,
    blockId: block.id,
    blockName: block.name,
    saaoId: saao.id,
    saaoName: saao.name,
    saaoMobile: saao.mobile,
  };
}
