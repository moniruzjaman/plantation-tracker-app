import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { validateGeofence } from '../geofenceValidator';
import { createEmptySite } from '../../types/submission';

function siteAt(lat: number, lng: number, upazila: string) {
  const site = createEmptySite();
  site.location.latitude = lat;
  site.location.longitude = lng;
  site.location.upazila = upazila;
  site.location.accuracy = 8;
  return site;
}

describe('validateGeofence (full pipeline)', () => {
  it('scores a clean, well-located submission as low risk', async () => {
    const site = siteAt(25.817, 89.65, 'কুড়িগ্রাম সদর');
    const result = await validateGeofence(site);
    expect(result.risk).toBe('low');
  });

  it('forces high risk for a point outside Bangladesh, even though nothing else about the submission is suspicious', async () => {
    // Good GPS accuracy, no duplicates nearby -- everything else about
    // this submission looks clean. Only the location itself is wrong.
    // This is the behavior that matters most: a good score elsewhere
    // must never dilute an out-of-country point down to "medium".
    const site = siteAt(29.5, 89.7, 'কুড়িগ্রাম সদর'); // well north of the border, into India
    const result = await validateGeofence(site);
    expect(result.risk).toBe('high');
    expect(result.recommendation).toContain('Outside Bangladesh');
  });

  it('flags (but does not hard-reject) a name/GPS upazila mismatch inside the country', async () => {
    const site = siteAt(25.9792, 89.7083, 'কুড়িগ্রাম সদর'); // Nageshwari's coords, Sadar's label
    const result = await validateGeofence(site);
    const geoCheck = result.checks.find((c) => c.key === 'geo_boundary_match');
    expect(geoCheck?.passed).toBe(false);
    // still in-country and in-district, so this alone should not force 'high'
    expect(result.risk).not.toBe('high');
  });

  it('includes both the name-list check and the real polygon check as separate line items', async () => {
    const site = siteAt(25.817, 89.65, 'কুড়িগ্রাম সদর');
    const result = await validateGeofence(site);
    const keys = result.checks.map((c) => c.key);
    expect(keys).toContain('boundary_match');
    expect(keys).toContain('geo_boundary_match');
    expect(keys).toContain('country_bounds');
  });
});
