/**
 * Plantation Tracker — IndexedDB Database Layer (Dexie)
 *
 * Replaces the previous localStorage-based storage with proper IndexedDB.
 * Benefits:
 * - Storage limit: hundreds of MB to GB+ (vs localStorage's 5-10MB)
 * - Async, non-blocking API
 * - Index-based queries
 * - Structured data with versioned schema
 * - Survives across sessions reliably
 *
 * Data flows:
 *   Form submit → submissionStore.saveSubmission() → db.submissions.put()
 *   Dashboard  → db.submissions.toArray()
 *   Sync queue → db.submissions.where('synced').equals(0).toArray()
 */

import Dexie, { type EntityTable } from 'dexie';
import type { PlantationSubmission } from '../types/plantation';
import type { UserProfile } from '../types';

// ---------- Submission Token Rewards ----------
// "The more data you provide, the more tokens you earn"
// Each data-richness dimension awards tokens/XP independently.

export interface SubmissionReward {
  xp: number;
  tokens: number;
  breakdown: { label: string; xp: number; tokens: number }[];
}

export function getSubmissionReward(sub: PlantationSubmission): SubmissionReward {
  const breakdown: SubmissionReward['breakdown'] = [];
  let xp = 0;
  let tokens = 0;

  const add = (label: string, x: number, t: number) => {
    if (x > 0 || t > 0) {
      breakdown.push({ label, xp: x, tokens: t });
      xp += x;
      tokens += t;
    }
  };

  // Base submission
  add('ফর্ম জমা', 10, 2);

  // Location completeness
  const locFields = [sub.region, sub.district, sub.upazila, sub.union, sub.village].filter(Boolean).length;
  if (locFields >= 5) add('সম্পূর্ণ অবস্থান', 5, 3);
  else if (locFields >= 3) add('আংশিক অবস্থান', 2, 1);

  // Planting GPS
  if (sub.latitude && sub.longitude && sub.accuracy < 100) {
    add('রোপণ GPS (নির্ভুল)', 5, 2);
  } else if (sub.latitude && sub.longitude) {
    add('রোপণ GPS', 3, 1);
  }

  // Verification GPS (extra effort)
  if (sub.verificationLatitude && sub.verificationLongitude) {
    add('যাচাইকরণ GPS', 8, 3);
  }

  // Species data
  if (sub.seedlings.length > 0) {
    const totalCount = sub.seedlings.reduce((sum, s) => sum + s.count, 0);
    const speciesCount = sub.seedlings.length;
    add(`${speciesCount}টি প্রজাতি, ${totalCount}টি চারা`, 5 + Math.min(speciesCount * 2, 10), 2 + Math.min(speciesCount, 5));
  }

  // Photo evidence
  if (sub.photos.length > 0) {
    add(`${sub.photos.length}টি ছবি প্রমাণ`, 5 + sub.photos.length * 2, 2 + sub.photos.length);
  }

  // Caretaker info
  if (sub.caretakerName && sub.caretakerMobile) {
    add('পরিচর্যাকারীর তথ্য', 3, 1);
  }

  // SAAO info
  if (sub.saaoName || sub.saaoId) {
    add('SAAO তথ্য', 3, 1);
  }

  // Monitoring officer
  if (sub.monitoringOfficerName || sub.monitoringOfficerId) {
    add('মনিটরিং অফিসার', 3, 1);
  }

  // Area measurement
  if (sub.areaSqMeters && sub.areaSqMeters > 0) {
    add('এলাকার পরিমাপ', 3, 1);
  }

  // Date (non-default)
  if (sub.plantationDate && sub.plantationDate !== new Date().toISOString().slice(0, 10)) {
    add('তারিখ নির্ধারণ', 1, 0);
  }

  // Nursery source
  if (sub.nurserySourceName) {
    add('চারার উৎস', 2, 1);
  }

  // Remarks
  if (sub.remarks?.trim()) {
    add('মন্তব্য', 1, 0);
  }

  // VM0047 compliance rewards
  if (sub.treeSerial) {
    add('ট্রি সিরিয়াল আইডি', 5, 2);
  }
  if (sub.photos.length >= 3) {
    const types = new Set(sub.photos.map(p => p.photoType).filter(Boolean));
    if (types.has('qr_closeup') && types.has('full_tree') && types.has('context')) {
      add('VM0047 ৩-ফটো প্রমাণ', 10, 5);
    }
  }
  if (sub.trackingMethod === 'area' && sub.geoPolygon) {
    add('এরিয়া-বেসড ট্র্যাকিং', 8, 3);
  }
  if (sub.modellingUnitId) {
    add('মডেলিং ইউনিট', 3, 1);
  }

  return { xp, tokens, breakdown };
}

// ---------- Database Schema ----------

class PlantationDB extends Dexie {
  submissions!: EntityTable<PlantationSubmission, 'id'>;
  userProfile!: EntityTable<UserProfile, 'id'>;

