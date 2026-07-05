import { useAuth } from '../../hooks/useAuth';
import { getTokenHistory } from '../../utils/tokenHistory';
import { toBnNum } from '../../utils/mapHelper';
import { Sprout, Flame, Coins, Award, MapPin, IdCard, ShieldCheck } from 'lucide-react';
import type { UserRole } from '../../types';

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

export default function ProfilePage() {
  const { session, role } = useAuth();
  const history = getTokenHistory();

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