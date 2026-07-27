/**
 * Color palette for Kurigram's 9 upazilas, used to color-code plantation
 * submission markers on the map (one distinct color per upazila, so an
 * officer can visually cluster/scan by area at a glance).
 *
 * Source list: src/data/geoData.ts -> DISTRICT_UPAZILAS['কুড়িগ্রাম']
 *
 * NOTE: All keys and lookups are NFC-normalized to avoid Bengali Unicode
 * precomposed/decomposed mismatches (e.g. ড় U+09DC vs ড্ U+09A1+U+09BC)
 * between the Google Sheet data, seedPlantations.ts, and this file.
 */

// ---------- NFC normalization helper ----------
// Bengali text can arrive in either precomposed (NFC) or decomposed (NFD)
// form. JavaScript's === and String.includes() compare code units, so
// "ফুলবাড়ী" (NFC: ড়=U+09DC) won't match "ফুলবাড়ী" (NFD: ড+্=U+09A1+U+09BC)
// unless both sides are normalized to the same form.
const nfck = (s: string): string => s.normalize('NFC');

export const KURIGRAM_UPAZILAS = [
  'সদর',
  'নাগেশ্বরী',
  'ভুরুঙ্গামারী',
  'ফুলবাড়ী',
  'রাজারহাট',
  'চিলমারী',
  'উলিপুর',
  'রৌমারী',
  'চর রাজিবপুর',
] as const;

/** Build the color map with NFC-normalized keys. */
const _RAW: Record<string, string> = {
  'কুড়িগ্রাম সদর': '#2d6a4f',
  'সদর': '#2d6a4f',             // alias — seed data shorthand for কুড়িগ্রাম সদর
  'নাগেশ্বরী': '#1d6fa4',
  'ভুরুঙ্গামারী': '#b5651d',
  'ফুলবাড়ী': '#7b2d8b',
  'রাজারহাট': '#c0392b',
  'চিলমারী': '#2980b9',
  'উলিপুর': '#d68910',
  'রৌমারী': '#117864',
  'রাজিবপুর': '#8e44ad',
  'চর রাজিবপুর': '#8e44ad',  // alias — seed data uses full char name
};

/** NFC-normalized color lookup: guarantees ড় (precomposed) and ড্ (decomposed) both resolve. */
export const UPAZILA_COLORS: Record<string, string> = {};
for (const [k, v] of Object.entries(_RAW)) {
  UPAZILA_COLORS[nfck(k)] = v;
}

export const DEFAULT_MARKER_COLOR = '#64748b'; // slate-500, fallback for unmatched/blank upazila

export function colorForUpazila(upazila: string | undefined | null): string {
  if (!upazila) return DEFAULT_MARKER_COLOR;
  return UPAZILA_COLORS[nfck(upazila)] ?? DEFAULT_MARKER_COLOR;
}
