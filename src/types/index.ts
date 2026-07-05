export type UserRole = 'citizen' | 'officer' | 'district_admin' | 'national_director';

/** Profile form role — simplified for registration */
export type ProfileRole = 'citizen' | 'officer';

export interface UserProfile {
  id: string;
  name: string;
  mobile: string;
  nid: string;
  jobId?: string;          // SAAO/official job ID — optional
  role: ProfileRole;
  designation?: string;    // e.g. 'SAAO', 'UAO', 'AEO'
  district?: string;
  upazila?: string;
  photoUrl?: string;       // base64 or blob URL
  xp: number;
  greenTokens: number;
  streakCount: number;
  profileCompletionBonus: boolean; // one-time token for completing profile
  createdAt: string;
  updatedAt: string;
}

/** Computed session derived from UserProfile — consumed by UI components */
export interface UserSession {
  uid: string;
  name: string;
  role: UserRole;
  district?: string;
  division?: string;
  xp: number;
  greenTokens: number;
  streakCount: number;
  /** Full profile reference — null if user hasn't registered yet */
  profile?: UserProfile | null;
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