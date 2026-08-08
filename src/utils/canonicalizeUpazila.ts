import { KURIGRAM_UPAZILAS } from './upazilaColors';

/**
 * Reconciles a "wild" upazila string -- from Nominatim's reverse-geocode
 * response (addr.county/municipality/city_district, raw OSM Bengali
 * tagging, not guaranteed to match this app's spelling), or from an
 * officer's own manual edit -- against this app's canonical
 * KURIGRAM_UPAZILAS list.
 *
 * WHY THIS EXISTS: SiteStep.tsx sets site.location.upazila directly from
 * Nominatim's response with no validation (see services/nominatim.ts).
 * Two entries that are unambiguously "the same real upazila" to a human
 * can therefore end up stored as byte-different strings -- either a
 * genuine OSM spelling variant, or the same Unicode text in a different
 * normalization form (NFC vs NFD -- this bit the district boundary data
 * earlier and is exactly as likely to bite free-text geocoder output).
 * Every exact-string comparison downstream (map filter pills, marker
 * color lookup, geofence upazila-match checks) then silently fails for
 * that entry, even though a person reading it would say it's obviously
 * "ফুলবাড়ী".
 *
 * Returns the canonical KURIGRAM_UPAZILAS spelling if a confident match
 * is found, otherwise returns the input unchanged (never silently blanks
 * or guesses wrong -- an unmatched value just won't get upazila-based
 * filtering/coloring/geofencing, same graceful-degradation behavior used
 * elsewhere in this codebase for unrecognized upazilas).
 */
export function canonicalizeUpazila(raw: string | undefined | null): string {
  if (!raw) return raw ?? '';
  const input = raw.normalize('NFC').trim();
  if (!input) return input;

  // 1. Exact match (common case once data is clean).
  if ((KURIGRAM_UPAZILAS as readonly string[]).includes(input)) return input;

  // 2. Normalized-variant match: collapse common Bengali vowel-sign
  //    drift (ী/ি, ৌ/ো, ূ/ু) that shows up across independently
  //    maintained Bengali text sources.
  const collapse = (s: string) => s.replace(/ী/g, 'ি').replace(/ৌ/g, 'ো').replace(/ূ/g, 'ু').replace(/\s+/g, '');
  const inputCollapsed = collapse(input);
  const variantMatch = KURIGRAM_UPAZILAS.find((u) => collapse(u) === inputCollapsed);
  if (variantMatch) return variantMatch;

  // 3. Substring containment either direction -- handles cases like
  //    Nominatim returning "চর রাজিবপুর উপজেলা" (extra words) or a
  //    genuine short-form/long-form naming difference.
  const containment = KURIGRAM_UPAZILAS.find((u) => {
    const uc = collapse(u);
    return inputCollapsed.includes(uc) || uc.includes(inputCollapsed);
  });
  if (containment) return containment;

  // No confident match -- return as-is rather than guessing wrong.
  return input;
}
