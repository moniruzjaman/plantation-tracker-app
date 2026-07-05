export type UserRole = 'citizen' | 'officer' | 'district_admin' | 'national_director';

export interface UserSession {
  uid: string;
  name: string;
  role: UserRole;
  district?: string;
  division?: string;
  xp: number;
  greenTokens: number;
  streakCount: number;
}

export interface TokenTransaction {
  id: string;
  type: 'xp' | 'token';
  amount: number;
  reason: string;
  timestamp: string;
}

/**
 * @deprecated Use SeedlingEntry from './plantation' for new code.
 * Kept only for backward compatibility with OfflinePlantationDashboard
 * and carbonMath.ts which still read the legacy submission shape
 * (fruitSeedlings/forestSeedlings/medicinal arrays with graftingCount).
 * Once those modules are migrated to the new flat PlantationSubmission,
 * this type can be removed.
 */
export interface SeedlingItem {
  speciesName: string;
  count: number;
  graftingCount: number;
}

export interface PlantationSubmission {
  id: string;
  nurseryName: string;
  ownerName: string;
  ownerMobile: string;
  division: string;
  district: string;
  upazila: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  fruitSeedlings: SeedlingItem[];
  forestSeedlings: SeedlingItem[];
  medicinalSeedlings: SeedlingItem[];
  timestamp: string;
  synced: boolean;
  photoUrl?: string;
  signatureBase64?: string;
  carbonEstimateTons?: number;
  healthScore?: number;
}