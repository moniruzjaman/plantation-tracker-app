import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getTokenHistory } from '../../utils/tokenHistory';
import { getProfileCompleteness, getProfileTokenReward } from '../../lib/db';
import { toBnNum } from '../../utils/mapHelper';
import { Sprout, Flame, Coins, Award, MapPin, IdCard, ShieldCheck, Wifi, WifiOff, CircleDot, Copy, Check, HardDrive, HelpCircle, ChevronRight, Share2, Save, UserPlus, BadgeCheck, UserIcon } from 'lucide-react';
import UserGuideModal from '../UserGuideModal';
import type { UserRole, ProfileRole } from '../../types';
import type { GeoState } from '../GeolocationIndicator';
import type { NetworkStatusData } from '../NetworkStatus';

const ROLE_LABELS: Record<UserRole, string> = {
  citizen: 'নাগরিক',
  officer: 'ফিল্ড অফিসার',
  district_admin: 'জেলা প্রশাসক',
  national_director: 'জাতীয় বনায়ন পরিচালক',
};

const PROFILE_ROLE_LABELS: Record<ProfileRole, string> = {
  citizen: 'নাগরিক',
  officer: 'DAE কর্মকর্তা (SAAO)',
};

const XP_PER_LEVEL = 100;

function levelFromXp(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const intoLevel = xp % XP_PER_LEVEL;
  return { level, intoLevel, progressPct: (intoLevel / XP_PER_LEVEL) * 100 };
}

