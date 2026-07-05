import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  Database,
  Leaf,
  BarChart3,
  TrendingUp,
  MapPin,
  Info,
  CheckCircle,
  Clock,
  Flame,
  Globe2,
  TreePine,
  Activity,
  Calendar,
  Droplet,
  Coins,
  Award,
  Star,
  Zap,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { calculateCarbonV2, getSpeciesCategory } from '../utils/carbonMath';
import { calculateGrowthPrognosis, SPECIES_GROWTH_PARAMS } from '../utils/growthModel';
import { getSubmissions, countUnsynced, getSubmissionReward } from '../lib/db';
import { useAuth } from '../hooks/useAuth';
import type { PlantationSubmission } from '../types/plantation';
import { toBnNum } from '../utils/mapHelper';

interface OfflinePlantationDashboardProps {
  syncState?: {
    unsyncedCount: number;
    isSyncing: boolean;
    syncResult: { success: boolean; syncedCount: number; message: string } | null;
    syncQueue: () => Promise<boolean>;
  } | null;
}

export default function OfflinePlantationDashboard({ syncState }: OfflinePlantationDashboardProps = {}) {
  const { session, addXp, addTokens } = useAuth();
  const [submissions, setSubmissions] = useState<PlantationSubmission[]>([]);
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'metrics' | 'health' | 'wealth'>('metrics');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('custom');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('আম');
  const [customPlantingDate, setCustomPlantingDate] = useState<string>('2026-03-15');
  const [customDistrict, setCustomDistrict] = useState<string>('Rajshahi');

  // Fetch submissions from IndexedDB (V2 pipeline)
  const fetchSubmissions = useCallback(async () => {
    try {
      const items = await getSubmissions();
      setSubmissions(items);
      setLastUpdated(new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US'));
    } catch (e) {
      console.error('Error reading submissions from IndexedDB:', e);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // Get currently selected submission
  const selectedSubmission = submissions.find(s => s.id === selectedSubmissionId);
  const activeDistrict = selectedSubmission?.district || customDistrict;

  // Extract all species from the selected submission (V2: flat seedlings)
  const submissionSpeciesList = useMemo(() => {
    if (!selectedSubmission) return [];
    const seen = new Set<string>();
    return selectedSubmission.seedlings
      .filter(s => s.speciesName && !seen.has(s.speciesName) && seen.add(s.speciesName));
  }, [selectedSubmission]);

  // Sync selected species when submission changes
  useEffect(() => {
    if (selectedSubmissionId === 'custom') {
      if (!SPECIES_GROWTH_PARAMS[selectedSpecies]) {
        setSelectedSpecies('আম');
      }
    } else if (submissionSpeciesList.length > 0) {
      setSelectedSpecies(submissionSpeciesList[0].speciesName);
    }
  }, [selectedSubmissionId, submissionSpeciesList]);

  const activePlantingDate = selectedSubmission?.plantationDate || customPlantingDate;

  // Health prognosis
  const healthPrognosis = useMemo(() => {
    return calculateGrowthPrognosis(selectedSpecies, activePlantingDate, activeDistrict);
  }, [selectedSpecies, activePlantingDate, activeDistrict]);

  // ============ COMPUTED STATS (from IndexedDB V2 data) ============
  const totalLogs = submissions.length;
  let totalSeedlings = 0;
  let fruitCount = 0;
  let forestCount = 0;
  let medicinalCount = 0;
  let totalCarbon = 0;
  let syncedCount = 0;
  let gpsVerifiedCount = 0;
  let photoEvidenceCount = 0;
  const districtMap: Record<string, number> = {};
  const speciesMap: Record<string, number> = {};
  const modeMap: Record<string, number> = { dae_officer: 0, citizen: 0 };
  let totalXpEarned = 0;
  let totalTokensEarned = 0;

  submissions.forEach(s => {
    if (s.synced) syncedCount++;
    if (s.verificationLatitude) gpsVerifiedCount++;
    photoEvidenceCount += s.photos?.length || 0;
    if (s.district) districtMap[s.district] = (districtMap[s.district] || 0) + 1;
    if (s.entryMode) modeMap[s.entryMode] = (modeMap[s.entryMode] || 0) + 1;

    const reward = getSubmissionReward(s);
    totalXpEarned += reward.xp;
    totalTokensEarned += reward.tokens;

    s.seedlings.forEach(se => {
      const c = se.count || 0;
      totalSeedlings += c;
      const cat = getSpeciesCategory(se.speciesName);
      if (cat === 'fruit') fruitCount += c;
      else if (cat === 'medicinal') medicinalCount += c;
      else forestCount += c;

      if (se.speciesName) {
        speciesMap[se.speciesName] = (speciesMap[se.speciesName] || 0) + c;
      }
    });

    totalCarbon += calculateCarbonV2(s.seedlings);
  });

  const sortedDistricts = Object.entries(districtMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topSpecies = Object.entries(speciesMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const unsyncedDisplay = syncState?.unsyncedCount ?? (totalLogs - syncedCount);

  // Text translations
  const t = {
    title: language === 'bn' ? 'অফলাইন ট্র্যাকার' : 'Offline Tracker',
    dashboardTitle: language === 'bn' ? 'ডেটা ড্যাশবোর্ড' : 'Data Dashboard',
    totalBatches: language === 'bn' ? 'মোট এন্ট্রি' : 'Total Entries',
    totalPlanted: language === 'bn' ? 'মোট রোপণকৃত চারা' : 'Total Seedlings Planted',
    fruit: language === 'bn' ? 'ফলদ' : 'Fruit',
    forest: language === 'bn' ? 'বনজ' : 'Forest',
    medicinal: language === 'bn' ? 'ঔষধি' : 'Medicinal',
    regionalSpread: language === 'bn' ? 'জেলা ভিত্তিক বন্টন' : 'District Breakdown',
    topSpecies: language === 'bn' ? 'শীর্ষ প্রজাতি' : 'Top Species',
    noData: language === 'bn' ? 'কোনো ডাটা পাওয়া যায়নি' : 'No records logged yet',
    syncTip: language === 'bn' ? 'সকল ডাটা আপনার ডিভাইসে IndexedDB-তে নিরাপদে সংরক্ষিত।' : 'All data is securely stored in IndexedDB on your device.',
    btnToggle: language === 'bn' ? 'English' : 'বাংলা',
    lastSync: language === 'bn' ? 'আপডেট:' : 'Updated:',
    targetText: language === 'bn' ? 'জাতীয় লক্ষ্যমাত্রা' : 'National Goal',
    of: language === 'bn' ? 'এর মধ্যে' : 'of',
    wealthTitle: language === 'bn' ? 'টোকেন ও অর্জন' : 'Tokens & Rewards',
    syncNow: language === 'bn' ? 'সিঙ্ক করুন' : 'Sync Now',
    syncing: language === 'bn' ? 'সিঙ্ক হচ্ছে...' : 'Syncing...',
    unsynced: language === 'bn' ? 'সিঙ্ক বাকি' : 'Unsynced',
    daeEntries: language === 'bn' ? 'DAE এন্ট্রি' : 'DAE Entries',
    citizenEntries: language === 'bn' ? 'নাগরিক এন্ট্রি' : 'Citizen Entries',
    gpsVerified: language === 'bn' ? 'GPS যাচাইকৃত' : 'GPS Verified',
    photos: language === 'bn' ? 'ছবি প্রমাণ' : 'Photo Evidence',
  };

  const maxCategoryCount = Math.max(fruitCount, forestCount, medicinalCount, 1);

  return (
    <div className="w-full h-full overflow-y-auto bg-white font-sans" id="offlineDashboardContainer">
      <div className="w-full max-w-2xl mx-auto p-4 pb-24">
        <motion.div
          id="offlineDashboardDetailsPanel"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className="w-full bg-white text-gray-800 text-xs flex flex-col gap-3.5"
        >
          {/* Header */}
          <div className="border-b border-gray-100 pb-2.5 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 text-sm tracking-tight flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-600" />
                {t.dashboardTitle}
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5">
                {t.lastSync} {lastUpdated}
                {unsyncedDisplay > 0 && (
                  <span className="ml-2 text-amber-600 font-semibold">
                    · {toBnNum(unsyncedDisplay)} {t.unsynced}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {syncState && unsyncedDisplay > 0 && (
                <button
                  onClick={() => syncState.syncQueue()}
                  disabled={syncState.isSyncing}
                  className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white text-[10px] font-bold transition-colors flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                  {syncState.isSyncing ? t.syncing : t.syncNow}
                </button>
              )}
              <button
                id="dashLangToggle"
                onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
                className="px-2 py-0.5 rounded border border-gray-200 hover:border-gray-300 active:bg-gray-50 text-[10px] bg-white font-semibold text-gray-600 transition-colors flex items-center gap-1"
              >
                <Globe2 className="w-3 h-3 text-gray-400" />
                {t.btnToggle}
              </button>
            </div>
          </div>

          {/* Sync result banner */}
          {syncState?.syncResult && (
            <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
              syncState.syncResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              {syncState.syncResult.success
                ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                : <WifiOff className="w-4 h-4 text-red-500 shrink-0" />
              }
              <span className="font-medium">
                {syncState.syncResult.success
                  ? (language === 'bn'
                    ? `${toBnNum(syncState.syncResult.syncedCount)}টি এন্ট্রি সফলভাবে সিঙ্ক হয়েছে`
                    : `${syncState.syncResult.syncedCount} entries synced successfully`)
                  : syncState.syncResult.message}
              </span>
            </div>
          )}

          {/* Tab Switcher — 3 tabs now */}
          <div className="flex border-b border-gray-100 p-0.5 bg-gray-50 rounded-xl">
            {(['metrics', 'health', 'wealth'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 rounded-lg text-center font-bold transition-all text-[11px] cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white text-emerald-700 shadow-sm border border-gray-200/50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'metrics' && (language === 'bn' ? '📊 পরিসংখ্যান' : '📊 Metrics')}
                {tab === 'health' && (language === 'bn' ? '🌱 স্বাস্থ্য' : '🌱 Health')}
                {tab === 'wealth' && (language === 'bn' ? '🏆 টোকেন' : '🏆 Wealth')}
              </button>
            ))}
          </div>

          {loading && (
            <div className="text-center py-8 text-gray-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              {language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}
            </div>
          )}

          {/* ============ METRICS TAB ============ */}
          {activeTab === 'metrics' && !loading && (
            <div className="flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
              {totalLogs === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t.noData}</p>
                  <p className="text-[10px] mt-1">
                    {language === 'bn'
                      ? 'ফর্ম ট্যাব থেকে বৃক্ষরোপণের তথ্য জমা দিন।'
                      : 'Submit plantation data from the Form tab.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Grid Metrics — 4 cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                      <Clock className="w-4 h-4 text-emerald-600 mb-1" />
                      <span className="text-[10px] font-medium text-emerald-800 opacity-80 uppercase tracking-wider">{t.totalBatches}</span>
                      <span className="text-xl font-extrabold text-emerald-700 mt-1">{toBnNum(totalLogs)}</span>
                    </div>

                    <div className="bg-lime-50/50 border border-lime-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                      <Leaf className="w-4 h-4 text-lime-600 mb-1" />
                      <span className="text-[10px] font-medium text-lime-800 opacity-80 uppercase tracking-wider">{t.totalPlanted}</span>
                      <span className="text-xl font-extrabold text-lime-700 mt-1">{toBnNum(totalSeedlings)}</span>
                    </div>
                  </div>

                  {/* Carbon Offset (Full Width) */}
                  <div className="col-span-2 bg-gradient-to-r from-emerald-50/30 to-teal-50/30 border border-teal-100 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-700 shrink-0">
                        <TreePine className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-[9.5px] font-bold text-teal-900 opacity-80 uppercase tracking-wider">
                          {language === 'bn' ? 'বার্ষিক CO₂ শোষণ' : 'Est. Annual CO₂ Absorption'}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">IPCC Tier-2</span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-emerald-700 font-mono shrink-0">
                      {language === 'bn' ? `${toBnNum(parseFloat(totalCarbon.toFixed(2)))} টন` : `${totalCarbon.toFixed(2)} T`}
                    </span>
                  </div>

                  {/* Entry mode breakdown */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-2 flex flex-col items-center text-center">
                      <span className="text-[9px] font-medium text-blue-700 opacity-80">{t.daeEntries}</span>
                      <span className="text-base font-extrabold text-blue-700">{toBnNum(modeMap.dae_officer)}</span>
                    </div>
                    <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-2 flex flex-col items-center text-center">
                      <span className="text-[9px] font-medium text-purple-700 opacity-80">{t.citizenEntries}</span>
                      <span className="text-base font-extrabold text-purple-700">{toBnNum(modeMap.citizen)}</span>
                    </div>
                    <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2 flex flex-col items-center text-center">
                      <span className="text-[9px] font-medium text-amber-700 opacity-80">{t.unsynced}</span>
                      <span className="text-base font-extrabold text-amber-700">{toBnNum(unsyncedDisplay)}</span>
                    </div>
                  </div>

                  {/* Quality indicators */}
                  <div className="flex items-center gap-2 text-[10px]">
                    {gpsVerifiedCount > 0 && (
                      <span className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-emerald-700 font-semibold flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {toBnNum(gpsVerifiedCount)} {t.gpsVerified}
                      </span>
                    )}
                    {photoEvidenceCount > 0 && (
                      <span className="bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-blue-700 font-semibold flex items-center gap-1">
                        <Flame className="w-3 h-3" /> {toBnNum(photoEvidenceCount)} {t.photos}
                      </span>
                    )}
                  </div>

                  {/* Seedlings Category Progress */}
                  <div className="flex flex-col gap-2.5">
                    <span className="font-semibold text-gray-700 text-[11px] tracking-wide flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                      {language === 'bn' ? 'চারাগাছের প্রকারভেদ' : 'Seedling Varieties'}
                    </span>

                    {[
                      { label: t.fruit, count: fruitCount, color: 'bg-orange-500', dot: 'bg-orange-500' },
                      { label: t.forest, count: forestCount, color: 'bg-emerald-600', dot: 'bg-emerald-600' },
                      { label: t.medicinal, count: medicinalCount, color: 'bg-blue-500', dot: 'bg-blue-500' },
                    ].map(cat => (
                      <div key={cat.label} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600 font-medium flex items-center gap-1">
                            <span className={`w-2 h-2 rounded-full ${cat.dot} shrink-0`} />
                            {cat.label}
                          </span>
                          <span className="font-semibold text-gray-700">{toBnNum(cat.count)} {language === 'bn' ? 'টি' : ''}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`${cat.color} h-full rounded-full transition-all duration-300`} style={{ width: `${(cat.count / maxCategoryCount) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Top Species */}
                  {topSpecies.length > 0 && (
                    <div className="flex flex-col gap-1.5 border-t border-gray-100 pt-3">
                      <span className="font-semibold text-gray-700 text-[11px] flex items-center gap-1">
                        <Leaf className="w-3.5 h-3.5 text-gray-400" />
                        {t.topSpecies}
                      </span>
                      <div className="flex flex-col gap-1">
                        {topSpecies.map(([name, count]) => (
                          <div key={name} className="flex justify-between items-center bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
                            <span className="font-medium text-gray-600 text-xs">{name}</span>
                            <span className="font-semibold text-emerald-700 bg-white border border-emerald-100 rounded px-2 py-0.5 text-[10.5px]">
                              {toBnNum(count)} {language === 'bn' ? 'টি' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Districts */}
                  {sortedDistricts.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-gray-100 pt-3">
                      <span className="font-semibold text-gray-700 text-[11px] flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {t.regionalSpread}
                      </span>
                      <div className="flex flex-col gap-1.5">
                        {sortedDistricts.map(([districtName, count]) => (
                          <div key={districtName} className="flex justify-between items-center bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
                            <span className="font-medium text-gray-600 text-xs">{districtName}</span>
                            <span className="font-semibold text-emerald-700 bg-white border border-emerald-100 rounded px-2 py-0.5 text-[10.5px]">
                              {toBnNum(count)} {language === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Target progress */}
                  <div className="flex flex-col gap-1 bg-amber-50/40 border border-amber-100/50 p-2.5 rounded-xl text-[10.5px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-800 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                        {t.targetText}
                      </span>
                      <span className="font-bold text-amber-800 text-[10px]">
                        {language === 'bn' ? '৫ বছরে ২৫ কোটি' : '250M in 5 Yrs'}
                      </span>
                    </div>
                    <p className="text-gray-500 leading-relaxed mt-1">
                      {language === 'bn'
                        ? `আপনার অঞ্চল থেকে ২৫ কোটি গাছ রোপণ কর্মসূচিতে অনন্য অবদান রাখছেন।`
                        : `Your submissions contribute toward the national 250M plantation target.`}
                    </p>
                  </div>

                  {/* Sync status tip */}
                  <div className="p-2.5 rounded-xl border bg-emerald-50/50 border-emerald-100/80 text-emerald-800 text-[10.5px] leading-relaxed flex gap-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <p>{t.syncTip}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============ HEALTH TAB ============ */}
          {activeTab === 'health' && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
              {/* Selector Header */}
              <div className="flex flex-col gap-1">
                <label className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">
                  {language === 'bn' ? 'রোপণ এন্ট্রি নির্বাচন করুন' : 'Select Plantation Entry'}
                </label>
                <select
                  id="selectHealthBatch"
                  value={selectedSubmissionId}
                  onChange={(e) => setSelectedSubmissionId(e.target.value)}
                  className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-1.5 text-xs text-gray-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                >
                  <option value="custom">
                    {language === 'bn' ? '💡 ক্যালকুলেটর (ম্যানুয়াল)' : '💡 Custom Estimator'}
                  </option>
                  {submissions.map((sub, idx) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.village || sub.union || `Entry #${idx + 1}`} ({sub.district}) — {sub.seedlings.length} {language === 'bn' ? 'প্রজাতি' : 'species'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Species & Date Pickers */}
              <div className={`grid gap-2 ${selectedSubmissionId === 'custom' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className="flex flex-col gap-1">
                  <label className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">
                    {language === 'bn' ? 'গাছের প্রজাতি' : 'Tree Species'}
                  </label>
                  {selectedSubmissionId !== 'custom' && submissionSpeciesList.length > 0 ? (
                    <select
                      value={selectedSpecies}
                      onChange={(e) => setSelectedSpecies(e.target.value)}
                      className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-1.5 text-xs text-gray-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                    >
                      {submissionSpeciesList.map(se => (
                        <option key={se.speciesName} value={se.speciesName}>
                          {language === 'bn' ? (SPECIES_GROWTH_PARAMS[se.speciesName]?.bnName || se.speciesName) : (SPECIES_GROWTH_PARAMS[se.speciesName]?.enName || se.speciesName)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={selectedSpecies}
                      onChange={(e) => setSelectedSpecies(e.target.value)}
                      className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-1.5 text-xs text-gray-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                    >
                      {Object.keys(SPECIES_GROWTH_PARAMS).map(key => {
                        const p = SPECIES_GROWTH_PARAMS[key];
                        return (
                          <option key={key} value={key}>
                            {language === 'bn' ? p.bnName : p.enName}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">
                    {language === 'bn' ? 'রোপণের তারিখ' : 'Planting Date'}
                  </label>
                  {selectedSubmissionId === 'custom' ? (
                    <input
                      type="date"
                      value={customPlantingDate}
                      onChange={(e) => setCustomPlantingDate(e.target.value)}
                      className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-1 text-xs text-gray-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                    />
                  ) : (
                    <div className="w-full bg-gray-50 border border-gray-150 rounded-lg p-1.5 text-xs text-gray-500 font-semibold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                      <span>{activePlantingDate}</span>
                    </div>
                  )}
                </div>

                {selectedSubmissionId === 'custom' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">
                      {language === 'bn' ? 'জলবায়ু অঞ্চল' : 'Climate Zone'}
                    </label>
                    <select
                      value={customDistrict}
                      onChange={(e) => setCustomDistrict(e.target.value)}
                      className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-1.5 text-xs text-gray-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                    >
                      <option value="Rajshahi">{language === 'bn' ? 'বরেন্দ্র (রাজশাহী)' : 'Barind (Rajshahi)'}</option>
                      <option value="Dhaka">{language === 'bn' ? 'পলল সমতল (ঢাকা)' : 'Plain (Dhaka)'}</option>
                      <option value="Sylhet">{language === 'bn' ? 'পাহাড়ি বনাঞ্চল (সিলেট)' : 'Hills (Sylhet)'}</option>
                      <option value="Khulna">{language === 'bn' ? 'লবণাক্ত উপকূল (খুলনা)' : 'Coastal (Khulna)'}</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Growth & Health Prognosis Card */}
              <div className={`p-3 rounded-xl border flex flex-col gap-2.5 ${
                healthPrognosis.healthStatus === 'excellent' ? 'bg-emerald-50/40 border-emerald-100 text-emerald-950 shadow-xs' :
                healthPrognosis.healthStatus === 'good' ? 'bg-lime-50/40 border-lime-100 text-lime-950 shadow-xs' :
                healthPrognosis.healthStatus === 'fair' ? 'bg-amber-50/40 border-amber-100 text-amber-950 shadow-xs' :
                'bg-rose-50/40 border-rose-100 text-rose-950 shadow-xs'
              }`}>
                <div className="flex items-center justify-between border-b border-gray-100/60 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Activity className={`w-3.5 h-3.5 ${
                      healthPrognosis.healthStatus === 'excellent' ? 'text-emerald-600' :
                      healthPrognosis.healthStatus === 'good' ? 'text-lime-600' :
                      healthPrognosis.healthStatus === 'fair' ? 'text-amber-600' : 'text-rose-600'
                    }`} />
                    <span className="font-bold text-[11px] text-gray-800">
                      {language === 'bn' ? 'স্বাস্থ্য ও প্রবৃদ্ধি বিশ্লেষণ' : 'Health & Growth Prognosis'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase ${
                    healthPrognosis.healthStatus === 'excellent' ? 'bg-emerald-500/10 text-emerald-700' :
                    healthPrognosis.healthStatus === 'good' ? 'bg-lime-500/10 text-lime-700' :
                    healthPrognosis.healthStatus === 'fair' ? 'bg-amber-500/10 text-amber-700' :
                    'bg-rose-500/10 text-rose-700'
                  }`}>
                    {healthPrognosis.healthStatus === 'excellent' && (language === 'bn' ? 'চমৎকার' : 'Excellent')}
                    {healthPrognosis.healthStatus === 'good' && (language === 'bn' ? 'ভালো' : 'Good')}
                    {healthPrognosis.healthStatus === 'fair' && (language === 'bn' ? 'মধ্যম' : 'Fair')}
                    {healthPrognosis.healthStatus === 'critical' && (language === 'bn' ? 'ঝুঁকিপূর্ণ' : 'Critical')}
                  </span>
                </div>

                <div className="flex flex-col text-left">
                  <span className="font-sans font-extrabold text-gray-800 text-xs">
                    {selectedSpecies} <span className="text-[10px] text-gray-400 font-serif italic font-normal">({SPECIES_GROWTH_PARAMS[selectedSpecies]?.scientificName || 'Tropical Species'})</span>
                  </span>
                </div>

                {/* Survival Rate */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-500 font-medium">{language === 'bn' ? 'বেঁচে থাকার সম্ভাবনা' : 'Survival Probability'}</span>
                    <span className="font-bold text-gray-700">{toBnNum(healthPrognosis.survivalProbabilityPercent)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      healthPrognosis.survivalProbabilityPercent >= 90 ? 'bg-emerald-500' :
                      healthPrognosis.survivalProbabilityPercent >= 75 ? 'bg-lime-500' :
                      healthPrognosis.survivalProbabilityPercent >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                    }`} style={{ width: `${healthPrognosis.survivalProbabilityPercent}%` }} />
                  </div>
                </div>

                {/* Growth Metrics Grid */}
                <div className="grid grid-cols-3 gap-1 bg-white/60 border border-gray-100 rounded-xl p-2 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{language === 'bn' ? 'উচ্চতা' : 'Height'}</span>
                    <span className="text-xs font-black text-emerald-800 font-mono mt-0.5">{toBnNum(healthPrognosis.expectedHeightMeters)}m</span>
                    <span className="text-[8.5px] text-gray-400">{toBnNum(parseFloat((healthPrognosis.expectedHeightMeters * 3.28084).toFixed(1)))} ft</span>
                  </div>
                  <div className="flex flex-col items-center justify-center border-x border-gray-150/40">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{language === 'bn' ? 'ক্যানোপি' : 'Canopy'}</span>
                    <span className="text-xs font-black text-emerald-800 font-mono mt-0.5">{toBnNum(parseFloat((healthPrognosis.expectedCanopyRadiusMeters * 2).toFixed(2)))}m</span>
                    <span className="text-[8.5px] text-gray-400">{language === 'bn' ? 'ব্যাস' : 'Diameter'}</span>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{language === 'bn' ? 'বয়স' : 'Age'}</span>
                    <span className="text-xs font-bold text-emerald-800 mt-0.5">{toBnNum(healthPrognosis.monthsElapsed + 6)} {language === 'bn' ? 'মাস' : 'Mo.'}</span>
                    <span className="text-[8.5px] text-gray-400">(+৬ {language === 'bn' ? 'চারা চত্বর' : 'nursery'})</span>
                  </div>
                </div>

                {/* Season */}
                <div className="flex items-center justify-between text-[10px] bg-white/40 rounded-lg p-1.5 border border-gray-100">
                  <span className="text-gray-500 font-medium">
                    {language === 'bn' ? '🍂 রোপণকালীন ঋতু:' : '🍂 Planting Season:'}
                  </span>
                  <span className="font-bold text-gray-700 text-[9.5px]">
                    {language === 'bn' ? healthPrognosis.plantingSeasonBn : healthPrognosis.plantingSeasonEn}
                  </span>
                </div>
              </div>

              {/* Regional Benchmark & Alerts */}
              <div className={`p-3 rounded-xl border flex flex-col gap-2.5 ${
                healthPrognosis.growthAlertLevel === 'optimal' ? 'bg-emerald-50/25 border-emerald-500/20 text-emerald-950' :
                healthPrognosis.growthAlertLevel === 'normal' ? 'bg-lime-50/25 border-lime-500/20 text-lime-950' :
                healthPrognosis.growthAlertLevel === 'underperforming' ? 'bg-amber-50/30 border-amber-500/30 text-amber-950 animate-pulse' :
                'bg-rose-50/30 border-rose-500/30 text-rose-950'
              }`}>
                <div className="flex items-center gap-1.5 border-b border-gray-150/40 pb-1.5 justify-between">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className={`w-3.5 h-3.5 ${
                      healthPrognosis.growthAlertLevel === 'optimal' ? 'text-emerald-600' :
                      healthPrognosis.growthAlertLevel === 'normal' ? 'text-lime-600' :
                      healthPrognosis.growthAlertLevel === 'underperforming' ? 'text-amber-600' : 'text-rose-600'
                    }`} />
                    <span className="font-bold text-[11px] text-gray-800">
                      {language === 'bn' ? 'আঞ্চলিক প্রবৃদ্ধি সূচক' : 'Regional Growth Benchmark'}
                    </span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase ${
                    healthPrognosis.growthAlertLevel === 'optimal' ? 'bg-emerald-100 text-emerald-800' :
                    healthPrognosis.growthAlertLevel === 'normal' ? 'bg-lime-100 text-lime-800' :
                    healthPrognosis.growthAlertLevel === 'underperforming' ? 'bg-amber-100 text-amber-800' :
                    'bg-rose-100 text-rose-800'
                  }`}>
                    {healthPrognosis.growthAlertLevel === 'optimal' && (language === 'bn' ? 'অনুকূল' : 'Optimal')}
                    {healthPrognosis.growthAlertLevel === 'normal' && (language === 'bn' ? 'স্বাভাবিক' : 'Normal')}
                    {healthPrognosis.growthAlertLevel === 'underperforming' && (language === 'bn' ? 'মন্থর' : 'Slow')}
                    {healthPrognosis.growthAlertLevel === 'severely_underperforming' && (language === 'bn' ? 'মারাত্মক' : 'Stunted')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex flex-col bg-white/40 border border-gray-100 rounded-lg p-1.5 text-left">
                    <span className="text-gray-400 font-bold uppercase text-[7.5px] tracking-wider">{language === 'bn' ? 'অঞ্চল ও মাটি' : 'Region & Soil'}</span>
                    <span className="font-semibold text-gray-700 mt-0.5 leading-snug">
                      {language === 'bn' ? healthPrognosis.regionalBenchmark.regionNameBn : healthPrognosis.regionalBenchmark.regionNameEn}
                    </span>
                    <span className="text-[8.5px] text-gray-500 italic mt-0.5">
                      {language === 'bn' ? healthPrognosis.regionalBenchmark.soilTypeBn : healthPrognosis.regionalBenchmark.soilTypeEn}
                    </span>
                  </div>
                  <div className="flex flex-col bg-white/40 border border-gray-100 rounded-lg p-1.5 text-left">
                    <span className="text-gray-400 font-bold uppercase text-[7.5px] tracking-wider">{language === 'bn' ? 'উপযোগিতা' : 'Suitability'}</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-black text-xs text-emerald-800">{toBnNum(healthPrognosis.regionalBenchmark.suitabilityScore)}/১০০</span>
                    </div>
                    <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${healthPrognosis.regionalBenchmark.suitabilityScore}%` }} />
                    </div>
                  </div>
                </div>

                {/* Performance bar */}
                <div className="flex flex-col bg-white/50 border border-gray-100 rounded-lg p-2 gap-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-gray-500 font-medium">{language === 'bn' ? 'বেঞ্চমার্ক vs প্রকৃত' : 'Growth vs Benchmark'}</span>
                    <span className="font-extrabold">{toBnNum(healthPrognosis.performanceIndexPercent)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-150 rounded-full overflow-hidden relative flex">
                    <div className="absolute top-0 bottom-0 left-[85%] w-0.5 bg-amber-500/40 z-10" />
                    <div className="absolute top-0 bottom-0 left-[70%] w-0.5 bg-rose-500/40 z-10" />
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      healthPrognosis.growthAlertLevel === 'optimal' ? 'bg-emerald-500' :
                      healthPrognosis.growthAlertLevel === 'normal' ? 'bg-lime-500' :
                      healthPrognosis.growthAlertLevel === 'underperforming' ? 'bg-amber-500' : 'bg-rose-500'
                    }`} style={{ width: `${Math.min(100, healthPrognosis.performanceIndexPercent)}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500 border-t border-gray-100 pt-1 mt-0.5 font-mono">
                    <div className="flex flex-col text-left">
                      <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider">{language === 'bn' ? 'প্রকৃত হার' : 'Actual'}</span>
                      <span className="font-extrabold text-gray-700 mt-0.5">{toBnNum(healthPrognosis.actualGrowthRateMetersPerYear)} m/yr</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider">{language === 'bn' ? 'বেঞ্চমার্ক' : 'Benchmark'}</span>
                      <span className="font-extrabold text-gray-700 mt-0.5">{toBnNum(healthPrognosis.regionalBenchmark.benchmarkGrowthMetersPerYear)} m/yr</span>
                    </div>
                  </div>
                </div>

                {/* Alert message */}
                <div className={`p-2 rounded-lg border text-[9.5px] leading-relaxed text-left flex gap-1.5 ${
                  healthPrognosis.growthAlertLevel === 'optimal' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-900' :
                  healthPrognosis.growthAlertLevel === 'normal' ? 'bg-lime-500/5 border-lime-500/10 text-lime-900' :
                  healthPrognosis.growthAlertLevel === 'underperforming' ? 'bg-amber-500/5 border-amber-500/15 text-amber-900' :
                  'bg-rose-500/5 border-rose-500/15 text-rose-900'
                }`}>
                  <span className="text-xs shrink-0 select-none mt-0.5">
                    {healthPrognosis.growthAlertLevel === 'optimal' ? '✅' : healthPrognosis.growthAlertLevel === 'normal' ? '🌱' : healthPrognosis.growthAlertLevel === 'underperforming' ? '⚠️' : '🚨'}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-bold">{language === 'bn' ? 'প্রবৃদ্ধি স্থিতি:' : 'Growth Status:'}</span>
                    <p className="text-gray-700 font-sans mt-0.5 leading-relaxed">
                      {language === 'bn' ? healthPrognosis.growthAlertMsgBn : healthPrognosis.growthAlertMsgEn}
                    </p>
                  </div>
                </div>
              </div>

              {/* Advisory */}
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] leading-relaxed flex gap-1.5 text-left">
                <span className="text-xs select-none shrink-0">💡</span>
                <div className="flex flex-col">
                  <span className="font-bold text-amber-900 mb-0.5">{language === 'bn' ? 'কৃষি পরামর্শ' : 'Silviculture Advice'}</span>
                  <p className="text-gray-700 leading-relaxed font-sans">
                    {language === 'bn' ? healthPrognosis.advisoryBn : healthPrognosis.advisoryEn}
                  </p>
                </div>
              </div>

              <p className="text-[8.5px] text-gray-400 leading-relaxed text-center italic">
                {language === 'bn'
                  ? '* বাংলাদেশের জলবায়ু ও বন বিভাগ নির্দেশিকা বিশ্লেষণ করে এই প্রাক্কলন।'
                  : '* Based on Bangladesh climate and Forest Department silviculture guidelines.'}
              </p>
            </div>
          )}

          {/* ============ WEALTH TAB ============ */}
          {activeTab === 'wealth' && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Level & XP bar */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-500/10 rounded-xl">
                      <Award className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800">
                        {language === 'bn' ? 'লেভেল' : 'Level'} {toBnNum(Math.floor((session?.xp ?? 0) / 100) + 1)}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {toBnNum((session?.xp ?? 0) % 100)} / ১০০ XP
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-black text-emerald-700">{toBnNum(session?.xp ?? 0)}</p>
                      <p className="text-[9px] text-gray-500">{language === 'bn' ? 'মোট XP' : 'Total XP'}</p>
                    </div>
                    <div className="w-px h-8 bg-gray-200" />
                    <div className="text-right">
                      <p className="text-lg font-black text-amber-600">{toBnNum(session?.greenTokens ?? 0)}</p>
                      <p className="text-[9px] text-gray-500">{language === 'bn' ? 'গ্রিন টোকেন' : 'Green Tokens'}</p>
                    </div>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${((session?.xp ?? 0) % 100)}%` }} />
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-gray-600">{language === 'bn' ? 'ধারাবাহিকতা' : 'Streak'}:</span>
                  <span className="font-bold text-amber-700">{toBnNum(session?.streakCount ?? 0)} {language === 'bn' ? 'দিন' : 'days'}</span>
                </div>
              </div>

              {/* Cumulative submission rewards */}
              {totalLogs > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    {language === 'bn' ? 'জমা থেকে অর্জিত' : 'Earned from Submissions'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-xl font-black text-emerald-700">{toBnNum(totalXpEarned)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{language === 'bn' ? 'মোট XP (জমা)' : 'Total Submission XP'}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3 text-center">
                      <p className="text-xl font-black text-amber-700">{toBnNum(totalTokensEarned)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{language === 'bn' ? 'মোট টোকেন (জমা)' : 'Total Submission Tokens'}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    {language === 'bn'
                      ? `গড়ে প্রতি এন্ট্রিতে ${toBnNum(Math.round(totalXpEarned / totalLogs))} XP ও ${toBnNum(Math.round(totalTokensEarned / totalLogs))} টোকেন`
                      : `Avg ${Math.round(totalXpEarned / totalLogs)} XP + ${Math.round(totalTokensEarned / totalLogs)} tokens per entry`}
                  </p>
                </div>
              )}

              {/* Token earning guide */}
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-2.5">
                <h4 className="font-bold text-sm text-amber-800 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-600" />
                  {language === 'bn' ? 'টোকেন অর্জনের উপায়' : 'How to Earn More'}
                </h4>
                <div className="grid grid-cols-1 gap-1.5 text-[11px]">
                  {[
                    { label: language === 'bn' ? 'ফর্ম জমা (বেস)' : 'Form submit (base)', xp: 10, token: 2 },
                    { label: language === 'bn' ? 'সম্পূর্ণ অবস্থান (৫ ফিল্ড)' : 'Full location (5 fields)', xp: 5, token: 3 },
                    { label: language === 'bn' ? 'নির্ভুল GPS (<১০০মি)' : 'Precise GPS (<100m)', xp: 5, token: 2 },
                    { label: language === 'bn' ? 'যাচাইকরণ GPS' : 'Verification GPS', xp: 8, token: 3 },
                    { label: language === 'bn' ? 'প্রতিটি প্রজাতি' : 'Per species', xp: 2, token: 1 },
                    { label: language === 'bn' ? 'প্রতিটি ছবি প্রমাণ' : 'Per photo evidence', xp: 2, token: 1 },
                    { label: language === 'bn' ? 'পরিচর্যাকারী তথ্য' : 'Caretaker info', xp: 3, token: 1 },
                    { label: language === 'bn' ? 'SAAO / মনিটরিং অফিসার' : 'SAAO / Monitoring officer', xp: 3, token: 1 },
                    { label: language === 'bn' ? 'NID দিয়ে প্রোফাইল' : 'Profile with NID', xp: 0, token: 10 },
                    { label: language === 'bn' ? 'চাকরি নং দিয়ে প্রোফাইল' : 'Profile with Job ID', xp: 0, token: 10 },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between bg-white/60 rounded-lg px-2.5 py-1.5 border border-amber-100/50">
                      <span className="text-gray-700">{item.label}</span>
                      <span className="font-mono font-bold text-gray-500 text-[10px] shrink-0 ml-2">
                        {item.xp > 0 ? `+${item.xp}XP` : ''}{item.xp > 0 && item.token > 0 ? ' ' : ''}{item.token > 0 ? `+${item.token}🪙` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data richness tip */}
              <div className="p-2.5 rounded-xl border bg-emerald-50/50 border-emerald-100/80 text-emerald-800 text-[10.5px] leading-relaxed flex gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <p>
                  {language === 'bn'
                    ? 'তথ্য যত বেশি প্রদান করবেন, টোকেন তত বেশি পাবেন! GPS, ছবি, যাচাইকরণ এবং সম্পূর্ণ অবস্থান তথ্য দিলে সর্বোচ্চ পুরস্কার পাবেন।'
                    : 'The more data you provide, the more tokens you earn! GPS, photos, verification, and complete location info yield maximum rewards.'}
                </p>
              </div>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
}