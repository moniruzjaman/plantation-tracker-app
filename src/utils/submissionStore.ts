/**
 * Temporary persistence bridge for PlantationSubmission (new format).
 *
 * NOTE: this is localStorage, same as the rest of the app today — it is
 * NOT the Dexie/IndexedDB + real backend sync fix flagged earlier as a
 * gap. This exists only so the newly-mounted native form has somewhere
 * to write on submit. Swap the internals of these two functions for the
 * real store once that rework happens; nothing outside this file should
 * need to change.
 */

import type { PlantationSubmission } from '../types/plantation';

const STORAGE_KEY = 'plantation_v2_submissions';

export function getSubmissions(): PlantationSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PlantationSubmission[]) : [];
  } catch {
    return [];
  }
}

export function saveSubmission(submission: PlantationSubmission): void {
  const all = getSubmissions();
  all.push(submission);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
