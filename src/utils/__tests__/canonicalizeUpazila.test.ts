import { describe, it, expect } from 'vitest';
import { canonicalizeUpazila } from '../canonicalizeUpazila';

describe('canonicalizeUpazila', () => {
  it('leaves an already-canonical value unchanged', () => {
    expect(canonicalizeUpazila('ফুলবাড়ী')).toBe('ফুলবাড়ী');
  });

  it('resolves a Unicode NFD-form variant to the canonical NFC form', () => {
    // Decomposed ড় (ড + nukta combining mark) instead of the precomposed
    // character -- visually identical, byte-different. This is exactly
    // the class of bug that silently broke the district boundary data
    // earlier this session.
    const nfd = 'ভুরুঙ্গামারী'.normalize('NFD');
    expect(canonicalizeUpazila(nfd)).toBe('ভুরুঙ্গামারী');
  });

  it('resolves a common vowel-sign spelling variant (ী vs ি)', () => {
    expect(canonicalizeUpazila('নাগেশ্বরি')).toBe('নাগেশ্বরী');
  });

  it('resolves a value with an extra trailing word via containment', () => {
    expect(canonicalizeUpazila('কুড়িগ্রাম সদর উপজেলা')).toBe('কুড়িগ্রাম সদর');
  });

  it('trims incidental whitespace', () => {
    expect(canonicalizeUpazila('  ফুলবাড়ী  ')).toBe('ফুলবাড়ী');
  });

  it('returns an unrelated value unchanged rather than guessing wrong', () => {
    expect(canonicalizeUpazila('ঢাকা')).toBe('ঢাকা');
  });

  it('handles empty, null, and undefined without throwing', () => {
    expect(canonicalizeUpazila('')).toBe('');
    expect(canonicalizeUpazila(null)).toBe('');
    expect(canonicalizeUpazila(undefined)).toBe('');
  });
});
