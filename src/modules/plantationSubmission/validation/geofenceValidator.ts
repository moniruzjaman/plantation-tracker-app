/**
 * Geofence Validation Engine.
 *
 * Runs the automatic checks the spec calls for and rolls them into a
 * single 0-100 score with a risk tier and a plain-language recommendation
 * for the SAAO reviewing this submission (see services/validationRouter.ts
 * for who that SAAO is). This does NOT approve/reject anything itself —
 * it's a decision-support score attached to the submission at creation
 * time, same spirit as a fraud-risk score: cheap early signal, human
 * still decides.
 */

import { db } from '../../../lib/db';
import { distanceMeters } from '../../../utils/photoEvidence';
import { KURIGRAM_UPAZILAS } from '../../../utils/upazilaColors';
import { isWithinBangladesh, isWithinKurigramDistrict } from '../../../data/kurigramUpazilaBounds';
import { isWithinUpazilaPolygon, findContainingUpazila } from '../../../data/kurigramUpazilaPolygons';
import { canonicalizeUpazila } from '../../../utils/canonicalizeUpazila';
import type { PlantationSite } from '../types/submission';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface CheckResult {
  key: string;
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface GeofenceValidationResult {
  score: number; // 0-100
  maxScore: number;
  risk: RiskLevel;
  recommendation: string;
  checks: CheckResult[];
}

const NEARBY_SEARCH_RADIUS_METERS = 200;
/** Distance under which two entries of an overlapping species are treated
 *  as the same physical planting rather than a separate one — same
 *  threshold philosophy as the VM0047 checkpoint geofence check. */
const DUPLICATE_DISTANCE_METERS = 15;

export function scoreGpsAccuracy(accuracy: number): CheckResult {
  const maxPoints = 15;
  let points = 0;
  let detail: string;
  if (accuracy <= 10) {
    points = 15;
    detail = `±${Math.round(accuracy)}m — চমৎকার`;
  } else if (accuracy <= 20) {
    points = 12;
    detail = `±${Math.round(accuracy)}m — ভালো`;
  } else if (accuracy <= 50) {
    points = 6;
    detail = `±${Math.round(accuracy)}m — মাঝারি`;
  } else {
    points = 0;
    detail = `±${Math.round(accuracy)}m — দুর্বল, পুনরায় ক্যাপচার করুন`;
  }
  return { key: 'gps_accuracy', label: 'GPS নির্ভুলতা', passed: points > 0, points, maxPoints, detail };
}

/** Checks only that the declared upazila NAME is a real Kurigram upazila
 *  (catches typos/free-text mistakes). This does NOT verify the GPS point
 *  is actually inside that upazila — see scoreGeoBoundary for that. */
export function scoreBoundaryMatch(site: PlantationSite): CheckResult {
  const maxPoints = 10;
  // Canonicalize defensively -- this runs against whatever's currently in
  // site.location.upazila, which for an older in-progress draft saved
  // before canonicalizeUpazila existed could still hold raw Nominatim
  // text that would otherwise fail this check even for a genuinely valid
  // upazila. See canonicalizeUpazila.ts.
  const canonicalUpazila = canonicalizeUpazila(site.location.upazila);
  const matched = KURIGRAM_UPAZILAS.includes(canonicalUpazila as any);
  return {
    key: 'boundary_match',
    label: 'প্রশাসনিক সীমানা নাম',
    passed: matched,
    points: matched ? maxPoints : 0,
    maxPoints,
    detail: matched ? `"${site.location.upazila}" কুড়িগ্রামের বৈধ উপজেলা নাম` : 'উপজেলা তালিকার সাথে মিলছে না — যাচাই করুন',
  };
}

/**
 * The real check: does the captured GPS point actually fall inside the
 * declared upazila's true polygon boundary? This is what catches an
 * entry where the officer picked the right dropdown value but the device
 * (or a manually pasted coordinate) reads somewhere else — a name match
 * alone (scoreBoundaryMatch above) cannot detect that.
 */
export function scoreGeoBoundary(site: PlantationSite): CheckResult {
  const maxPoints = 20;
  const hasPoint = site.location.latitude !== 0 || site.location.longitude !== 0;
  const { latitude: lat, longitude: lng, upazila: rawUpazila } = site.location;
  const upazila = canonicalizeUpazila(rawUpazila);

  if (!hasPoint) {
    return {
      key: 'geo_boundary_match',
      label: 'GPS-উপজেলা মিল',
      passed: false,
      points: 0,
      maxPoints,
      detail: 'অবস্থান এখনো নির্ধারিত হয়নি',
    };
  }

  const inDeclaredUpazila = isWithinUpazilaPolygon(lat, lng, upazila);
  if (inDeclaredUpazila) {
    return {
      key: 'geo_boundary_match',
      label: 'GPS-উপজেলা মিল',
      passed: true,
      points: maxPoints,
      maxPoints,
      detail: `GPS অবস্থান "${upazila}"-এর প্রকৃত সীমানার মধ্যে`,
    };
  }

  const actualUpazila = findContainingUpazila(lat, lng);
  const detail = actualUpazila
    ? `GPS অবস্থান আসলে "${actualUpazila}"-তে পড়ে, কিন্তু ফর্মে "${upazila}" দেওয়া আছে — যাচাই করুন`
    : `GPS অবস্থান "${upazila}"-এর সীমানার বাইরে এবং কুড়িগ্রামের কোনো উপজেলাতেই নেই`;

  return {
    key: 'geo_boundary_match',
    label: 'GPS-উপজেলা মিল',
    passed: false,
    points: 0,
    maxPoints,
    detail,
  };
}

/**
 * Hard country/district guard rail. Failing this is treated as a strong
 * signal on its own (see the risk override in validateGeofence) — a
 * point genuinely outside Bangladesh is essentially never a legitimate
 * plantation entry, whereas failing the polygon check above can still
 * happen for edge cases (char/border-area plantings, GPS drift).
 */
export function scoreCountryBounds(site: PlantationSite): CheckResult {
  const maxPoints = 15;
  const hasPoint = site.location.latitude !== 0 || site.location.longitude !== 0;
  const { latitude: lat, longitude: lng } = site.location;

  if (!hasPoint) {
    return { key: 'country_bounds', label: 'বাংলাদেশের সীমানা', passed: false, points: 0, maxPoints, detail: 'অবস্থান এখনো নির্ধারিত হয়নি' };
  }
  if (!isWithinBangladesh(lat, lng)) {
    return {
      key: 'country_bounds',
      label: 'বাংলাদেশের সীমানা',
      passed: false,
      points: 0,
      maxPoints,
      detail: '⚠️ GPS অবস্থান বাংলাদেশের বাইরে — এই এন্ট্রি সরাসরি প্রত্যাখ্যান বা ম্যানুয়ালি যাচাই করা প্রয়োজন',
    };
  }
  if (!isWithinKurigramDistrict(lat, lng)) {
    return {
      key: 'country_bounds',
      label: 'বাংলাদেশের সীমানা',
      passed: true,
      points: Math.round(maxPoints * 0.5),
      maxPoints,
      detail: 'বাংলাদেশের মধ্যে আছে, তবে কুড়িগ্রাম জেলার বাইরে — যাচাই করুন',
    };
  }
  return { key: 'country_bounds', label: 'বাংলাদেশের সীমানা', passed: true, points: maxPoints, maxPoints, detail: 'কুড়িগ্রাম জেলার মধ্যে' };
}

async function scoreDuplicateAndProximity(
  site: PlantationSite
): Promise<{ duplicate: CheckResult; proximity: CheckResult; nearbyCount: number }> {
  const hasPoint = site.location.latitude !== 0 || site.location.longitude !== 0;
  const speciesNames = new Set(site.plants.map((p) => p.speciesName).filter(Boolean));

  let nearest: { distance: number; sameSpecies: boolean } | null = null;
  let nearbyCount = 0;

  if (hasPoint) {
    const existing = await db.submissions.toArray();
    for (const sub of existing) {
      if (!sub.latitude || !sub.longitude) continue;
      const d = distanceMeters(site.location.latitude, site.location.longitude, sub.latitude, sub.longitude);
      if (d <= NEARBY_SEARCH_RADIUS_METERS) {
        nearbyCount++;
        const sameSpecies = sub.seedlings.some((s) => speciesNames.has(s.speciesName));
        if (!nearest || d < nearest.distance) {
          nearest = { distance: d, sameSpecies };
        }
      }
    }
  }

  const isDuplicate = !!nearest && nearest.distance <= DUPLICATE_DISTANCE_METERS && nearest.sameSpecies;

  const duplicate: CheckResult = {
    key: 'duplicate_detection',
    label: 'ডুপ্লিকেট শনাক্তকরণ',
    passed: !isDuplicate,
    points: isDuplicate ? 0 : 20,
    maxPoints: 20,
    detail: isDuplicate
      ? `${Math.round(nearest!.distance)}m দূরত্বে একই প্রজাতির বিদ্যমান এন্ট্রি পাওয়া গেছে`
      : 'কাছাকাছি কোনো ডুপ্লিকেট এন্ট্রি পাওয়া যায়নি',
  };

  const proximity: CheckResult = {
    key: 'minimum_distance',
    label: 'ন্যূনতম দূরত্ব',
    passed: !nearest || nearest.distance > DUPLICATE_DISTANCE_METERS,
    points: !nearest || nearest.distance > DUPLICATE_DISTANCE_METERS ? 15 : 5,
    maxPoints: 15,
    detail: nearest
      ? `নিকটতম বিদ্যমান এন্ট্রি ${Math.round(nearest.distance)}m দূরে (${nearbyCount}টি এন্ট্রি ${NEARBY_SEARCH_RADIUS_METERS}m এর মধ্যে)`
      : `${NEARBY_SEARCH_RADIUS_METERS}m এর মধ্যে কোনো বিদ্যমান এন্ট্রি নেই`,
  };

  return { duplicate, proximity, nearbyCount };
}

function scoreNdvi(site: PlantationSite): CheckResult {
  const available = site.environmental.ndvi !== null;
  return {
    key: 'ndvi_availability',
    label: 'NDVI প্রাপ্যতা',
    passed: available,
    points: available ? 15 : 0,
    maxPoints: 15,
    detail: available ? `NDVI = ${site.environmental.ndvi!.toFixed(2)}` : 'NDVI ডেটা পাওয়া যায়নি',
  };
}

function scoreCarbon(site: PlantationSite): CheckResult {
  const available = site.environmental.carbonEstimateTons !== null && site.environmental.carbonEstimateTons > 0;
  return {
    key: 'carbon_availability',
    label: 'কার্বন প্রাক্কলন প্রাপ্যতা',
    passed: available,
    points: available ? 20 : 0,
    maxPoints: 20,
    detail: available ? `${site.environmental.carbonEstimateTons!.toFixed(2)} টন প্রাক্কলিত` : 'কার্বন প্রাক্কলন পাওয়া যায়নি',
  };
}

export async function validateGeofence(site: PlantationSite): Promise<GeofenceValidationResult> {
  const gps = scoreGpsAccuracy(site.location.accuracy);
  const boundary = scoreBoundaryMatch(site);
  const geoBoundary = scoreGeoBoundary(site);
  const country = scoreCountryBounds(site);
  const { duplicate, proximity } = await scoreDuplicateAndProximity(site);
  const ndvi = scoreNdvi(site);
  const carbon = scoreCarbon(site);

  const checks = [gps, boundary, geoBoundary, country, duplicate, proximity, ndvi, carbon];
  const score = checks.reduce((sum, c) => sum + c.points, 0);
  const maxScore = checks.reduce((sum, c) => sum + c.maxPoints, 0);

  let risk: RiskLevel;
  let recommendation: string;
  if (score >= 80) {
    risk = 'low';
    recommendation = 'Recommended for Approval';
  } else if (score >= 60) {
    risk = 'medium';
    recommendation = 'Needs Review';
  } else {
    risk = 'high';
    recommendation = 'Manual Verification Required';
  }

  // Hard override: a point genuinely outside Bangladesh is disqualifying
  // on its own — don't let strong scores elsewhere (good GPS accuracy,
  // no nearby duplicate, etc.) dilute this into a "medium" risk score.
  if (!country.passed) {
    risk = 'high';
    recommendation = 'Rejected — Location Outside Bangladesh, Manual Verification Required';
  }

  return { score, maxScore, risk, recommendation, checks };
}
