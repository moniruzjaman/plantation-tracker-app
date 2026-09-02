import { describe, it, expect } from 'vitest';
import { sheetEntryToRegistryEntry, localToRegistryEntry } from '../registryEntryAdapter';
import type { PlantationSubmission } from '../../types/plantation';
import type { SheetPlantationEntry } from '../../hooks/useSheetPlantations';

function makeSheetEntry(overrides: Partial<SheetPlantationEntry> = {}): SheetPlantationEntry {
  return {
    submissionId: 'sub-1',
    district: 'কুড়িগ্রাম',
    upazila: 'কুড়িগ্রাম সদর',
    union: 'ঘোগাদহ',
    village: 'টেস্ট গ্রাম',
    address: '',
    latitude: 25.817,
    longitude: 89.65,
    plantingDate: '2026-05-12',
    farmerName: 'টেস্ট কৃষক',
    farmerMobile: '01712345678',
    saaoName: 'টেস্ট SAAO',
    officerName: 'টেস্ট অফিসার',
    seedlings: [{ speciesName: 'আম', category: 'fruit', quantity: 5 }],
    totalQuantity: 5,
    ...overrides,
  };
}

function makeLocalSubmission(overrides: Partial<PlantationSubmission> = {}): PlantationSubmission {
  return {
    id: 'local-1',
    entryMode: 'dae_officer',
    region: 'কুড়িগ্রাম',
    district: 'কুড়িগ্রাম',
    upazila: 'কুড়িগ্রাম সদর',
    union: 'ঘোগাদহ',
    village: 'টেস্ট গ্রাম',
    seedlings: [{ id: 's1', speciesName: 'জাম', count: 3 }],
    plantationDate: '2026-05-10',
    latitude: 25.8,
    longitude: 89.6,
    accuracy: 8,
    caretakerName: 'স্থানীয় কৃষক',
    caretakerMobile: '01812345678',
    saaoId: undefined,
    saaoName: '',
    saaoMobile: '',
    monitoringOfficerName: '',
    monitoringOfficerMobile: '',
    photos: [],
    synced: false,
    timestamp: '2026-05-10T00:00:00.000Z',
    ...overrides,
  } as PlantationSubmission;
}

describe('sheetEntryToRegistryEntry', () => {
  it('maps every field RegistryTab actually reads', () => {
    const entry = sheetEntryToRegistryEntry(makeSheetEntry());
    expect(entry.source).toBe('sheet');
    expect(entry.upazila).toBe('কুড়িগ্রাম সদর');
    expect(entry.village).toBe('টেস্ট গ্রাম');
    expect(entry.caretakerName).toBe('টেস্ট কৃষক');
    expect(entry.caretakerMobile).toBe('01712345678');
    expect(entry.seedlings).toHaveLength(1);
    expect(entry.seedlings[0].count).toBe(5);
    expect(entry.photos).toEqual([]);
    expect(entry.synced).toBe(true);
  });

  it('produces a stable, collision-safe id namespaced from the local id space', () => {
    const entry = sheetEntryToRegistryEntry(makeSheetEntry({ submissionId: 'abc123' }));
    expect(entry.id).toBe('sheet-abc123');
  });

  it('falls back to epoch rather than throwing on an unparseable planting date', () => {
    const entry = sheetEntryToRegistryEntry(makeSheetEntry({ plantingDate: 'not-a-date' }));
    expect(() => new Date(entry.timestamp)).not.toThrow();
    expect(Number.isNaN(new Date(entry.timestamp).getTime())).toBe(false);
  });
});

describe('localToRegistryEntry', () => {
  it('tags a local submission with source without altering its fields', () => {
    const local = makeLocalSubmission();
    const entry = localToRegistryEntry(local);
    expect(entry.source).toBe('local');
    expect(entry.id).toBe(local.id);
    expect(entry.upazila).toBe(local.upazila);
  });
});
