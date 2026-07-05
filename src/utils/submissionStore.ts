/**
 * Submission persistence bridge — now backed by IndexedDB (Dexie).
 *
 * Previous version used localStorage with key 'plantation_v2_submissions'.
 * This file now delegates to src/lib/db.ts (IndexedDB) while keeping the
 * same function signatures so callers don't need to change.
 *
 * The first time the app loads after this upgrade, migrateFromLocalStorage()
 * in db.ts will copy any existing localStorage data into IndexedDB.
 */

import type { PlantationSubmission } from '../types/plantation';
import {
  saveSubmission as dbSave,
  getSubmissions as dbGetAll,
  migrateFromLocalStorage,
} from '../lib/db';

// Trigger migration on first import
let migrationPromise: Promise<void> | null = null;

function ensureMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateFromLocalStorage();
  }
  return migrationPromise;
}

/**
 * Get all submissions from IndexedDB.
 * Returns empty array if DB is not ready.
 */
export async function getSubmissions(): Promise<PlantationSubmission[]> {
  try {
    await ensureMigrated();
    return await dbGetAll();
  } catch (e) {
    console.error('Failed to read submissions from IndexedDB:', e);
    return [];
  }
}

/**
 * Save a submission to IndexedDB.
 * Fire-and-forget (errors are logged but don't block UI).
 */
export function saveSubmission(submission: PlantationSubmission): void {
  ensureMigrated()
    .then(() => dbSave(submission))
    .catch((e) => console.error('Failed to save submission to IndexedDB:', e));
}