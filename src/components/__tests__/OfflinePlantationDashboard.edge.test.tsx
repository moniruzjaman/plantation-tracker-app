import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import OfflinePlantationDashboard from '../OfflinePlantationDashboard';

describe('OfflinePlantationDashboard edge cases', () => {
  it('does not crash when /api/sheet/list returns a network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;
    render(<OfflinePlantationDashboard />);
    await waitFor(() => expect(document.body.textContent).not.toBe(''));
    expect(document.querySelector('[class]')).not.toBeNull();
  });

  it('does not crash when /api/sheet/list returns malformed JSON (res.json() throws)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error('Unexpected token')),
    }) as any;
    render(<OfflinePlantationDashboard />);
    await waitFor(() => expect(document.body.textContent).not.toBe(''));
  });

  it('shows the App_Entry section even with zero local submissions -- REGRESSION TEST for the "no data shown" bug (a reviewer/DD account has no local submissions, but should still see live nationwide data)', async () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      submissionId: `s${i}`,
      district: 'কুড়িগ্রাম',
      upazila: 'কুড়িগ্রাম সদর',
      union: '',
      village: `গ্রাম ${i}`,
      address: '',
      latitude: '25.8',
      longitude: '89.6',
      plantingDate: '2026-05-12',
      farmerName: `কৃষক ${i}`,
      farmerMobile: '01712345678',
      saaoName: '',
      officerName: '',
      seedlings: [{ speciesName: 'আম', category: 'fruit', quantity: 5 }],
    }));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, entries }),
    }) as any;
    // Deliberately no saveSubmission() call -- zero local data, matching a
    // reviewer/DD account or a brand-new officer's first launch.
    render(<OfflinePlantationDashboard />);
    await waitFor(
      () => {
        expect(document.body.textContent).toMatch(/জাতীয় তথ্য|App_Entry/);
      },
      { timeout: 5000 }
    );
    // The "no local data" message should still show for the local-only
    // section (that part is correctly empty), but it must not suppress
    // the nationwide App_Entry section sitting alongside it.
    expect(document.body.textContent).toContain('কোনো ডাটা পাওয়া যায়নি');
  });

  it('does not crash with a large realistic sheet dataset (300+ entries)', async () => {
    const bigEntries = Array.from({ length: 333 }, (_, i) => ({
      submissionId: `s${i}`,
      district: 'কুড়িগ্রাম',
      upazila: i % 2 === 0 ? 'কুড়িগ্রাম সদর' : 'নাগেশ্বরী',
      union: '',
      village: `গ্রাম ${i}`,
      address: '',
      latitude: (25.8 + Math.random() * 0.1).toString(),
      longitude: (89.6 + Math.random() * 0.1).toString(),
      plantingDate: '2026-05-12',
      farmerName: `কৃষক ${i}`,
      farmerMobile: '01712345678',
      saaoName: '',
      officerName: '',
      seedlings: [{ speciesName: 'আম', category: 'fruit', quantity: 5 }],
    }));
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, entries: bigEntries }),
    }) as any;
    render(<OfflinePlantationDashboard />);
    await waitFor(() => expect(document.body.textContent).toContain('৩৩৩'), { timeout: 5000 });
  });

  it('does not crash when a sheet entry has missing/null fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        ok: true,
        entries: [
          { submissionId: null, district: null, upazila: null, latitude: 'abc', longitude: null, seedlings: null },
          {},
        ],
      }),
    }) as any;
    render(<OfflinePlantationDashboard />);
    await waitFor(() => expect(document.body.textContent).not.toBe(''));
  });
});