  constructor() {
    super('PlantationTrackerDB');

    // v1: original submissions table
    this.version(1).stores({
      submissions: 'id, timestamp, synced, district, upazila',
    });

    // v2: add userProfile table (single row, keyed by 'current')
    this.version(2).stores({
      submissions: 'id, timestamp, synced, district, upazila',
      userProfile: 'id, mobile, role',
    });
  }
}

// Singleton instance
const db = new PlantationDB();

// ---------- Migration: one-time copy from localStorage → IndexedDB ----------
// This runs once on first load after the upgrade to move existing data.

const MIGRATION_FLAG = 'indexeddb_migrated_v1';

export async function migrateFromLocalStorage(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  try {
    // Migrate plantation_v2_submissions
    const rawV2 = localStorage.getItem('plantation_v2_submissions');
    if (rawV2) {
      const items: PlantationSubmission[] = JSON.parse(rawV2);
      if (items.length > 0) {
        await db.submissions.bulkPut(items);
        console.log(`[DB Migration] Imported ${items.length} submissions from localStorage (plantation_v2_submissions)`);
      }
    }

    // Migrate PlantationDatabase_drafts
    const rawDrafts = localStorage.getItem('PlantationDatabase_drafts');
    if (rawDrafts) {
      const drafts: PlantationSubmission[] = JSON.parse(rawDrafts);
      if (drafts.length > 0) {
        await db.submissions.bulkPut(drafts);
        console.log(`[DB Migration] Imported ${drafts.length} drafts from localStorage (PlantationDatabase_drafts)`);
      }
    }

    // Mark migration as complete
    localStorage.setItem(MIGRATION_FLAG, 'true');
    console.log('[DB Migration] Complete — all data now in IndexedDB');
  } catch (err) {
    console.error('[DB Migration] Failed:', err);
    // Don't set the flag so we retry next time
  }
}

// ---------- Public API (drop-in replacement for localStorage functions) ----------

/** Save a single submission (upsert by id) */
export async function saveSubmission(submission: PlantationSubmission): Promise<void> {
  await db.submissions.put(submission);
}

/** Get all submissions, newest first */
export async function getSubmissions(): Promise<PlantationSubmission[]> {
  return db.submissions.orderBy('timestamp').reverse().toArray();
}

/** Get only unsynced submissions */
export async function getUnsyncedSubmissions(): Promise<PlantationSubmission[]> {
  return db.submissions.where('synced').equals(0).toArray();
}

/** Mark a submission as synced */
export async function markAsSynced(id: string): Promise<void> {
  await db.submissions.update(id, { synced: true });
}

/** Delete a submission by id */
export async function deleteSubmission(id: string): Promise<void> {
  await db.submissions.delete(id);
}

/** Count total submissions */
export async function countSubmissions(): Promise<number> {
  return db.submissions.count();
}

/** Count unsynced submissions */
export async function countUnsynced(): Promise<number> {
  return db.submissions.where('synced').equals(0).count();
}

/** Bulk save (for sync queue import) */
export async function bulkSaveSubmissions(items: PlantationSubmission[]): Promise<void> {
  await db.submissions.bulkPut(items);
}

/** Clear all data (for testing/admin) */
export async function clearAllSubmissions(): Promise<void> {
  await db.submissions.clear();
}

// ---------- User Profile API ----------

const PROFILE_KEY = 'current'; // single-user app: one profile row

/** Get the current user profile (null if not registered) */
export async function getUserProfile(): Promise<UserProfile | null> {
  return db.userProfile.get(PROFILE_KEY) ?? null;
}

/** Save or update the user profile */
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await db.userProfile.put(profile);
}

/** Calculate profile completeness percentage */
export function getProfileCompleteness(p: Partial<UserProfile>): number {
  let filled = 0;
  let total = 4; // name, mobile, nid are required; jobId is bonus
  if (p.name?.trim()) filled++;
  if (p.mobile?.trim()) filled++;
  if (p.nid?.trim()) filled++;
  if (p.jobId?.trim()) filled++;
  if (p.designation?.trim()) filled++;
  if (p.district?.trim()) filled++;
  if (p.upazila?.trim()) filled++;
  total = 7;
  return Math.round((filled / total) * 100);
}

/** Tokens earned based on profile field completeness */
export function getProfileTokenReward(p: Partial<UserProfile>): number {
  let tokens = 0;
  if (p.name?.trim()) tokens += 5;
  if (p.mobile?.trim()) tokens += 5;
  if (p.nid?.trim()) tokens += 10;
  if (p.jobId?.trim()) tokens += 10;
  if (p.designation?.trim()) tokens += 5;
  if (p.district?.trim()) tokens += 3;
  if (p.upazila?.trim()) tokens += 2;
  return tokens;
}

export { db };
export default db;