import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getTokenHistory } from '../../utils/tokenHistory';
import { toBnNum } from '../../utils/mapHelper';
import { Sprout, Flame, Coins, Award, MapPin, IdCard, ShieldCheck, Wifi, WifiOff, CircleDot, Copy, Check, HardDrive, HelpCircle, ChevronRight, Share2 } from 'lucide-react';
import type { UserRole } from '../../types';
import type { GeoState } from '../GeolocationIndicator';
import type { NetworkStatusData } from '../NetworkStatus';

const ROLE_LABELS: Record<UserRole, string> = {
  citizen: 'নাগরিক',
  officer: 'ফিল্ড অফিসার',
  district_admin: 'জেলা প্রশাসক',
  national_director: 'জাতীয় বনায়ন পরিচালক',
};

// Simple level curve: every 100 XP is one level.
const XP_PER_LEVEL = 100;

function levelFromXp(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const intoLevel = xp % XP_PER_LEVEL;
  return { level, intoLevel, progressPct: (intoLevel / XP_PER_LEVEL) * 100 };
}

// GPS precision rating — ported from MobileControlCenter.
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
  const { session, role } = useAuth();
  const history = getTokenHistory();
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [ruralDataSaver, setRuralDataSaver] = useState(() => localStorage.getItem('rural_data_saver_active') === 'true');

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
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'rural-data-saver-change', enabled: nextVal }, '*');
    }
  };

  const handleCopyCoords = () => {
    if (geoState?.coords) {
      const text = `${geoState.coords.latitude.toFixed(6)}, ${geoState.coords.longitude.toFixed(6)}`;
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch((err) => {
        console.warn('Coordinates copying failed:', err);
      });
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
        if (err.name === 'AbortError' || err.message?.toLowerCase().includes('cancel') || err.message?.toLowerCase().includes('abort')) return;
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
    const guideBtn = document.getElementById('btnShowWelcomeHelp');
    if (guideBtn) guideBtn.click();
  };

  const isOnline = networkState ? networkState.isOnline : true;

  if (!session) {
    return <div className="p-4 text-sm text-gray-400 text-center">লোড হচ্ছে...</div>;
  }

  const { level, intoLevel, progressPct } = levelFromXp(session.xp);
  const isAdmin = role === 'district_admin' || role === 'national_director';

  // Fix #14: Allow navigating to admin tab from ProfilePage (since it's
  // hidden from the mobile bottom bar).
  const openAdminTab = () => {
    // Dispatch a custom event that App.tsx listens for, or directly
    // manipulate the tab. Simplest: postMessage to self.
    window.dispatchEvent(new CustomEvent('app-navigate', { detail: 'admin' }));
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 space-y-5 pb-24">
      {/* Farmer's Card — digital identity, styled after the Krishak Card */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-emerald-700 via-emerald-800 to-teal-900 text-white p-5">
        <div className="absolute -right-6 -top-6 opacity-10">
          <Sprout size={140} />
        </div>
        <div className="flex items-center gap-2 text-emerald-200 text-[11px] font-semibold tracking-wide mb-3">
          <IdCard size={14} /> কৃষক কার্ড · KRISHAK CARD
        </div>
        <h2 className="text-lg font-bold">{session.name}</h2>
        <p className="text-emerald-200 text-xs mt-0.5">{ROLE_LABELS[role]}</p>
        <div className="flex items-center gap-3 mt-4 text-xs text-emerald-100">
          <span className="font-mono bg-white/10 rounded px-2 py-1">ID: {session.uid}</span>
          {(session.district || session.division) && (
            <span className="flex items-center gap-1">
              <MapPin size={12} /> {[session.district, session.division].filter(Boolean).join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Token economy */}
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

      {/* Fix #14: Admin link — only visible to admin/director roles */}
      {isAdmin && (
        <button
          onClick={openAdminTab}
          className="w-full flex items-center gap-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl p-3 shadow-sm transition active:scale-[0.98]"
        >
          <ShieldCheck size={18} className="text-slate-300" />
          <span className="text-sm font-semibold">এডমিন প্যানেল</span>
        </button>
      )}

      {/* Network & GPS status — ported from the mobile control center */}
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
                <HardDrive className="w-3.5 h-3.5 text-gray-400" /> ডিভাইস স্টোরেজ স্পেস:
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
              <button
                onClick={handleCopyCoords}
                className="p-1 rounded bg-white border border-gray-200 active:bg-gray-100 text-gray-500 active:text-gray-800"
                title="স্থানাঙ্ক কপি করুন"
              >
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

        {/* Rural Data Saver toggle */}
        <div className={`p-3 rounded-xl border flex flex-col gap-2 ${
          ruralDataSaver ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-emerald-50/40 border-emerald-100 text-emerald-900'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🌾</span>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold">গ্রামীণ ডাটা সেভার মোড</span>
                <span className="text-[9px] text-gray-500 font-medium">ডাটা ও ব্যাটারি সাশ্রয় করুন</span>
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
          <p className="text-[10px] text-gray-500 leading-relaxed mt-1">
            {ruralDataSaver
              ? 'সক্রিয়: স্যাটেলাইট ম্যাপ বন্ধ, এআই ছবি কম্প্রেশন ৯৯% সচল, ডেটা ট্রান্সফার সীমাবদ্ধ।'
              : 'অফলাইনে আছেন? ডাটা সেভার চালু করলে আপনার ইন্টারনেট খরচ বিপুল পরিমাণ কমে যাবে।'}
          </p>
        </div>
      </section>

      {/* Tutorial + Share — ported from the mobile control center */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between bg-emerald-50/30 border border-emerald-100/40 p-2.5 rounded-xl">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-gray-800 text-[11px] flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-green-600" /> অ্যাপ্লিকেশন ব্যবহার নির্দেশিকা
            </span>
            <span className="text-[10px] text-gray-500 leading-normal">
              কিভাবে তথ্য অফলাইনে সংরক্ষণ ও সিঙ্ক করতে হবে তা বিস্তারিত জানুন।
            </span>
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
                  {/* Fix #17: Use toBnNum instead of toLocaleString('bn-BD') for reliable Bengali numerals */}
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

      <p className="text-[10px] text-gray-400 text-center px-4">
        ভূমিকা পরিবর্তন এখনো যাচাইবিহীন (ডেমো মোড) — বাস্তব লগইন/অনুমোদন ব্যবস্থা পরবর্তী ধাপে যুক্ত হবে
      </p>
    </div>
  );
}