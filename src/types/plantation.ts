/**
 * Plantation Tracker v2 — Data Model
 *
 * Replaces the nursery-batch-shaped `PlantationSubmission` from v1
 * (nurseryName/ownerName + fruit/forest/medicinal category arrays)
 * with a flat, site-visit-shaped model matching the official
 * "০৫ বছরে ২৫ কোটি বৃক্ষ রোপণ কর্মসূচি" monthly reporting proforma
 * (17-column format, ref: uploaded 30-06-26 template).
 */

// ---------- Administrative hierarchy ----------

/** A Union is the normal parent of Blocks (3 per Union). A Municipality
 *  (পৌরসভা) is the alternate parent and only has 1 Block. Both are
 *  modeled the same way so lookups don't need to special-case type. */
export type ParentUnitType = 'union' | 'municipality';

export interface AdministrativeParentUnit {
  id: string;
  name: string; // e.g. "রাজারহাট সদর ইউনিয়ন" or "উলিপুর পৌরসভা"
  type: ParentUnitType;
  upazila: string;
  district: string;
}

export interface Block {
  id: string;
  name: string;
  parentUnitId: string; // -> AdministrativeParentUnit.id
}

// ---------- People directories ----------
// Populated once the official Block/Union/Upazila list + SAAO/officer
// assignments arrive. Until then these stay empty and the form falls
// back to manual entry (see EntryMode below).

export interface SaaoDirectoryEntry {
  id: string;
  name: string;
  mobile: string;
  blockId: string; // one SAAO is assigned to exactly one Block
}

/** Monitoring officer pool per upazila: 1 UAO + up to 2 AEOs + 1 AAO
 *  (up to 4 candidates). Any one of them may be recorded as the
 *  monitoring officer for a given entry, so this is NOT an auto-fill —
 *  it's a searchable dropdown scoped to the selected upazila. */
export type MonitoringOfficerDesignation =
  | 'UAO' // Upazila Agriculture Officer (1 per upazila)
  | 'AEO' // Agriculture Extension Officer (2 per upazila)
  | 'AAO'; // Additional Agriculture Officer (1 per upazila)

export interface MonitoringOfficerDirectoryEntry {
  id: string;
  name: string;
  mobile: string;
  designation: MonitoringOfficerDesignation;
  upazila: string;
  district: string;
}

// ---------- Taxonomy ----------
// Cascading Plant Type -> Species, each level extensible with "+ new entry".
// User-added entries land in a pending-review queue (see taxonomy.ts) rather
// than merging straight into the master list, so typos/duplicates don't
// silently corrupt future reporting. The official 17-column export only
// ever needs SeedlingEntry.speciesName (flattened) — plantTypeId/speciesId
// are for internal aggregation, spacing-norm lookup, and future reporting
// flexibility, not the report itself.

export interface PlantType {
  id: string;
  name: string; // e.g. "বনজ", "ফলদ", "ঔষধি", "ভেষজ"
  pending?: boolean; // true if user-added, awaiting admin approval
}

export interface Species {
  id: string;
  name: string;
  plantTypeId: string; // -> PlantType.id
  scientificName?: string;
  pending?: boolean;
}

// ---------- Photo evidence & growth checkpoints ----------
// A single planting-day photo proves a tree was planted, not that it
// survived. Carbon-credit-grade evidence needs a revisit trail: each
// checkpoint must be geo-validated against the original point (~15m)
// so a photo can't be substituted from an unrelated site later.

export type CheckpointStage = 'planting' | 'month_6' | 'year_1' | 'year_2' | 'year_3';

export interface PhotoRecord {
  id: string;
  stage: CheckpointStage;
  /** Compressed client-side before upload (~1280px long edge, JPEG ~0.65–0.7
   *  quality) so each photo lands ~80–150KB regardless of source resolution. */
  url: string;
  sha256: string; // tamper-evidence: hash changes if the file is ever swapped
  capturedAt: string; // ISO timestamp
  latitude: number;
  longitude: number;
  distanceFromOriginMeters?: number; // computed at capture time, flagged if > ~15m
}

// ---------- Submission entry ----------

