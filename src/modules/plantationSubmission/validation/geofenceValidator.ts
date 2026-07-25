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

function scoreGpsAccuracy(accuracy: number): CheckResult {
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

function scoreBoundaryMatch(site: PlantationSite): CheckResult {
  const maxPoints = 15;
  const matched = KURIGRAM_UPAZILAS.includes(site.location.upazila as any);
  return {
    key: 'boundary_match',
    label: 'প্রশাসনিক সীমানা মিল',
    passed: matched,
    points: matched ? 15 : 0,
    maxPoints,
    detail: matched ? `"${site.location.upazila}" কুড়িগ্রামের বৈধ উপজেলা` : 'উপজেলা তালিকার সাথে মিলছে না — যাচাই করুন',
  };
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
  const { duplicate, proximity } = await scoreDuplicateAndProximity(site);
  const ndvi = scoreNdvi(site);
  const carbon = scoreCarbon(site);

  const checks = [gps, boundary, duplicate, proximity, ndvi, carbon];
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

  return { score, maxScore, risk, recommendation, checks };
}
