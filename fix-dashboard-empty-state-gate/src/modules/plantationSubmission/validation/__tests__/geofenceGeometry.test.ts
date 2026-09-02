import { describe, it, expect } from 'vitest';
import { isWithinUpazilaPolygon, findContainingUpazila } from '../../../../data/kurigramUpazilaPolygons';
import { isWithinBangladesh, isWithinKurigramDistrict } from '../../../../data/kurigramUpazilaBounds';

describe('isWithinUpazilaPolygon', () => {
  it('accepts a point at the declared upazila\'s own center', () => {
    // কুড়িগ্রাম সদর approximate center
    expect(isWithinUpazilaPolygon(25.817, 89.65, 'কুড়িগ্রাম সদর')).toBe(true);
  });

  it('rejects a point that is actually in a different upazila', () => {
    // Nageshwari's center, checked against Kurigram Sadar's polygon
    expect(isWithinUpazilaPolygon(25.9792, 89.7083, 'কুড়িগ্রাম সদর')).toBe(false);
  });

  it('rejects a point clearly outside Bangladesh entirely', () => {
    expect(isWithinUpazilaPolygon(26.5, 89.7, 'ভুরুঙ্গামারী')).toBe(false);
  });

  it('does not flag (returns true) for an unrecognized upazila name -- missing data is never a false positive', () => {
    expect(isWithinUpazilaPolygon(25.817, 89.65, 'অজানা উপজেলা')).toBe(true);
  });

  it('does not flag an empty upazila string', () => {
    expect(isWithinUpazilaPolygon(25.817, 89.65, '')).toBe(true);
  });
});

describe('findContainingUpazila', () => {
  it('identifies the correct upazila for a known point', () => {
    expect(findContainingUpazila(25.6633, 89.633)).toBe('উলিপুর');
  });

  it('returns null for a point in none of Kurigram\'s upazilas', () => {
    expect(findContainingUpazila(23.81, 90.41)).toBe(null); // Dhaka
  });
});

describe('isWithinBangladesh', () => {
  it('accepts a point well inside the country', () => {
    expect(isWithinBangladesh(25.817, 89.65)).toBe(true);
  });

  it('rejects a point in India, well north of the border', () => {
    expect(isWithinBangladesh(29.5, 89.7)).toBe(false);
  });

  it('rejects the (0, 0) null-island sentinel some GPS failures produce', () => {
    expect(isWithinBangladesh(0, 0)).toBe(false);
  });

  it('rejects NaN coordinates rather than throwing', () => {
    expect(isWithinBangladesh(NaN, NaN)).toBe(false);
  });
});

describe('isWithinKurigramDistrict', () => {
  it('accepts a point inside Kurigram district', () => {
    expect(isWithinKurigramDistrict(25.817, 89.65)).toBe(true);
  });

  it('rejects a point inside Bangladesh but outside Kurigram (e.g. Dhaka)', () => {
    expect(isWithinKurigramDistrict(23.81, 90.41)).toBe(false);
  });
});
