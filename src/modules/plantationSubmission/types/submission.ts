/**
 * New Plantation Submission — data model.
 *
 * Hierarchy:
 *   SubmissionDraft
 *    └── PlantationSite (1..N)
 *          ├── location + geofence + NDVI + carbon
 *          └── PlantEntry (1..N)
 *
 * Deliberately a *separate* shape from the existing flat
 * `PlantationSubmission` (types/plantation.ts) — that type is single-site
 * shaped and already backs the Map/Dashboard/Registry tabs. Rather than
 * changing it (and risking breaking those tabs), each `PlantationSite` in
 * a finished submission gets flattened into one `PlantationSubmission` on
 * final submit (see services/flattenToLegacySubmission.ts, added in a
 * later phase) — so existing surfaces keep working unmodified, and this
 * module's richer internal shape is free to evolve independently.
 */

import type { PhotoRecord } from '../../../types/plantation';

// ---------- Geofence ----------

/** Single tree: qty = 1, point only.
 *  Small plantation: 2–20 plants, point + optional radius.
 *  Orchard: >20 plants OR area over threshold, polygon mandatory. */
export type GeofenceMode = 'single_tree' | 'small_plantation' | 'orchard';

export interface GeofenceData {
  mode: GeofenceMode;
  /** Set when the officer explicitly picks a plant-entry type (একক গাছ /
   *  ছোট বাগান / বাগান) via the Plant section's save buttons, instead of
   *  letting the quantity/area thresholds decide automatically. Once set,
   *  this takes priority over the auto-derived mode — see
   *  services/... resolveGeofenceMode(). Cleared is represented by
   *  `undefined`, which falls back to auto-derivation again. */
  manualMode?: GeofenceMode;
  latitude: number;
  longitude: number;
  /** Small-plantation mode only — optional coverage radius in meters. */
  radiusMeters?: number;
  /** Orchard mode only — GeoJSON polygon ring, [lng, lat] pairs, closed. */
  polygon?: [number, number][];
  /** Derived once a polygon exists. */
  areaSqMeters?: number;
  perimeterMeters?: number;
  centroid?: { latitude: number; longitude: number };
}

// ---------- Location (Step 1) ----------

export interface SiteLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  /** true once the officer has confirmed/edited the GPS-derived point,
   *  vs. still showing the raw auto-capture. */
  manuallyAdjusted: boolean;

  // Reverse-geocoded via Nominatim, all editable after autofill.
  division: string;
  district: string;
  upazila: string;
  union: string;
  villageOrRoad: string;
  postalCode: string;
  fullAddress: string;
}

// ---------- Environmental intelligence (read-only display) ----------

export interface EnvironmentalIntel {
  ndvi: number | null;
  ndviLoading: boolean;
  ndviError?: string;
  carbonEstimateTons: number | null;
  carbonLoading: boolean;
  carbonError?: string;
}

// ---------- Plant (Step 2) ----------

export interface PlantEntry {
  plant_id: string;
  category: string; // -> data/taxonomy.ts PlantType
  speciesName: string;
  variety?: string;
  plantationDate: string; // ISO date
  seedlingAgeMonths?: number;
  quantity: number;
  /** Max 3 photos per plant entry, per spec. */
  photos: PhotoRecord[];
  validationStatus: 'pending' | 'validated' | 'rejected';
}

// ---------- Plantation Site ----------

export interface PlantationSite {
  site_id: string;
  location: SiteLocation;
  geofence: GeofenceData;
  environmental: EnvironmentalIntel;
  plants: PlantEntry[];
}

// ---------- Personnel (Step 3) ----------
// One Personnel record per site (planter/caretaker are site-specific,
// not submission-wide — matches the DB model in the spec: site_id FK).

export interface Personnel {
  site_id: string;
  planterName: string;
  planterMobile: string;
  caretakerSameAsPlanter: boolean;
  caretakerName: string;
  caretakerMobile: string;
}

// ---------- Submission (Step 4) ----------

export type SubmissionStatus = 'pending_validation';

export interface SubmissionInfo {
  submittedById: string;
  submittedByName: string;
  office: string;
  submissionDate: string; // ISO datetime
  status: SubmissionStatus;
}

// ---------- Draft (offline autosave unit) ----------

export type DraftStatus = 'DRAFT' | 'READY_FOR_SUBMISSION' | 'SYNC_PENDING' | 'SUBMITTED';

export interface SubmissionDraft {
  draft_id: string; // local id, stable across autosaves
  submission_id?: string; // assigned once finalized
  sites: PlantationSite[];
  /** One Personnel record per site (keyed by site_id via Personnel.site_id),
   *  stored as a flat array rather than nested under PlantationSite so a
   *  site created before Personnel is filled in doesn't need a placeholder
   *  Personnel object threaded through every site mutation. */
  personnel: Personnel[];
  submissionInfo?: SubmissionInfo;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------- Factory helpers ----------

export function createEmptyGeofence(lat = 0, lng = 0): GeofenceData {
  return { mode: 'single_tree', latitude: lat, longitude: lng };
}

export function createEmptyLocation(): SiteLocation {
  return {
    latitude: 0,
    longitude: 0,
    accuracy: 0,
    manuallyAdjusted: false,
    division: '',
    district: '',
    upazila: '',
    union: '',
    villageOrRoad: '',
    postalCode: '',
    fullAddress: '',
  };
}

export function createEmptySite(): PlantationSite {
  return {
    site_id: crypto.randomUUID(),
    location: createEmptyLocation(),
    geofence: createEmptyGeofence(),
    environmental: {
      ndvi: null,
      ndviLoading: false,
      carbonEstimateTons: null,
      carbonLoading: false,
    },
    plants: [],
  };
}

export function createEmptyPlant(): PlantEntry {
  return {
    plant_id: crypto.randomUUID(),
    category: '',
    speciesName: '',
    plantationDate: new Date().toISOString().slice(0, 10),
    quantity: 1,
    photos: [],
    validationStatus: 'pending',
  };
}

export function createEmptyPersonnel(site_id: string): Personnel {
  return {
    site_id,
    planterName: '',
    planterMobile: '',
    caretakerSameAsPlanter: false,
    caretakerName: '',
    caretakerMobile: '',
  };
}

export function createEmptyDraft(): SubmissionDraft {
  const now = new Date().toISOString();
  const firstSite = createEmptySite();
  return {
    draft_id: crypto.randomUUID(),
    sites: [firstSite],
    personnel: [createEmptyPersonnel(firstSite.site_id)],
    status: 'DRAFT',
    createdAt: now,
    updatedAt: now,
  };
}
