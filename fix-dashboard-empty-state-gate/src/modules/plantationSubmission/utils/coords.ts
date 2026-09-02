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
