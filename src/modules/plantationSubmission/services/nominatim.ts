/**
 * Reverse geocoding via OpenStreetMap's Nominatim, used to auto-populate
 * Division/District/Upazila/Union/Village/Postcode/Address from a GPS
 * point in SiteStep. All fields stay editable after autofill — this is a
 * convenience prefill, not a source of truth.
 *
 * Nominatim's usage policy requires: max 1 req/sec, a descriptive
 * User-Agent isn't settable from browser fetch (blocked header), so we
 * rely on the Referer instead — acceptable for low-volume field-officer
 * usage. Results are cached in-memory by rounded coordinate so repeated
 * small nudges of the map pin don't re-hit the API.
 */

export interface ReverseGeocodeResult {
  division: string;
  district: string;
  upazila: string;
  union: string;
  villageOrRoad: string;
  postalCode: string;
  fullAddress: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

// Cache keyed by coordinates rounded to ~11m precision (4 decimal places).
const cache = new Map<string, ReverseGeocodeResult>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/** Bangladesh admin levels don't map 1:1 onto Nominatim's address fields
 *  everywhere, so this picks the best-available field per DAE level with
 *  sensible fallbacks rather than assuming one fixed key is always present. */
function mapNominatimAddress(addr: Record<string, string>): ReverseGeocodeResult {
  return {
    division: addr.state || addr.region || '',
    district: addr.state_district || addr.county || '',
    upazila: addr.county || addr.municipality || addr.city_district || '',
    union: addr.suburb || addr.village || addr.hamlet || '',
    villageOrRoad: addr.village || addr.hamlet || addr.road || '',
    postalCode: addr.postcode || '',
    fullAddress: '',
  };
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const key = cacheKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached) return cached;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    // Offline: return an empty result rather than throwing, so the wizard
    // still works — officer falls back to manual entry.
    return { division: '', district: '', upazila: '', union: '', villageOrRoad: '', postalCode: '', fullAddress: '' };
  }

  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=bn`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    const mapped = mapNominatimAddress(data.address || {});
    mapped.fullAddress = data.display_name || '';
    cache.set(key, mapped);
    return mapped;
  } catch (err) {
    console.warn('[nominatim] reverse geocode failed, falling back to manual entry', err);
    return { division: '', district: '', upazila: '', union: '', villageOrRoad: '', postalCode: '', fullAddress: '' };
  }
}
