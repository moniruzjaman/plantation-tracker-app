/**
 * Color palette for Kurigram's 9 upazilas, used to color-code plantation
 * submission markers on the map (one distinct color per upazila, so an
 * officer can visually cluster/scan by area at a glance).
 *
 * Source list: src/data/geoData.ts -> DISTRICT_UPAZILAS['কুড়িগ্রাম']
 */

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

export const UPAZILA_COLORS: Record<string, string> = {
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

export const DEFAULT_MARKER_COLOR = '#64748b'; // slate-500, fallback for unmatched/blank upazila

export function colorForUpazila(upazila: string | undefined | null): string {
  if (!upazila) return DEFAULT_MARKER_COLOR;
  return UPAZILA_COLORS[upazila] ?? DEFAULT_MARKER_COLOR;
}
