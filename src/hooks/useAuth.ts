import { useState, useEffect, useCallback } from 'react';
import { UserSession, UserRole, type UserProfile, type ProfileRole } from '../types';
import { logTransaction } from '../utils/tokenHistory';
import { getUserProfile, saveUserProfile, getProfileTokenReward, getProfileCompleteness } from '../lib/db';
import {
  fetchBootstrapList,
  findAllowListEntry,
  getBuiltInAdminEmail,
  rememberEmail,
  getRememberedEmail,
  upsertProfile as upsertServerProfile,
  fetchServerProfile,
  type AllowListUser,
} from '../lib/authBootstrap';

const PROFILE_KEY = 'current';

function profileToSession(profile: UserProfile): UserSession {
  const roleMap: Record<ProfileRole, UserRole> = {
    citizen: 'citizen',
    officer: 'officer',
  };
  return {
    uid: profile.id,
    name: profile.name,
    role: roleMap[profile.role] || 'citizen',
    district: profile.district,
    division: undefined, // will be resolved from district later
    xp: profile.xp,
    greenTokens: profile.greenTokens,
    streakCount: profile.streakCount,
    profile,
  };
}

function defaultSession(): UserSession {
  return {
    uid: 'guest',
    name: 'অনিবন্ধিত ব্যবহারকারী',
    role: 'citizen',
    xp: 0,
    greenTokens: 0,
    streakCount: 0,
    profile: null,
  };
}

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from IndexedDB profile or fall back to guest
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile();
        if (cancelled) return;
        if (profile) {
          setSession(profileToSession(profile));
        } else {
          // Check legacy localStorage for backward compat
          const stored = localStorage.getItem('forestry_user_session');
          if (stored) {
            try {
              const parsed = JSON.parse(stored) as UserSession;
              // Migrate XP/tokens from legacy session
              setSession({ ...defaultSession(), xp: parsed.xp || 0, greenTokens: parsed.greenTokens || 0, streakCount: parsed.streakCount || 0 });
            } catch {
              setSession(defaultSession());
            }
          } else {
            setSession(defaultSession());
          }
        }
      } catch (e) {
        console.error('Failed to initialize session', e);
        if (!cancelled) setSession(defaultSession());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Register / update user profile
  const registerProfile = useCallback(async (data: {
    name: string;
    mobile: string;
    nid: string;
    jobId?: string;
    role: ProfileRole;
    designation?: string;
    district?: string;
    upazila?: string;
  }) => {
    const existing = await getUserProfile();
    const now = new Date().toISOString();

    // Calculate token reward for new fields
    const reward = getProfileTokenReward(data);
    const isNew = !existing?.name;

    const profile: UserProfile = {
      id: PROFILE_KEY,
      name: data.name,
      mobile: data.mobile,
      nid: data.nid,
      jobId: data.jobId,
      role: data.role,
      designation: data.designation,
      district: data.district,
      upazila: data.upazila,
      xp: existing?.xp ?? 0,
      greenTokens: (existing?.greenTokens ?? 0) + (isNew ? reward : 0),
      streakCount: existing?.streakCount ?? 0,
      profileCompletionBonus: existing?.profileCompletionBonus ?? (getProfileCompleteness(data) === 100),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await saveUserProfile(profile);

    // Award tokens if new registration
    if (isNew && reward > 0) {
      logTransaction('token', reward, 'প্রোফাইল তৈরি বোনাস');
    }

    setSession(profileToSession(profile));

    // Update legacy localStorage for backward compat
    localStorage.setItem('forestry_user_session', JSON.stringify(profileToSession(profile)));

    return profile;
  }, []);

  // Update current user role (for demo/testing)
  const switchRole = useCallback((role: UserRole) => {
    if (!session) return;
    const updated: UserSession = { ...session, role };
    setSession(updated);
    localStorage.setItem('forestry_user_session', JSON.stringify(updated));
  }, [session]);

  const addXp = useCallback((amount: number, reason: string = 'কার্যক্রম সম্পন্ন') => {
    if (!session) return;
    const updated = { ...session, xp: session.xp + amount };
    setSession(updated);
    localStorage.setItem('forestry_user_session', JSON.stringify(updated));
    logTransaction('xp', amount, reason);
  }, [session]);

  const addTokens = useCallback((amount: number, reason: string = 'পুরস্কার') => {
    if (!session) return;
    const updated = { ...session, greenTokens: session.greenTokens + amount };
    setSession(updated);
    localStorage.setItem('forestry_user_session', JSON.stringify(updated));
    logTransaction('token', amount, reason);
  }, [session]);

  // ─── Email-based bootstrap ───────────────────────────────────────────────
  //
  // On first install, the app calls `bootstrapFromEmail(email)`:
  //   1. Fetches the server's allow-list.
  //   2. If email matches → auto-creates a UserProfile with the allow-list's
  //      role/name/mobile/designation/district/upazila pre-populated. No
  //      manual form fill needed.
  //   3. If no match → user must enter name + mobile manually (mandatory).
  //      Returns `null` so the UI knows to show the registration form.
  //
  // The first allow-list admin email becomes the "built-in" email that lets
  // the user explore the app immediately on first install.
  const bootstrapFromEmail = useCallback(async (email: string): Promise<{
    profile: UserProfile | null;
    fromAllowList: boolean;
    allowListEntry: AllowListUser | null;
  }> => {
    try {
      const list = await fetchBootstrapList();
      const entry = findAllowListEntry(list, email);

      // Map server role → client ProfileRole
      const clientRole: ProfileRole =
        entry?.role === 'admin' || entry?.role === 'cadre' || entry?.role === 'officer'
          ? 'officer'
          : 'citizen';

      if (entry) {
        // Auto-create profile from allow-list data
        const now = new Date().toISOString();
        const existing = await getUserProfile();
        const profile: UserProfile = {
          id: PROFILE_KEY,
          name: entry.name || existing?.name || '',
          mobile: entry.mobile || existing?.mobile || '',
          nid: existing?.nid || '',
          jobId: existing?.jobId,
          role: clientRole,
          designation: entry.designation || existing?.designation,
          district: entry.district || existing?.district,
          upazila: entry.upazila || existing?.upazila,
          xp: existing?.xp ?? 0,
          greenTokens: existing?.greenTokens ?? 0,
          streakCount: existing?.streakCount ?? 0,
          profileCompletionBonus: existing?.profileCompletionBonus ?? false,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        await saveUserProfile(profile);
        rememberEmail(email);
        setSession(profileToSession(profile));
        localStorage.setItem('forestry_user_session', JSON.stringify(profileToSession(profile)));
        return { profile, fromAllowList: true, allowListEntry: entry };
      }

      // No allow-list match — user must register manually
      return { profile: null, fromAllowList: false, allowListEntry: null };
    } catch (err) {
      console.error('Bootstrap failed:', err);
      return { profile: null, fromAllowList: false, allowListEntry: null };
    }
  }, []);

  /** Returns the built-in admin email (first allow-list entry with role=admin). */
  const getBuiltInEmail = useCallback(async (): Promise<string | null> => {
    try {
      const list = await fetchBootstrapList();
      return getBuiltInAdminEmail(list);
    } catch {
      return null;
    }
  }, []);

  /**
   * Syncs the current local profile to the server (upsert by email).
   * Called after profile registration/update AND on submission sync so the
   * server-side XP/token totals stay in sync with the client.
   *
   * Returns the server-awarded bonus (if any) — NID + JobID completion
   * triggers a one-time +25 token bonus server-side.
   */
  const syncProfileToServer = useCallback(async (email: string): Promise<{
    bonusAwarded: boolean;
    bonusTokens: number;
    fromAllowList: boolean;
  } | null> => {
    const profile = await getUserProfile();
    if (!profile || !email) return null;
    try {
      const resp = await upsertServerProfile({
        email,
        name: profile.name,
        mobile: profile.mobile,
        nid: profile.nid,
        jobId: profile.jobId,
        designation: profile.designation,
        district: profile.district,
        upazila: profile.upazila,
        xp: profile.xp,
        greenTokens: profile.greenTokens,
        streakCount: profile.streakCount,
      });

      // If the server awarded a bonus, mirror it locally
      if (resp.bonusAwarded && resp.bonusTokens > 0) {
        const updatedProfile: UserProfile = {
          ...profile,
          greenTokens: profile.greenTokens + resp.bonusTokens,
          profileCompletionBonus: true,
          updatedAt: new Date().toISOString(),
        };
        await saveUserProfile(updatedProfile);
        setSession(profileToSession(updatedProfile));
        logTransaction('token', resp.bonusTokens, 'প্রোফাইল সম্পূর্ণতা বোনাস (সার্ভার)');
      }

      return {
        bonusAwarded: resp.bonusAwarded,
        bonusTokens: resp.bonusTokens,
        fromAllowList: resp.fromAllowList,
      };
    } catch (err) {
      console.error('Profile sync to server failed:', err);
      return null;
    }
  }, []);

  /** Returns the remembered bootstrap email (if any). */
  const rememberedEmail = getRememberedEmail();

  return {
    session,
    loading,
    role: session?.role || 'citizen',
    clearanceLevel: session?.role === 'national_director' ? 3 : session?.role === 'district_admin' ? 2 : session?.role === 'officer' ? 1 : 0,
    switchRole,
    registerProfile,
    addXp,
    addTokens,
    isAuthenticated: !!session?.profile,
    // New bootstrap APIs
    bootstrapFromEmail,
    getBuiltInEmail,
    syncProfileToServer,
    rememberedEmail,
  };
}