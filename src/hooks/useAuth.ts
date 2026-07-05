import { useState, useEffect } from 'react';
import { UserSession, UserRole } from '../types';
import { logTransaction } from '../utils/tokenHistory';

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);

  // Initialize from storage or default to Level 1 Field Officer (most common offline state)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('forestry_user_session');
      if (stored) {
        setSession(JSON.parse(stored));
      } else {
        // Set standard Government Field Officer profile as initial default
        const initialSession: UserSession = {
          uid: 'fd-officer-1029',
          name: 'মোঃ আসাদুল ইসলাম',
          role: 'officer',
          division: 'Rangpur',
          district: 'Dinajpur',
          // Fix #15: Removed legacy ai_consultation_score read.
          // XP now has a single source of truth: forestry_user_session.xp
          xp: 120,
          greenTokens: 15,
          streakCount: 3
        };
        setSession(initialSession);
        localStorage.setItem('forestry_user_session', JSON.stringify(initialSession));
      }
    } catch (e) {
      console.error('Failed to initialize session', e);
    }
  }, []);

  // Update current user role
  const switchRole = (role: UserRole) => {
    if (!session) return;
    
    // Default mock credentials based on role clearance level
    let updatedSession: UserSession = { ...session, role };
    if (role === 'citizen') {
      updatedSession.name = 'আহমেদ কবির (নাগরিক)';
      updatedSession.district = undefined;
      updatedSession.division = undefined;
    } else if (role === 'officer') {
      updatedSession.name = 'মোঃ আসাদুল ইসলাম (ফিল্ড অফিসার)';
      updatedSession.division = 'Rangpur';
      updatedSession.district = 'Dinajpur';
    } else if (role === 'district_admin') {
      updatedSession.name = 'ড. নুসরাত জাহান (জেলা প্রশাসক)';
      updatedSession.division = 'Rangpur';
      updatedSession.district = 'Dinajpur';
    } else if (role === 'national_director') {
      updatedSession.name = 'প্রকৌশলী মনিরুজ্জামান (জাতীয় বনায়ন পরিচালক)';
      updatedSession.division = 'Dhaka';
      updatedSession.district = 'Dhaka';
    }

    setSession(updatedSession);
    localStorage.setItem('forestry_user_session', JSON.stringify(updatedSession));
  };

  // Fix #15: Single source of truth for XP (forestry_user_session only).
  const addXp = (amount: number, reason: string = 'কার্যক্রম সম্পন্ন') => {
    if (!session) return;
    const updated = { ...session, xp: session.xp + amount };
    setSession(updated);
    localStorage.setItem('forestry_user_session', JSON.stringify(updated));
    logTransaction('xp', amount, reason);
  };

  // Synchronize Green Tokens
  const addTokens = (amount: number, reason: string = 'পুরস্কার') => {
    if (!session) return;
    const updated = { ...session, greenTokens: session.greenTokens + amount };
    setSession(updated);
    localStorage.setItem('forestry_user_session', JSON.stringify(updated));
    logTransaction('token', amount, reason);
  };

  return {
    session,
    role: session?.role || 'citizen',
    clearanceLevel: session?.role === 'national_director' ? 3 : session?.role === 'district_admin' ? 2 : session?.role === 'officer' ? 1 : 0,
    switchRole,
    addXp,
    addTokens,
    isAuthenticated: !!session,
  };
}