function getGpsPrecision(meters: number) {
  if (meters < 30) return { label: 'অত্যন্ত নির্ভুল', color: 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100' };
  if (meters < 100) return { label: 'সাধারণ সিগন্যাল', color: 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100' };
  return { label: 'দুর্বল সিগন্যাল', color: 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100' };
}

interface ProfilePageProps {
  networkState?: NetworkStatusData | null;
  geoState?: GeoState | null;
}

export default function ProfilePage({ networkState, geoState }: ProfilePageProps) {
  const { session, role, registerProfile, addTokens, isAuthenticated, loading } = useAuth();
  const history = getTokenHistory();
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [ruralDataSaver, setRuralDataSaver] = useState(() => localStorage.getItem('rural_data_saver_active') === 'true');
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Registration form state
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regNid, setRegNid] = useState('');
  const [regJobId, setRegJobId] = useState('');
  const [regRole, setRegRole] = useState<ProfileRole>('citizen');
  const [regDesignation, setRegDesignation] = useState('');
  const [regDistrict, setRegDistrict] = useState('');
  const [regUpazila, setRegUpazila] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Pre-fill from existing profile when editing
  useEffect(() => {
    if (session?.profile) {
      setRegName(session.profile.name);
      setRegMobile(session.profile.mobile);
      setRegNid(session.profile.nid);
      setRegJobId(session.profile.jobId ?? '');
      setRegRole(session.profile.role);
      setRegDesignation(session.profile.designation ?? '');
      setRegDistrict(session.profile.district ?? '');
      setRegUpazila(session.profile.upazila ?? '');
    }
  }, [session?.profile]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'rural_data_saver_active') {
        setRuralDataSaver(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleToggleDataSaver = () => {
    const nextVal = !ruralDataSaver;
    setRuralDataSaver(nextVal);
    localStorage.setItem('rural_data_saver_active', nextVal ? 'true' : 'false');
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'rural_data_saver_active',
      newValue: nextVal ? 'true' : 'false'
    }));
  };

  const handleCopyCoords = () => {
    if (geoState?.coords) {
      const text = `${geoState.coords.latitude.toFixed(6)}, ${geoState.coords.longitude.toFixed(6)}`;
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const handleShare = () => {
    const shareData = {
      title: 'বৃক্ষরোপণ ট্র্যাকার',
      text: '৫ বছরে ২৫ কোটি বৃক্ষ রোপণ; জাতীয় মহা উদ্দ্যোগে সম্পৃক্ত হতে প্রয়োজনীয় তথ্য।',
      url: 'https://kurigram-plantation-tracker.surge.sh/',
    };
    if (navigator.share) {
      navigator.share(shareData).catch((err) => {
        if (err.name === 'AbortError' || err.message?.toLowerCase().includes('cancel')) return;
        navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`).then(() => {
          setShareCopied(true);
          setTimeout(() => setShareCopied(false), 2000);
        }).catch(() => {});
      });
    } else {
      navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const handleOpenUserGuide = () => {
    setGuideOpen(true);
  };

  const handleRegister = async () => {
    if (!regName.trim() || !regMobile.trim() || !regNid.trim()) return;
    setSaving(true);
    try {
      const profile = await registerProfile({
        name: regName.trim(),
        mobile: regMobile.trim(),
        nid: regNid.trim(),
        jobId: regJobId.trim() || undefined,
        role: regRole,
        designation: regDesignation.trim() || undefined,
        district: regDistrict.trim() || undefined,
        upazila: regUpazila.trim() || undefined,
      });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        setShowRegisterForm(false);
      }, 2000);
    } catch (err) {
      console.error('Profile save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const isOnline = networkState ? networkState.isOnline : true;

  // Token preview for profile fields
  const previewReward = getProfileTokenReward({
    name: regName, mobile: regMobile, nid: regNid,
    jobId: regJobId, designation: regDesignation,
    district: regDistrict, upazila: regUpazila,
  });
  const previewCompleteness = getProfileCompleteness({
    name: regName, mobile: regMobile, nid: regNid,
    jobId: regJobId, designation: regDesignation,
    district: regDistrict, upazila: regUpazila,
  });

  if (loading || !session) {
    return <div className="p-4 text-sm text-gray-400 text-center">লোড হচ্ছে...</div>;
  }

  const { level, intoLevel, progressPct } = levelFromXp(session.xp);
  const isAdmin = role === 'district_admin' || role === 'national_director';
  const profile = session.profile;
  const displayName = profile?.name || session.name;
  const displayRole = profile ? PROFILE_ROLE_LABELS[profile.role] : ROLE_LABELS[role];
  const displayId = profile?.id || session.uid;
  const displayMobile = profile?.mobile || '';
  const displayNid = profile?.nid || '';
  const displayJobId = profile?.jobId || '';

  // Card subtitle — dynamic based on what data is available
  const cardSubtitle = profile
    ? `${displayRole}${profile.designation ? ` · ${profile.designation}` : ''}${displayMobile ? ` · ${displayMobile}` : ''}`
    : 'প্রোফাইল তৈরি করুন';

  const openAdminTab = () => {
    window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'admin' }));
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 space-y-5 pb-24">
      {/* ====== FARMER'S CARD — Dynamic Info ====== */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white p-5">
        <div className="absolute -right-6 -top-6 opacity-10">
          <Sprout size={140} />
        </div>
        {isAuthenticated ? (
          <div className="flex items-center gap-2 text-emerald-200 text-[11px] font-semibold tracking-wide mb-3">
            <BadgeCheck size={14} className="text-emerald-300" />
            {displayRole === 'নাগরিক' ? 'নাগরিক কার্ড' : 'SAAO কার্ড'} · {displayRole === 'নাগরিক' ? 'CITIZEN CARD' : 'OFFICER CARD'}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-200 text-[11px] font-semibold tracking-wide mb-3">
            <IdCard size={14} />
            অনিবন্ধিত · UNREGISTERED
          </div>
        )}
        <h2 className="text-lg font-bold">{displayName}</h2>
        <p className="text-emerald-200 text-xs mt-0.5">{cardSubtitle}</p>

        {/* Dynamic profile details */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-emerald-100">
          <span className="font-mono bg-white/10 rounded px-2 py-1">ID: {displayId.slice(0, 8)}</span>
          {displayNid && <span className="bg-white/10 rounded px-2 py-1">NID: {displayNid}</span>}
          {displayJobId && <span className="bg-white/10 rounded px-2 py-1">চাকরি নং: {displayJobId}</span>}
        </div>
        {(profile?.district || session.district) && (
          <div className="flex items-center gap-1 mt-2 text-xs text-emerald-100">
            <MapPin size={12} /> {[profile?.district, session.district, session.division].filter(Boolean).join(', ')}
          </div>
        )}

        {/* Register / Edit button on card */}
        {!showRegisterForm && (
          <button
            onClick={() => setShowRegisterForm(true)}
            className={`mt-4 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              isAuthenticated
                ? 'bg-white/15 hover:bg-white/25 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-white'
            }`}
          >
            {isAuthenticated ? (
              <>
                <IdCard size={13} /> প্রোফাইল সম্পাদনা
              </>
            ) : (
              <>
                <UserPlus size={13} /> নিবন্ধন করুন (প্রোফাইল তৈরি করুন)
              </>
            )}
          </button>
        )}
      </div>

      {/* ====== REGISTRATION / EDIT FORM ====== */}
      {showRegisterForm && (
        <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
              <UserPlus size={16} className="text-emerald-600" />
              {isAuthenticated ? 'প্রোফাইল সম্পাদনা' : 'ব্যবহারকারী নিবন্ধন'}
            </h3>
            <button onClick={() => setShowRegisterForm(false)} className="text-gray-400 text-xs">বন্ধ করুন</button>
          </div>

          {/* Token incentive preview */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <Coins size={14} /> প্রোফাইল পুরস্কার
            </div>
            <p>তথ্য যত বেশি দিবেন, টোকেন তত বেশি পাবেন!</p>
            <div className="flex items-center justify-between mt-2">
              <span>পূরণতা: {toBnNum(previewCompleteness)}%</span>
              <span className="font-bold text-amber-700">+{toBnNum(previewReward)} গ্রিন টোকেন</span>
            </div>
            <div className="w-full h-1.5 bg-amber-100 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${previewCompleteness}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[10px] text-amber-700">
              <span>নাম +৫</span>
              <span>মোবাইল +৫</span>
              <span>NID +১০</span>
              <span>চাকরি নং +১০</span>
              <span>পদবি +৫</span>
              <span>জেলা +৩</span>
              <span>উপজেলা +২</span>
            </div>
          </div>

          {/* Role selection */}
          <div>
            <label className="text-xs text-gray-500 font-medium">ভূমিকা</label>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 mt-1">
              <button
                onClick={() => setRegRole('citizen')}
                className={`flex-1 py-2 text-sm font-medium ${regRole === 'citizen' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`}
              >
                <UserIcon size={14} className="inline mr-1" /> নাগরিক
              </button>
              <button
                onClick={() => setRegRole('officer')}
                className={`flex-1 py-2 text-sm font-medium ${regRole === 'officer' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`}
              >
                <ShieldCheck size={14} className="inline mr-1" /> DAE কর্মকর্তা
              </button>
            </div>
          </div>

          {/* Name (required) */}
          <div>
            <label className="text-xs text-gray-500 font-medium">পুরো নাম <span className="text-red-500">*</span></label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="নাম লিখুন" value={regName} onChange={(e) => setRegName(e.target.value)} />
          </div>

          {/* Mobile (required) */}
          <div>
            <label className="text-xs text-gray-500 font-medium">মোবাইল নম্বর <span className="text-red-500">*</span></label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="০১XXXXXXXXX" value={regMobile} onChange={(e) => setRegMobile(e.target.value)} />
          </div>

          {/* NID (required) */}
          <div>
            <label className="text-xs text-gray-500 font-medium">জাতীয় পরিচয়পত্র নম্বর (NID) <span className="text-red-500">*</span></label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="NID নম্বর লিখুন" value={regNid} onChange={(e) => setRegNid(e.target.value)} />
          </div>

          {/* Job ID (optional — for officers) */}
          {regRole === 'officer' && (
            <>
              <div>
                <label className="text-xs text-gray-500 font-medium">চাকরি নম্বর (ঐচ্ছিক)</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="চাকরি পরিচয়পত্র নম্বর" value={regJobId} onChange={(e) => setRegJobId(e.target.value)} />
                <p className="text-[10px] text-emerald-600 mt-0.5">চাকরি নম্বর দিলে +১০ টোকেন বোনাস</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">পদবি</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="যেমন: SAAO, UAO, AEO" value={regDesignation} onChange={(e) => setRegDesignation(e.target.value)} />
              </div>
            </>
          )}

          {/* District (optional — more tokens) */}
          <div>
            <label className="text-xs text-gray-500 font-medium">কর্মরত জেলা</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="জেলার নাম" value={regDistrict} onChange={(e) => setRegDistrict(e.target.value)} />
          </div>

          {/* Upazila (optional — more tokens) */}
          <div>
            <label className="text-xs text-gray-500 font-medium">কর্মরত উপজেলা</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm mt-1" placeholder="উপজেলার নাম" value={regUpazila} onChange={(e) => setRegUpazila(e.target.value)} />
          </div>

          <button
            onClick={handleRegister}
            disabled={!regName.trim() || !regMobile.trim() || !regNid.trim() || saving}
            className="w-full bg-emerald-600 disabled:bg-gray-300 text-white font-medium rounded-xl py-3 text-sm flex items-center justify-center gap-2"
          >
            {saving ? 'সংরক্ষণ হচ্ছে...' : saved ? (
              <><Check size={16} /> সংরক্ষিত!</>
            ) : (
              <><Save size={16} /> {isAuthenticated ? 'আপডেট করুন' : 'নিবন্ধন সম্পন্ন করুন'}</>
            )}
          </button>
        </section>
      )}

      {/* ====== TOKEN ECONOMY ====== */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
          <Award size={16} className="text-emerald-600" /> অর্জন ও পুরস্কার
        </h3>

        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>লেভেল {toBnNum(level)}</span>
            <span>{toBnNum(intoLevel)} / {toBnNum(XP_PER_LEVEL)} XP</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 rounded-lg p-3 flex items-center gap-2.5">
            <Coins size={20} className="text-emerald-600" />
            <div>
              <p className="text-lg font-bold text-emerald-700 leading-none">{toBnNum(session.greenTokens)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">গ্রিন টোকেন</p>
            </div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 flex items-center gap-2.5">
            <Flame size={20} className="text-amber-600" />
            <div>
              <p className="text-lg font-bold text-amber-700 leading-none">{toBnNum(session.streakCount)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">দিনের ধারাবাহিকতা</p>
            </div>
          </div>
        </div>
      </section>

      {/* Admin link */}
      {isAdmin && (
        <button
          onClick={openAdminTab}
          className="w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl p-3 shadow-sm transition active:scale-[0.98]"
        >
          <ShieldCheck size={18} className="text-slate-300" />
          <span className="text-sm font-semibold">এডমিন প্যানেল</span>
        </button>
      )}

      {/* ====== NETWORK & GPS ====== */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
          {isOnline ? <Wifi size={16} className="text-emerald-600" /> : <WifiOff size={16} className="text-amber-600" />}
          নেটওয়ার্ক ও অবস্থান
        </h3>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium">ইন্টারনেট সংযোগ:</span>
          <span className={`font-black uppercase tracking-wide flex items-center gap-1.5 ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
            <CircleDot className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-500' : 'text-amber-500 animate-pulse'}`} />
            {isOnline ? 'সংযুক্ত' : 'সংযোগ বিচ্ছিন্ন'}
          </span>
        </div>

        {networkState?.storageEstimate && (
          <div className="flex flex-col gap-1 border-t border-gray-100 pt-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500 font-medium flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-gray-400" /> ডিভাইস স্টোরেজ:
              </span>
              <span className="font-bold text-gray-700">
                {networkState.storageEstimate.used} MB / {networkState.storageEstimate.total} GB
              </span>
            </div>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden mt-0.5">
              <div className="bg-emerald-600 h-full rounded" style={{ width: `${networkState.storageEstimate.percent}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-2">
          <span className="text-gray-500 font-medium">ভৌগোলিক স্থানাঙ্ক:</span>
          {geoState?.coords ? (
            <div className="flex items-center gap-1.5 font-bold text-gray-800 font-mono">
              <span>{geoState.coords.latitude.toFixed(5)}, {geoState.coords.longitude.toFixed(5)}</span>
              <button onClick={handleCopyCoords} className="p-1 rounded bg-white border border-gray-200 active:bg-gray-100 text-gray-500">
                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          ) : (
            <span className="text-gray-400 italic font-mono">লোকেশন ট্র্যাক করা হচ্ছে...</span>
          )}
        </div>

        {geoState?.coords && (
          <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-2">
            <span className="text-gray-500 font-medium">অবস্থানের নির্ভুলতা:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-700">{toBnNum(Math.round(geoState.coords.accuracy))} মিটার</span>
              <span className={getGpsPrecision(geoState.coords.accuracy).color}>
                {getGpsPrecision(geoState.coords.accuracy).label}
              </span>
            </div>
          </div>
        )}

        {geoState?.error && (
          <div className="p-2.5 bg-red-50 border border-red-150 text-red-800 text-[10.5px] rounded-xl leading-relaxed">
            <strong className="font-bold block mb-0.5">জিপিএস ত্রুটি:</strong>
            <span>{geoState.error}</span>
          </div>
        )}

        {/* Data Saver */}
        <div className={`p-3 rounded-xl border flex flex-col gap-2 ${
          ruralDataSaver ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-emerald-50/40 border-emerald-100 text-emerald-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🌾</span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold">গ্রামীণ ডাটা সেভার মোড</span>
                <span className="text-[9px] text-gray-500 font-medium">ডাটা ও ব্যাটারি সাশ্রয়</span>
              </div>
            </div>
            <button
              onClick={handleToggleDataSaver}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                ruralDataSaver ? 'bg-amber-500 justify-end' : 'bg-gray-300 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md" />
            </button>
          </div>
        </div>
      </section>

      {/* Tutorial + Share */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between bg-emerald-50/30 border border-emerald-100/40 p-2.5 rounded-xl">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-gray-800 text-[11px] flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-green-600" /> অ্যাপ্লিকেশন ব্যবহার নির্দেশিকা
            </span>
            <span className="text-[10px] text-gray-500">কিভাবে তথ্য অফলাইনে সংরক্ষণ ও সিঙ্ক করতে হবে তা জানুন।</span>
          </div>
          <button
            onClick={handleOpenUserGuide}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] transition-colors shadow flex items-center gap-0.5 cursor-pointer shrink-0"
          >
            টিউটোরিয়াল <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={handleShare}
          className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 text-slate-700 rounded-lg text-xs font-bold border border-slate-100 hover:bg-slate-100 transition-colors"
        >
          {shareCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
          {shareCopied ? 'লিঙ্ক কপি করা হয়েছে!' : 'অ্যাপটি শেয়ার করুন'}
        </button>
      </section>

      {/* Recent activity */}
      <section className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">সাম্প্রতিক কার্যক্রম</h3>
        {history.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">এখনো কোনো কার্যক্রম নেই</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between text-xs border-b border-gray-50 pb-2 last:border-0">
                <div>
                  <p className="text-gray-700">{tx.reason}</p>
                  <p className="text-gray-400 text-[10px]">{new Date(tx.timestamp).toLocaleString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <span className={`font-semibold ${tx.type === 'xp' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  +{toBnNum(tx.amount)} {tx.type === 'xp' ? 'XP' : 'টোকেন'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* In-app User Guide modal — opened from the "টিউটোরিয়াল" button */}
      <UserGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}