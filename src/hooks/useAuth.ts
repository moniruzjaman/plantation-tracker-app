import { useState, useEffect, useCallback } from 'react';
import { UserSession, UserRole, type UserProfile, type ProfileRole } from '../types';
import { logTransaction } from '../utils/tokenHistory';
import { getUserProfile, saveUserProfile, getProfileTokenReward, getProfileCompleteness } from '../lib/db';

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
  };
}