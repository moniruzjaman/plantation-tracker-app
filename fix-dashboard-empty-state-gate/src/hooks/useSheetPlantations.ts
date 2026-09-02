import { useCallback, useEffect, useState } from 'react';

/**
 * Live plantation data pulled from the Tree Plantation Reporting Workbook's
 * App_Entry sheet, via the Apps Script web app -> /api/sheet/list proxy
 * (see server.ts and seed/AppsScript.gs). This supersedes the frozen
 * 36-row SEED_PLANTATIONS snapshot on the ম্যাপ tab once it loads
 * successfully -- SEED_PLANTATIONS stays as the offline/first-paint
 * fallback if GAS_WEBHOOK_URL isn't configured or the fetch fails.
 */

export interface SheetSeedling {
  speciesName: string;
  category: string;
  quantity: number;
}

export interface SheetPlantationEntry {
  submissionId: string;
  district: string;
  upazila: string;
  union: string;
  village: string;
  address: string;
  latitude: number;
  longitude: number;
  plantingDate: string;
  farmerName: string;
  farmerMobile: string;
  saaoName: string;
  officerName: string;
  seedlings: SheetSeedling[];
  totalQuantity: number;
}

interface UseSheetPlantationsResult {
  entries: SheetPlantationEntry[];
  loading: boolean;
  error: string | null;
  /** true once at least one successful live fetch has returned entries */
  live: boolean;
  refresh: () => void;
}

const BD_LAT_RANGE: [number, number] = [20, 27];
const BD_LNG_RANGE: [number, number] = [87, 93];

/**
 * Defensively parses a lat/lng value straight off the sheet. Live App_Entry
 * rows collected in the field contain known typos -- comma decimal
 * separators, missing decimal points ("2547209"), and lat/lng that ran
 * together -- some of which predate the normalizeCoord_() fix in
 * AppsScript.gs and are still sitting in older rows. Anything that can't be
 * confidently repaired into the Bangladesh bounding box is dropped rather
 * than plotted somewhere wrong.
 */
function toFiniteCoord(raw: unknown, kind: 'lat' | 'lng'): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const [min, max] = kind === 'lat' ? BD_LAT_RANGE : BD_LNG_RANGE;
  const s = String(raw).trim().replace(',', '.');
  const n = parseFloat(s);
  if (Number.isFinite(n) && n >= min && n <= max) return n;

  const digitsOnly = s.replace(/[^0-9]/g, '');
  if (/^\d{6,8}$/.test(digitsOnly)) {
    const fixed = parseFloat(`${digitsOnly.slice(0, 2)}.${digitsOnly.slice(2)}`);
    if (Number.isFinite(fixed) && fixed >= min && fixed <= max) return fixed;
  }
  return null;
}

export function useSheetPlantations(): UseSheetPlantationsResult {
  const [entries, setEntries] = useState<SheetPlantationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sheet/list');
      const data = await res.json();

      if (data.status === 'disabled') {
        setEntries([]);
        setLive(false);
        return;
      }
      if (data.ok === false && !Array.isArray(data.entries)) {
        throw new Error(data.error || 'Sheet fetch failed');
      }

      const raw: any[] = Array.isArray(data.entries) ? data.entries : [];
      const parsed: SheetPlantationEntry[] = [];
      for (const r of raw) {
        const lat = toFiniteCoord(r.latitude, 'lat');
        const lng = toFiniteCoord(r.longitude, 'lng');
        if (lat === null || lng === null) continue;

        const seedlings: SheetSeedling[] = Array.isArray(r.seedlings)
          ? r.seedlings.map((sd: any) => ({
              speciesName: String(sd.speciesName || ''),
              category: String(sd.category || ''),
              quantity: Number(sd.quantity) || 0,
            }))
          : [];

        parsed.push({
          submissionId: String(r.submissionId || ''),
          district: String(r.district || ''),
          upazila: String(r.upazila || ''),
          union: String(r.union || ''),
          village: String(r.village || ''),
          address: String(r.address || ''),
          latitude: lat,
          longitude: lng,
          plantingDate: String(r.plantingDate || ''),
          farmerName: String(r.farmerName || ''),
          farmerMobile: String(r.farmerMobile || ''),
          saaoName: String(r.saaoName || ''),
          officerName: String(r.officerName || ''),
          seedlings,
          totalQuantity: seedlings.reduce((sum, sd) => sum + sd.quantity, 0),
        });
      }

      setEntries(parsed);
      setLive(parsed.length > 0);
    } catch (err: any) {
      setError(err?.message || 'Sheet fetch failed');
      setLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, loading, error, live, refresh: load };
}
