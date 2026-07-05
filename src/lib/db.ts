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

// ---------- Database Schema ----------

class PlantationDB extends Dexie {
  submissions!: EntityTable<PlantationSubmission, 'id'>;

  constructor() {
    super('PlantationTrackerDB');

    // Only declare indexes that are actually queried.
    // 'id' is the primary key (auto-indexed).
    this.version(1).stores({
      submissions: 'id, timestamp, synced, district, upazila',
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

export { db };
export default db;