import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OfflinePlantationDashboard from '../OfflinePlantationDashboard';
import { saveSubmission } from '../../lib/db';
import type { PlantationSubmission } from '../../types/plantation';

function makeSubmission(overrides: Partial<PlantationSubmission> = {}): PlantationSubmission {
  return {
    id: 'seed-1',
    entryMode: 'dae_officer',
    region: 'কুড়িগ্রাম',
    district: 'কুড়িগ্রাম',
    upazila: 'কুড়িগ্রাম সদর',
    union: 'ঘোগাদহ',
    village: 'টেস্ট গ্রাম',
    seedlings: [{ id: 's1', speciesName: 'আম', count: 10 }],
    plantationDate: '2026-05-10',
    latitude: 25.8,
    longitude: 89.6,
    accuracy: 8,
    caretakerName: 'টেস্ট কৃষক',
    caretakerMobile: '01812345678',
    saaoName: '',
    saaoMobile: '',
    monitoringOfficerName: '',
    monitoringOfficerMobile: '',
    photos: [],
    synced: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  } as PlantationSubmission;
}

beforeEach(async () => {
  await saveSubmission(makeSubmission());

  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/sheet/list')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            entries: [
              {
                submissionId: 'sheet-1',
                district: 'কুড়িগ্রাম',
                upazila: 'নাগেশ্বরী',
                union: '',
                village: 'শীট গ্রাম',
                address: '',
                latitude: '25.98',
                longitude: '89.71',
                plantingDate: '2026-05-12',
                farmerName: 'শীট কৃষক',
                farmerMobile: '01712345678',
                saaoName: '',
                officerName: '',
                seedlings: [{ speciesName: 'জাম', category: 'fruit', quantity: 7 }],
              },
            ],
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
});

describe('OfflinePlantationDashboard with real seeded data', () => {
  it('renders and reflects local submission data after effects settle', async () => {
    render(<OfflinePlantationDashboard />);

    // The local submission's data should surface in the per-device stats
    // once fetchSubmissions() resolves (village names aren't shown in the
    // stats view itself, so check for the seedling count/species instead).
    await waitFor(
      () => {
        expect(document.body.textContent).toContain('আম');
      },
      { timeout: 3000 }
    );
  });

  it('reflects live App_Entry sheet data once useSheetPlantations resolves', async () => {
    render(<OfflinePlantationDashboard />);
    await waitFor(
      () => {
        // নাগেশ্বরী / জাম came only from the mocked sheet response --
        // if this never appears, the live App_Entry stats path is broken.
        expect(document.body.textContent).toMatch(/নাগেশ্বরী|জাম|শীট/);
      },
      { timeout: 3000 }
    );
  });
});
