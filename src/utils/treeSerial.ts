/**
 * VM0047 Census-Based Tree Serial ID Generator
 *
 * Generates unique alphanumeric IDs in the format BD-TREE-XXXXXX
 * for individual tree tracking. Each serial maps to one QR code tag
 * physically attached to a planted seedling.
 *
 * The counter persists in IndexedDB to survive app restarts.
 */

import { db } from '../lib/db';

const SERIAL_KEY = 'tree_serial_counter';
const SERIAL_PREFIX = 'BD-TREE';
const SERIAL_START = 100000; // Start from BD-TREE-100000

// In-memory cache (loaded once per session)
let cachedCounter: number | null = null;

/** Load or initialize the serial counter from IndexedDB */
async function getCounter(): Promise<number> {
  if (cachedCounter !== null) return cachedCounter;

  try {
    // Try reading from a special "key-value" row in userProfile table
    const meta = await db.userProfile.get('serial_meta');
    if (meta && (meta as any).serialCounter) {
      cachedCounter = (meta as any).serialCounter as number;
    } else {
      cachedCounter = SERIAL_START;
    }
  } catch {
    cachedCounter = SERIAL_START;
  }

  return cachedCounter;
}

/** Persist the counter back to IndexedDB */
async function saveCounter(value: number): Promise<void> {
  cachedCounter = value;
  try {
    await db.userProfile.put({
      id: 'serial_meta',
      name: '',
      mobile: '',
      role: 'citizen',
      serialCounter: value,
    } as any);
  } catch (err) {
    console.warn('[TreeSerial] Failed to persist counter:', err);
  }
}

/**
 * Generate the next unique tree serial ID.
 * Format: BD-TREE-100001, BD-TREE-100002, ...
 */
export async function generateTreeSerial(): Promise<string> {
  const current = await getCounter();
  const next = current + 1;
  await saveCounter(next);
  return `${SERIAL_PREFIX}-${next}`;
}

/**
 * Parse a tree serial back into its components.
 * Returns null if the serial format is invalid.
 */
export function parseTreeSerial(serial: string): { prefix: string; number: number } | null {
  const match = serial.match(/^BD-TREE-(\d+)$/);
  if (!match) return null;
  return { prefix: 'BD-TREE', number: parseInt(match[1]) };
}

/**
 * Validate a tree serial format (without checking existence).
 */
export function isValidTreeSerial(serial: string): boolean {
  return /^BD-TREE-\d{6,}$/.test(serial);
}

/**
 * Generate a Modelling Unit ID for Gold Standard carbon grouping.
 * Groups submissions with same species + district + planting month + entry mode.
 *
 * Format: district::YYYY-MM::entryMode::speciesSignature
 */
export function generateModellingUnitId(
  district: string,
  plantationDate: string,
  entryMode: string,
  speciesNames: string[]
): string {
  const monthKey = plantationDate?.slice(0, 7) || 'unknown';
  const speciesKey = [...speciesNames].sort().join('+').slice(0, 80);
  return `${district}::${monthKey}::${entryMode}::${speciesKey}`;
}