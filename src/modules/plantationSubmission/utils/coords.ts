/**
 * All GPS coordinates captured anywhere in the plantation submission
 * module (device GPS, manual paste, map tap/drag) are rounded to exactly
 * 7 decimal digits — survey-grade precision (~1.1cm at the equator), the
 * standard used across DAE's other geo-tagged registries. This also keeps
 * stored values from carrying the ~15-digit float noise a raw
 * `navigator.geolocation` reading or a Leaflet drag event returns, which
 * is meaningless beyond the device's actual GPS accuracy but looks like
 * false precision in the review screen / exported data.
 */
export function roundCoord(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

export function roundLatLng(lat: number, lng: number): { lat: number; lng: number } {
  return { lat: roundCoord(lat), lng: roundCoord(lng) };
}

/** Fixed 7-decimal string for display, e.g. "25.8103123". */
export function formatCoord(value: number): string {
  return value.toFixed(7);
}

// ---------- GPS accuracy quality gate ----------
//
// A `navigator.geolocation` reading's `accuracy` is a 1-sigma radius in
// meters, not a hard guarantee — but a >30m reading is common evidence of
// indoor/urban-canyon signal, an old cached fix, or a spoofed/emulated
// location, any of which produces a plantation record whose "±30m" pin
// could easily land on the wrong farmer's plot. Rather than silently
// accepting whatever the device returns, a poor reading requires the
// officer to either retry (device fixes usually improve within a few
// seconds outdoors) or explicitly confirm they're using it anyway.

export const GPS_ACCURACY_GOOD_M = 15;
export const GPS_ACCURACY_WARN_M = 30;

export type AccuracyQuality = 'good' | 'fair' | 'poor';

export function classifyAccuracy(accuracyMeters: number): AccuracyQuality {
  if (accuracyMeters <= GPS_ACCURACY_GOOD_M) return 'good';
  if (accuracyMeters <= GPS_ACCURACY_WARN_M) return 'fair';
  return 'poor';
}
