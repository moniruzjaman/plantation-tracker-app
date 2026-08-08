import { describe, it, expect } from 'vitest';
import { scoreGpsAccuracy, scoreBoundaryMatch, scoreGeoBoundary, scoreCountryBounds } from '../geofenceValidator';
import { createEmptySite } from '../../types/submission';

function siteAt(lat: number, lng: number, upazila: string) {
  const site = createEmptySite();
  site.location.latitude = lat;
  site.location.longitude = lng;
  site.location.upazila = upazila;
  return site;
}

describe('scoreGpsAccuracy', () => {
  it('gives full points for tight accuracy', () => {
    expect(scoreGpsAccuracy(5).points).toBe(scoreGpsAccuracy(5).maxPoints);
  });

  it('gives fewer points as accuracy worsens', () => {
    expect(scoreGpsAccuracy(100).points).toBeLessThan(scoreGpsAccuracy(5).points);
  });
});

describe('scoreBoundaryMatch (name-only check)', () => {
  it('passes for a real Kurigram upazila name regardless of the actual GPS point', () => {
    // deliberately wrong coordinates (India) -- this check only looks at the name string
    const site = siteAt(27.0, 89.7, 'কুড়িগ্রাম সদর');
    expect(scoreBoundaryMatch(site).passed).toBe(true);
  });

  it('fails for an unrecognized upazila name', () => {
    const site = siteAt(25.817, 89.65, 'ভুয়া উপজেলা');
    expect(scoreBoundaryMatch(site).passed).toBe(false);
  });
});

describe('scoreGeoBoundary (the actual point-in-polygon check)', () => {
  it('passes when the GPS point genuinely falls inside the declared upazila', () => {
    const site = siteAt(25.817, 89.65, 'কুড়িগ্রাম সদর'); // Kurigram Sadar's own center
    const result = scoreGeoBoundary(site);
    expect(result.passed).toBe(true);
    expect(result.points).toBe(result.maxPoints);
  });

  it('fails when the name is right but the GPS point is actually somewhere else -- this is the case scoreBoundaryMatch alone cannot catch', () => {
    const site = siteAt(25.9792, 89.7083, 'কুড়িগ্রাম সদর'); // this is Nageshwari's center, not Sadar's
    const result = scoreGeoBoundary(site);
    expect(result.passed).toBe(false);
    expect(result.points).toBe(0);
    // the mismatch detail should name the upazila the point is ACTUALLY in
    expect(result.detail).toContain('নাগেশ্বরী');
  });

  it('does not award points for an unset (0,0) location', () => {
    const site = siteAt(0, 0, 'কুড়িগ্রাম সদর');
    expect(scoreGeoBoundary(site).passed).toBe(false);
  });
});

describe('scoreCountryBounds', () => {
  it('gives full points inside Kurigram district', () => {
    const site = siteAt(25.817, 89.65, 'কুড়িগ্রাম সদর');
    const result = scoreCountryBounds(site);
    expect(result.passed).toBe(true);
    expect(result.points).toBe(result.maxPoints);
  });

  it('gives partial credit inside Bangladesh but outside Kurigram', () => {
    const site = siteAt(23.81, 90.41, 'কুড়িগ্রাম সদর'); // Dhaka coordinates, mismatched upazila label
    const result = scoreCountryBounds(site);
    expect(result.passed).toBe(true);
    expect(result.points).toBeGreaterThan(0);
    expect(result.points).toBeLessThan(result.maxPoints);
  });

  it('fails hard for a point outside Bangladesh entirely', () => {
    const site = siteAt(29.5, 89.7, 'কুড়িগ্রাম সদর'); // well north of the border, into India
    const result = scoreCountryBounds(site);
    expect(result.passed).toBe(false);
    expect(result.points).toBe(0);
  });
});