/** Flat species entry for the official export — no fruit/forest/medicinal
 *  category split. plantTypeId/speciesId are optional taxonomy references
 *  used internally; speciesName is always the flattened display string
 *  that goes into the report regardless of whether it resolved to a
 *  taxonomy entry or was typed as free text. */
export interface SeedlingEntry {
  id: string; // client-generated, stable for React keys + edit/remove
  plantTypeId?: string;
  speciesId?: string;
  speciesName: string;
  count: number;
}

/** Who is submitting the entry determines whether SAAO / Monitoring
 *  Officer are locked directory lookups or open text fields. */
export type EntryMode = 'dae_officer' | 'citizen';

export interface PlantationSubmission {
  id: string;
  entryMode: EntryMode;

  // Location — matches report columns 2–6. Block is optional per the
  // 2026-07-03 decision (citizen entries, or DAE entries made before
  // the official Block directory is loaded / SAAO not yet listed).
  // `region` is DAE's 14-region breakdown in dae_officer mode, or the
  // public 8-Division system in citizen mode (see data/geoData.ts) —
  // not part of the official export, used to drive the district cascade.
  region: string;
  district: string;
  upazila: string;
  union: string;
  blockId?: string; // -> Block.id, when resolved from directory
  blockName?: string; // free-text fallback if blockId not resolved
  village: string;

  // Report columns 7–8 (flat, repeatable)
  seedlings: SeedlingEntry[];

  // Report column 9
  plantationDate: string; // ISO date

  // Report column 10
  latitude: number;
  longitude: number;
  accuracy: number;

  // Report columns 11–12 — caretaker always manual, varies per site
  caretakerName: string;
  caretakerMobile: string;

  // Report columns 13–14 — locked dropdown in dae_officer mode,
  // open text in citizen mode. Manual override always available.
  saaoId?: string; // -> SaaoDirectoryEntry.id, when selected from directory
  saaoName: string;
  saaoMobile: string;

  // Report columns 15–16 — searchable dropdown scoped to upazila in
  // dae_officer mode, open text in citizen mode.
  monitoringOfficerId?: string; // -> MonitoringOfficerDirectoryEntry.id
  monitoringOfficerName: string;
  monitoringOfficerMobile: string;

  // Report column 17
  remarks?: string;

  // ---- App-only extras, not part of the official export ----

  // Site area, walked or estimated (m²) — used only to soft-flag the
  // reported seedling count against DAE's standard planting-distance
  // norms per plant type (see spacingNorms.ts). Reported counts are
  // NEVER auto-corrected against this; it's a review flag for the
  // monitoring officer, not a gate on submission. Real plantations
  // along roads/embankments/homesteads legitimately won't fit a grid.
  areaSqMeters?: number;
  spacingFlag?: boolean; // true if reported count deviates materially from the norm

  // Verification photo trail — see PhotoRecord above.
  photos: PhotoRecord[];

  // Seedling source, optionally linked to the existing nursery-mapping
  // registry (138+ GPS-cleaned nurseries). Deferred: full nursery
  // supplier/strategic-partner module. Kept here now: a reference field
  // + map-pin so a source can still be shown on the map without
  // re-embedding nursery data entry into this app.
  nurserySourceId?: string; // -> external nursery-mapping registry id
  nurserySourceName?: string;
  nurserySourceLatitude?: number;
  nurserySourceLongitude?: number;

  timestamp: string;
  synced: boolean;
}

/** Header fields for the official monthly proforma — one per generated
 *  report, not per submission. */
export interface MonthlyReportHeader {
  officeName: string; // মন্ত্রণালয়/বিভাগ/অধিদপ্তর/দপ্তরের নাম
  reportMonth: string; // e.g. "জুন ২০২৬"
}

export function createEmptySubmission(mode: EntryMode): PlantationSubmission {
  return {
    id: crypto.randomUUID(),
    entryMode: mode,
    region: '',
    district: '',
    upazila: '',
    union: '',
    village: '',
    seedlings: [],
    plantationDate: new Date().toISOString().slice(0, 10),
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    caretakerName: '',
    caretakerMobile: '',
    saaoName: '',
    saaoMobile: '',
    monitoringOfficerName: '',
    monitoringOfficerMobile: '',
    photos: [],
    timestamp: new Date().toISOString(),
    synced: false,
  };
}
