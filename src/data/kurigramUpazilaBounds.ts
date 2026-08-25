/**
 * Geographic bounding-box extents for Kurigram's 9 upazilas, plus a
 * Bangladesh-wide bounding box. Used to sanity-check that a submitted GPS
 * point actually falls near the officer's declared upazila/country,
 * instead of only checking that the declared upazila *name* is spelled
 * correctly (see geofenceValidator.ts's old scoreBoundaryMatch, which only
 * ever checked the string against KURIGRAM_UPAZILAS).
 *
 * SOURCE: Banglapedia (en.banglapedia.org), per-upazila "located in
 * between X and Y north latitudes / A and B east longitudes" figures,
 * Bangladesh Population Census 2011 data. Degree-minute values converted
 * to decimal degrees.
 *
 * IMPORTANT LIMITATION: these are rectangular bounding boxes, not the
 * true (irregular) upazila polygon boundaries. Adjacent upazilas'
 * boxes overlap somewhat near shared borders, and a point can sit inside
 * a box while actually being in a neighboring upazila (or vice versa)
 * near an edge. Treat a failed check as "needs a second look", not proof
 * of fraud — chars (river islands) and border unions in particular can
 * legitimately sit close to a boundary. A real per-upazila polygon
 * (official BBS/SurveyOfBangladesh shapefile) would remove this
 * ambiguity if it's ever available.
 */

export interface UpazilaBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const KURIGRAM_UPAZILA_BOUNDS: Record<string, UpazilaBounds> = {
  'কুড়িগ্রাম সদর': { minLat: 25.75, maxLat: 25.9167, minLng: 89.5667, maxLng: 89.8333 },
  'নাগেশ্বরী': { minLat: 25.9833, maxLat: 26.2167, minLng: 89.5833, maxLng: 89.8667 },
  'ভুরুঙ্গামারী': { minLat: 26.0333, maxLat: 26.2333, minLng: 89.6, maxLng: 89.8 },
  'ফুলবাড়ী': { minLat: 25.5333, maxLat: 26.0667, minLng: 89.4667, maxLng: 89.6667 },
  'রাজারহাট': { minLat: 25.6333, maxLat: 25.8833, minLng: 89.45, maxLng: 89.6333 },
  'উলিপুর': { minLat: 25.55, maxLat: 25.8167, minLng: 89.4833, maxLng: 89.85 },
  'চিলমারী': { minLat: 25.4333, maxLat: 25.6667, minLng: 89.6333, maxLng: 89.8 },
  'রৌমারী': { minLat: 25.45, maxLat: 25.7167, minLng: 89.75, maxLng: 89.8833 },
  'রাজিবপুর': { minLat: 25.3833, maxLat: 25.5167, minLng: 89.7333, maxLng: 89.9 },
};

/** Whole-district box (union of all 9 upazilas above), for a cheap
 *  "at least in Kurigram district" pre-check. */
export const KURIGRAM_DISTRICT_BOUNDS: UpazilaBounds = {
  minLat: 25.3833,
  maxLat: 26.2333,
  minLng: 89.45,
  maxLng: 89.9,
};

/** Bangladesh-wide box, same figures used by the production map's
 *  isValidBdCoord() (mapHelper.ts) — kept in sync so "in country" means
 *  the same thing everywhere in the app. */
export const BANGLADESH_BOUNDS: UpazilaBounds = { minLat: 20.0, maxLat: 27.5, minLng: 87.5, maxLng: 93.5 };

/** Degrees of buffer added around each upazila box (~2km) to absorb GPS
 *  drift and the fact that these boxes approximate irregular boundaries.
 *  Not applied to the Bangladesh-wide check — that one should stay strict. */
const UPAZILA_BUFFER_DEGREES = 0.02;

export function isWithinBangladesh(lat: number, lng: number): boolean {
  if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return (
    lat >= BANGLADESH_BOUNDS.minLat &&
    lat <= BANGLADESH_BOUNDS.maxLat &&
    lng >= BANGLADESH_BOUNDS.minLng &&
    lng <= BANGLADESH_BOUNDS.maxLng
  );
}

export function isWithinKurigramDistrict(lat: number, lng: number): boolean {
  return (
    lat >= KURIGRAM_DISTRICT_BOUNDS.minLat &&
    lat <= KURIGRAM_DISTRICT_BOUNDS.maxLat &&
    lng >= KURIGRAM_DISTRICT_BOUNDS.minLng &&
    lng <= KURIGRAM_DISTRICT_BOUNDS.maxLng
  );
}

/** Checks a GPS point against the declared upazila's bounding box (with
 *  buffer). Returns true if the upazila name isn't recognized at all —
 *  that case is already caught separately by the plain name-list check,
 *  so this function only rules on geography for known upazilas. */
export function isWithinUpazilaBounds(lat: number, lng: number, upazila: string): boolean {
  const bounds = KURIGRAM_UPAZILA_BOUNDS[upazila];
  if (!bounds) return true;
  return (
    lat >= bounds.minLat - UPAZILA_BUFFER_DEGREES &&
    lat <= bounds.maxLat + UPAZILA_BUFFER_DEGREES &&
    lng >= bounds.minLng - UPAZILA_BUFFER_DEGREES &&
    lng <= bounds.maxLng + UPAZILA_BUFFER_DEGREES
  );
}
