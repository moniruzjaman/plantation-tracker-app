import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Leaf, 
  BarChart3, 
  TrendingUp, 
  MapPin, 
  X, 
  Info,
  CheckCircle,
  Clock,
  Settings,
  Flame,
  Globe2,
  TreePine,
  Activity,
  Calendar,
  Droplet
} from 'lucide-react';
import { calculateCarbonSequestration } from '../utils/carbonMath';
import { calculateGrowthPrognosis, SPECIES_GROWTH_PARAMS } from '../utils/growthModel';

export interface Seedling {
  name: string;
  age: string;
  count: string | number;
  graftingCount: string | number;
}

export interface Submission {
  id: string;
  region: string;
  district: string;
  upazila: string;
  nurseryName: string;
  mobile: string;
  caretakerName?: string;
  caretakerMobile?: string;
  address?: string;
  geoLocation?: string;
  plantingDate?: string;
  submittedAt?: string;
  synced?: boolean;
  fruitSeedlings?: Seedling[];
  forestSeedlings?: Seedling[];
  medicinalSeedlings?: Seedling[];
}

interface OfflinePlantationDashboardProps {
  onStateChange?: (submissions: Submission[]) => void;
}

export default function OfflinePlantationDashboard({ onStateChange }: OfflinePlantationDashboardProps = {}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'metrics' | 'health'>('metrics');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string>('custom');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('আম');
  const [customPlantingDate, setCustomPlantingDate] = useState<string>('2026-03-15');
  const [customDistrict, setCustomDistrict] = useState<string>('Rajshahi');

  // Get currently selected submission
  const selectedSubmission = submissions.find(s => s.id === selectedSubmissionId);

  // Determine planting district/region to use
  const activeDistrict = selectedSubmission?.district || customDistrict;

  // Extract all species present in the selected submission
  const submissionSpeciesList = useMemo(() => {
    if (!selectedSubmission) return [];
    const list: string[] = [];
    const extract = (seedlings?: Seedling[]) => {
      if (seedlings && Array.isArray(seedlings)) {
        seedlings.forEach(item => {
          if (item.name && !list.includes(item.name)) {
            list.push(item.name);
          }
        });
      }
    };
    extract(selectedSubmission.fruitSeedlings);
    extract(selectedSubmission.forestSeedlings);
    extract(selectedSubmission.medicinalSeedlings);
    return list;
  }, [selectedSubmission]);

  // Sync selected species when selected submission changes
  useEffect(() => {
    if (selectedSubmissionId === 'custom') {
      if (!SPECIES_GROWTH_PARAMS[selectedSpecies]) {
        setSelectedSpecies('আম');
      }
    } else if (submissionSpeciesList.length > 0) {
      setSelectedSpecies(submissionSpeciesList[0]);
    }
  }, [selectedSubmissionId, submissionSpeciesList]);

  // Determine planting date to use
  const activePlantingDate = selectedSubmission?.plantingDate || customPlantingDate;

  // Run the health prognosis model!
  const healthPrognosis = useMemo(() => {
    return calculateGrowthPrognosis(selectedSpecies, activePlantingDate, activeDistrict);
  }, [selectedSpecies, activePlantingDate, activeDistrict]);

  // Invoke callback when submissions list updates
  useEffect(() => {
    if (onStateChange) {
      onStateChange(submissions);
    }
  }, [submissions, onStateChange]);

  // Fetch submissions from localStorage
  const fetchSubmissions = () => {
    try {
      const dataStr = localStorage.getItem('nursery_submissions');
      const sheetDataStr = localStorage.getItem('google_sheet_submissions');
      
      let localSubmissions: Submission[] = [];
      let sheetSubmissions: Submission[] = [];
      
      if (dataStr) {
        const parsed = JSON.parse(dataStr) as Submission[];
        if (Array.isArray(parsed)) {
          localSubmissions = parsed;
        }
      }
      
      if (sheetDataStr) {
        const parsed = JSON.parse(sheetDataStr) as Submission[];
        if (Array.isArray(parsed)) {
          sheetSubmissions = parsed;
        }
      }
      
      setSubmissions([...localSubmissions, ...sheetSubmissions]);
      setLastUpdated(new Date().toLocaleTimeString(language === 'bn' ? 'bn-BD' : 'en-US'));
    } catch (e) {
      console.error('Error reading submissions from localStorage:', e);
    }
  };

  useEffect(() => {
    // Initial load
    fetchSubmissions();

    // Set up a periodic poller to catch changes made inside the iframe instantly
    const interval = setInterval(fetchSubmissions, 1500);

    // Listen to storage events from other tabs/frames
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nursery_submissions') {
        fetchSubmissions();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [language]);

  // Compute stats
  const totalLogs = submissions.length;
  
  let totalSeedlings = 0;
  let fruitCount = 0;
  let forestCount = 0;
  let medicinalCount = 0;

  // Track districts represented in offline submissions
  const districtMap: { [key: string]: number } = {};

  let totalCarbon = 0;

  submissions.forEach(s => {
    // Calculate seedling counts
    const countCategory = (list?: Seedling[]) => {
      let sum = 0;
      if (list && Array.isArray(list)) {
        list.forEach(item => {
          sum += (parseInt(item.count as string) || 0) + (parseInt(item.graftingCount as string) || 0);
        });
      }
      return sum;
    };

    const f = countCategory(s.fruitSeedlings);
    const fo = countCategory(s.forestSeedlings);
    const m = countCategory(s.medicinalSeedlings);

    fruitCount += f;
    forestCount += fo;
    medicinalCount += m;
    totalSeedlings += (f + fo + m);

    // Calculate carbon sequestration for this submission
    const mapToSeedlingItems = (list?: Seedling[]) => {
      if (!list) return [];
      return list.map(item => ({
        speciesName: item.name,
        count: parseInt(item.count as string) || 0,
        graftingCount: parseInt(item.graftingCount as string) || 0
      }));
    };
    const c = calculateCarbonSequestration(
      mapToSeedlingItems(s.fruitSeedlings),
      mapToSeedlingItems(s.forestSeedlings),
      mapToSeedlingItems(s.medicinalSeedlings)
    );
    totalCarbon += c;

    // Track district stats
    if (s.district) {
      districtMap[s.district] = (districtMap[s.district] || 0) + 1;
    }
  });

  const sortedDistricts = Object.entries(districtMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Translate numbers to Bengali
  const toBnNum = (num: number): string => {
    if (language === 'en') return num.toLocaleString('en-US');
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, d => bnDigits[parseInt(d)]);
  };

  // Text translations
  const t = {
    title: language === 'bn' ? 'অফলাইন ট্র্যাকার' : 'Offline Tracker',
    dashboardTitle: language === 'bn' ? 'অফলাইন ডেটা ড্যাশবোর্ড' : 'Offline Data Dashboard',
    totalBatches: language === 'bn' ? 'মোট অফলাইন রেকর্ড' : 'Total Offline Records',
    totalPlanted: language === 'bn' ? 'মোট রোপণকৃত চারা' : 'Total Seedlings Planted',
    fruit: language === 'bn' ? 'ফলদ চারা' : 'Fruit Seedlings',
    forest: language === 'bn' ? 'বনজ চারা' : 'Forest Seedlings',
    medicinal: language === 'bn' ? 'ঔষধি চারা' : 'Medicinal Seedlings',
    regionalSpread: language === 'bn' ? 'অঞ্চলভিত্তিক বন্টন' : 'District Breakdown',
    noData: language === 'bn' ? 'কোনো ডাটা পাওয়া যায়নি' : 'No records logged yet',
    syncTip: language === 'bn' ? 'সকল ডাটা আপনার ডিভাইসে নিরাপদে অফলাইনে সংরক্ষিত আছে।' : 'All data is securely saved offline in your browser.',
    btnToggle: language === 'bn' ? 'English' : 'বাংলা',
    lastSync: language === 'bn' ? 'আপডেট:' : 'Updated:',
    targetText: language === 'bn' ? 'জাতীয় লক্ষ্যমাত্রা অগ্রগতি' : 'National Goal Progress',
    of: language === 'bn' ? 'এর মধ্যে' : 'of',
  };

  return (
    <div className="hidden md:block absolute top-4 left-4 z-50 pointer-events-none font-sans" id="offlineDashboardContainer">
      <div className="flex flex-col items-start gap-2 pointer-events-auto">
        
        {/* Compact Toggle Button */}
        <motion.button
          id="offlineDashboardToggleBtn"
          layout
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border backdrop-blur-sm transition-all text-xs font-semibold cursor-pointer ${
            totalLogs > 0 
              ? 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-700' 
              : 'bg-white/95 border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${totalLogs > 0 ? 'bg-white' : 'bg-emerald-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${totalLogs > 0 ? 'bg-white' : 'bg-emerald-500'}`}></span>
          </div>

          <Database className="w-4 h-4 shrink-0 transition-transform duration-300" />
          
          <span>
            {t.title}: <strong className="font-bold">{toBnNum(totalLogs)}</strong> {language === 'bn' ? 'টি' : (totalLogs === 1 ? 'Batch' : 'Batches')}
          </span>
        </motion.button>

        {/* Detailed Information Dashboard Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              id="offlineDashboardDetailsPanel"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-80 bg-white border border-gray-150 rounded-2xl p-4 shadow-xl text-gray-800 text-xs flex flex-col gap-3.5"
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
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  {/* Lang Switch */}
                  <button
                    id="dashLangToggle"
                    onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
                    className="px-2 py-0.5 rounded border border-gray-200 hover:border-gray-300 active:bg-gray-50 text-[10px] bg-white font-semibold text-gray-600 transition-colors flex items-center gap-1"
                  >
                    <Globe2 className="w-3 h-3 text-gray-400" />
                    {t.btnToggle}
                  </button>
                  {/* Close btn */}
                  <button
                    id="dashCloseBtn"
                    onClick={() => setIsExpanded(false)}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tab Switcher */}
              <div className="flex border-b border-gray-100 p-0.5 bg-gray-50 rounded-xl">
                <button
                  id="tabMetricsBtn"
                  onClick={() => setActiveTab('metrics')}
                  className={`flex-1 py-1.5 rounded-lg text-center font-bold transition-all text-[11px] cursor-pointer ${
                    activeTab === 'metrics'
                      ? 'bg-white text-emerald-700 shadow-sm border border-gray-200/50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {language === 'bn' ? '📊 পরিসংখ্যান' : '📊 Metrics'}
                </button>
                <button
                  id="tabHealthBtn"
                  onClick={() => setActiveTab('health')}
                  className={`flex-1 py-1.5 rounded-lg text-center font-bold transition-all text-[11px] cursor-pointer ${
                    activeTab === 'health'
                      ? 'bg-white text-emerald-700 shadow-sm border border-gray-200/50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {language === 'bn' ? '🌱 স্বাস্থ্য মনিটর' : '🌱 Health Monitor'}
                </button>
              </div>

              {activeTab === 'metrics' && (
                <div className="flex flex-col gap-3.5 animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* Grid Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    
                    {/* Metric 1: Batches */}
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                      <Clock className="w-4 h-4 text-emerald-600 mb-1" />
                      <span className="text-[10px] font-medium text-emerald-800 opacity-80 uppercase tracking-wider">{t.totalBatches}</span>
                      <span className="text-xl font-extrabold text-emerald-700 mt-1">{toBnNum(totalLogs)}</span>
                    </div>

                    {/* Metric 2: Seedlings */}
                    <div className="bg-lime-50/50 border border-lime-100 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                      <Leaf className="w-4 h-4 text-lime-600 mb-1" />
                      <span className="text-[10px] font-medium text-lime-800 opacity-80 uppercase tracking-wider">{t.totalPlanted}</span>
                      <span className="text-xl font-extrabold text-lime-700 mt-1">{toBnNum(totalSeedlings)}</span>
                    </div>

                    {/* Metric 3: Carbon Offsets (Full Width) */}
                    <div className="col-span-2 bg-gradient-to-r from-emerald-50/30 to-teal-50/30 border border-teal-100 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-700 shrink-0">
                          <TreePine className="w-4.5 h-4.5" />
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-[9.5px] font-bold text-teal-900 opacity-80 uppercase tracking-wider">
                            {language === 'bn' ? 'বার্ষিক কার্বন ডাই-অক্সাইড শোষণ' : 'Est. Annual CO2 Absorption'}
                          </span>
                          <span className="text-xs text-gray-500 font-medium">
                            {language === 'bn' ? 'আইপিসিসি টিয়ার-২ সূত্র দ্বারা পরিমাপকৃত' : 'IPCC Tier-2 scientific standard'}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-black text-emerald-700 font-mono shrink-0">
                        {language === 'bn' ? `${toBnNum(parseFloat(totalCarbon.toFixed(2)))} টন` : `${totalCarbon.toFixed(2)} Tons`}
                      </span>
                    </div>

                  </div>

                  {/* Seedlings Category Progress Meters */}
                  <div className="flex flex-col gap-2.5">
                    <span className="font-semibold text-gray-700 text-[11px] tracking-wide flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5 text-gray-400" />
                      {language === 'bn' ? 'চারাগাছের প্রকারভেদ' : 'Seedling Varieties'}
                    </span>

                    {/* Category A: Fruit */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-600 font-medium flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                          {t.fruit}
                        </span>
                        <span className="font-semibold text-gray-700">
                          {toBnNum(fruitCount)} {language === 'bn' ? 'টি' : ''}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="bg-orange-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${totalSeedlings > 0 ? (fruitCount / totalSeedlings) * 105 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Category B: Forest */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-600 font-medium flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                          {t.forest}
                        </span>
                        <span className="font-semibold text-gray-700">
                          {toBnNum(forestCount)} {language === 'bn' ? 'টি' : ''}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${totalSeedlings > 0 ? (forestCount / totalSeedlings) * 105 : 0}%` }}
                        />
                      </div>
                    </div>

                    {/* Category C: Medicinal */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-600 font-medium flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          {t.medicinal}
                        </span>
                        <span className="font-semibold text-gray-700">
                          {toBnNum(medicinalCount)} {language === 'bn' ? 'টি' : ''}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${totalSeedlings > 0 ? (medicinalCount / totalSeedlings) * 105 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

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

                  {/* Target progress context */}
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
                        : `Your nursery submissions contribute values toward the national 250M plantation target.`}
                    </p>
                  </div>

                  {/* Status and instruction tip */}
                  <div className="p-2.5 rounded-xl border bg-emerald-50/50 border-emerald-100/80 text-emerald-800 text-[10.5px] leading-relaxed flex gap-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <p>{t.syncTip}</p>
                  </div>
                </div>
              )}

              {activeTab === 'health' && (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
                  {/* Selector Header */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-bold text-gray-500 uppercase tracking-wider">
                      {language === 'bn' ? 'রোপণ ব্যাচ নির্বাচন করুন' : 'Select Plantation Batch'}
                    </label>
                    <select
                      id="selectHealthBatch"
                      value={selectedSubmissionId}
                      onChange={(e) => setSelectedSubmissionId(e.target.value)}
                      className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-1.5 text-xs text-gray-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                    >
                      <option value="custom">
                        {language === 'bn' ? '💡 প্রাক্কলন ক্যালকুলেটর (ম্যানুয়াল)' : '💡 Custom Estimator / Planner'}
                      </option>
                      {submissions.map((sub, idx) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.nurseryName || `Batch #${idx + 1}`} ({sub.district})
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
                          id="selectHealthSpecies"
                          value={selectedSpecies}
                          onChange={(e) => setSelectedSpecies(e.target.value)}
                          className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-1.5 text-xs text-gray-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                        >
                          {submissionSpeciesList.map(species => (
                            <option key={species} value={species}>
                              {language === 'bn' ? (SPECIES_GROWTH_PARAMS[species]?.bnName || species) : (SPECIES_GROWTH_PARAMS[species]?.enName || species)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select
                          id="selectHealthSpeciesManual"
                          value={selectedSpecies}
                          onChange={(e) => setSelectedSpecies(e.target.value)}
                          className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-1.5 text-xs text-gray-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                        >
                          {Object.keys(SPECIES_GROWTH_PARAMS).map(speciesKey => {
                            const p = SPECIES_GROWTH_PARAMS[speciesKey];
                            return (
                              <option key={speciesKey} value={speciesKey}>
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
                          id="inputHealthPlantingDate"
                          type="date"
                          value={customPlantingDate}
                          onChange={(e) => setCustomPlantingDate(e.target.value)}
                          max="2026-06-29"
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
                          id="selectHealthDistrict"
                          value={customDistrict}
                          onChange={(e) => setCustomDistrict(e.target.value)}
                          className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-lg p-1.5 text-xs text-gray-700 font-medium focus:ring-1 focus:ring-emerald-500 outline-none cursor-pointer"
                        >
                          <option value="Rajshahi">{language === 'bn' ? 'বরেন্দ্র (রাজশাহী)' : 'Barind (Rajshahi)'}</option>
                          <option value="Dhaka">{language === 'bn' ? 'পলল সমতল (ঢাকা)' : 'Plain (Dhaka)'}</option>
                          <option value="Sylhet">{language === 'bn' ? 'পাহাড়ি বনাঞ্চল (সিলেট)' : 'Hills (Sylhet)'}</option>
                          <option value="Khulna">{language === 'bn' ? 'লবণাক্ত উপকূল (খুলনা)' : 'Coastal (Khulna)'}</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Growth & Health Prognosis Metrics Card */}
                  <div className={`p-3 rounded-xl border flex flex-col gap-2.5 ${
                    healthPrognosis.healthStatus === 'excellent' ? 'bg-emerald-50/40 border-emerald-100 text-emerald-950 shadow-xs' :
                    healthPrognosis.healthStatus === 'good' ? 'bg-lime-50/40 border-lime-100 text-lime-950 shadow-xs' :
                    healthPrognosis.healthStatus === 'fair' ? 'bg-amber-50/40 border-amber-100 text-amber-950 shadow-xs' :
                    'bg-rose-50/40 border-rose-100 text-rose-950 shadow-xs'
                  }`}>
                    {/* Status Overall rating */}
                    <div className="flex items-center justify-between border-b border-gray-100/60 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Activity className={`w-3.5 h-3.5 ${
                          healthPrognosis.healthStatus === 'excellent' ? 'text-emerald-600' :
                          healthPrognosis.healthStatus === 'good' ? 'text-lime-600' :
                          healthPrognosis.healthStatus === 'fair' ? 'text-amber-600' :
                          'text-rose-600'
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

                    {/* Scientific details */}
                    <div className="flex flex-col text-left">
                      <span className="font-sans font-extrabold text-gray-800 text-xs">
                        {selectedSpecies} <span className="text-[10px] text-gray-400 font-serif italic font-normal">({SPECIES_GROWTH_PARAMS[selectedSpecies]?.scientificName || 'Tropical Species'})</span>
                      </span>
                    </div>

                    {/* Survival Rate Progress */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-500 font-medium">
                          {language === 'bn' ? 'বেঁচে থাকার সম্ভাবনা' : 'Survival Probability'}
                        </span>
                        <span className="font-bold text-gray-700">
                          {toBnNum(healthPrognosis.survivalProbabilityPercent)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            healthPrognosis.survivalProbabilityPercent >= 90 ? 'bg-emerald-500' :
                            healthPrognosis.survivalProbabilityPercent >= 75 ? 'bg-lime-500' :
                            healthPrognosis.survivalProbabilityPercent >= 60 ? 'bg-amber-500' :
                            'bg-rose-500'
                          }`}
                          style={{ width: `${healthPrognosis.survivalProbabilityPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Growth Metrics Grid */}
                    <div className="grid grid-cols-3 gap-1 bg-white/60 border border-gray-100 rounded-xl p-2 text-center">
                      
                      {/* Metric 1: Height */}
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">
                          {language === 'bn' ? 'উচ্চতা' : 'Height'}
                        </span>
                        <span className="text-xs font-black text-emerald-800 font-mono mt-0.5">
                          {toBnNum(healthPrognosis.expectedHeightMeters)}m
                        </span>
                        <span className="text-[8.5px] text-gray-400">
                          {toBnNum(parseFloat((healthPrognosis.expectedHeightMeters * 3.28084).toFixed(1)))} ft
                        </span>
                      </div>

                      {/* Metric 2: Canopy Radius */}
                      <div className="flex flex-col items-center justify-center border-x border-gray-150/40">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">
                          {language === 'bn' ? 'ক্যানোপি' : 'Canopy'}
                        </span>
                        <span className="text-xs font-black text-emerald-800 font-mono mt-0.5">
                          {toBnNum(parseFloat((healthPrognosis.expectedCanopyRadiusMeters * 2).toFixed(2)))}m
                        </span>
                        <span className="text-[8.5px] text-gray-400">
                          {language === 'bn' ? 'ব্যাস' : 'Diameter'}
                        </span>
                      </div>

                      {/* Metric 3: Age */}
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">
                          {language === 'bn' ? 'বয়স' : 'Age'}
                        </span>
                        <span className="text-xs font-bold text-emerald-800 mt-0.5">
                          {toBnNum(healthPrognosis.monthsElapsed + 6)} {language === 'bn' ? 'মাস' : 'Mo.'}
                        </span>
                        <span className="text-[8.5px] text-gray-400">
                          (+৬ চারা চত্বর)
                        </span>
                      </div>

                    </div>

                    {/* Season Indicator */}
                    <div className="flex items-center justify-between text-[10px] bg-white/40 rounded-lg p-1.5 border border-gray-100">
                      <span className="text-gray-500 font-medium">
                        🍂 {language === 'bn' ? 'রোপণকালীন ঋতু:' : 'Planting Season:'}
                      </span>
                      <span className="font-bold text-gray-700 text-[9.5px]">
                        {language === 'bn' ? healthPrognosis.plantingSeasonBn : healthPrognosis.plantingSeasonEn}
                      </span>
                    </div>

                  </div>

                  {/* Regional Benchmark & Threshold Alerts */}
                  <div className={`p-3 rounded-xl border flex flex-col gap-2.5 ${
                    healthPrognosis.growthAlertLevel === 'optimal' ? 'bg-emerald-50/25 border-emerald-500/20 text-emerald-950' :
                    healthPrognosis.growthAlertLevel === 'normal' ? 'bg-lime-50/25 border-lime-500/20 text-lime-950' :
                    healthPrognosis.growthAlertLevel === 'underperforming' ? 'bg-amber-50/30 border-amber-500/30 text-amber-950 animate-pulse' :
                    'bg-rose-50/30 border-rose-500/30 text-rose-950'
                  }`}>
                    {/* Header */}
                    <div className="flex items-center gap-1.5 border-b border-gray-150/40 pb-1.5 justify-between">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className={`w-3.5 h-3.5 ${
                          healthPrognosis.growthAlertLevel === 'optimal' ? 'text-emerald-600' :
                          healthPrognosis.growthAlertLevel === 'normal' ? 'text-lime-600' :
                          healthPrognosis.growthAlertLevel === 'underperforming' ? 'text-amber-600' :
                          'text-rose-600'
                        }`} />
                        <span className="font-bold text-[11px] text-gray-800">
                          {language === 'bn' ? 'আঞ্চলিক প্রবৃদ্ধি সূচক ও অ্যালার্ট' : 'Regional Growth Benchmark & Alert'}
                        </span>
                      </div>
                      
                      <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase ${
                        healthPrognosis.growthAlertLevel === 'optimal' ? 'bg-emerald-100 text-emerald-800' :
                        healthPrognosis.growthAlertLevel === 'normal' ? 'bg-lime-100 text-lime-800' :
                        healthPrognosis.growthAlertLevel === 'underperforming' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {healthPrognosis.growthAlertLevel === 'optimal' && (language === 'bn' ? 'অনুকূল প্রবৃদ্ধি' : 'Optimal')}
                        {healthPrognosis.growthAlertLevel === 'normal' && (language === 'bn' ? 'স্বাভাবিক প্রবৃদ্ধি' : 'Normal')}
                        {healthPrognosis.growthAlertLevel === 'underperforming' && (language === 'bn' ? 'মন্থর চারা' : 'Underperforming')}
                        {healthPrognosis.growthAlertLevel === 'severely_underperforming' && (language === 'bn' ? 'মারাত্মক মন্থর' : 'Stunted')}
                      </span>
                    </div>

                    {/* Regional Info Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div className="flex flex-col bg-white/40 border border-gray-100 rounded-lg p-1.5 text-left">
                        <span className="text-gray-400 font-bold uppercase text-[7.5px] tracking-wider">
                          {language === 'bn' ? 'অঞ্চল ও মাটি' : 'Region & Soil'}
                        </span>
                        <span className="font-semibold text-gray-700 mt-0.5 leading-snug">
                          {language === 'bn' ? healthPrognosis.regionalBenchmark.regionNameBn : healthPrognosis.regionalBenchmark.regionNameEn}
                        </span>
                        <span className="text-[8.5px] text-gray-500 italic mt-0.5">
                          {language === 'bn' ? healthPrognosis.regionalBenchmark.soilTypeBn : healthPrognosis.regionalBenchmark.soilTypeEn}
                        </span>
                      </div>

                      <div className="flex flex-col bg-white/40 border border-gray-100 rounded-lg p-1.5 text-left">
                        <span className="text-gray-400 font-bold uppercase text-[7.5px] tracking-wider">
                          {language === 'bn' ? 'আঞ্চলিক উপযোগিতা' : 'Regional Suitability'}
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="font-black text-xs text-emerald-800">
                            {toBnNum(healthPrognosis.regionalBenchmark.suitabilityScore)}/১০০
                          </span>
                          <span className="text-[8.5px] text-gray-400 font-medium">
                            ({healthPrognosis.regionalBenchmark.suitabilityScore >= 90 ? (language === 'bn' ? 'দারুণ' : 'High') :
                              healthPrognosis.regionalBenchmark.suitabilityScore >= 75 ? (language === 'bn' ? 'অনুকূল' : 'Good') :
                              healthPrognosis.regionalBenchmark.suitabilityScore >= 60 ? (language === 'bn' ? 'মধ্যম' : 'Moderate') :
                              (language === 'bn' ? 'সীমাবদ্ধ' : 'Low')})
                          </span>
                        </div>
                        <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${healthPrognosis.regionalBenchmark.suitabilityScore}%` }} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Growth Performance Comparison Progress Bar */}
                    <div className="flex flex-col bg-white/50 border border-gray-100 rounded-lg p-2 gap-1.5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-gray-500 font-medium">
                          {language === 'bn' ? 'আঞ্চলিক বেঞ্চমার্কের তুলনায় প্রবৃদ্ধি' : 'Growth vs. Regional Benchmark'}
                        </span>
                        <span className={`font-extrabold ${
                          healthPrognosis.growthAlertLevel === 'optimal' ? 'text-emerald-700' :
                          healthPrognosis.growthAlertLevel === 'normal' ? 'text-lime-700' :
                          healthPrognosis.growthAlertLevel === 'underperforming' ? 'text-amber-700' :
                          'text-rose-700'
                        }`}>
                          {toBnNum(healthPrognosis.performanceIndexPercent)}%
                        </span>
                      </div>

                      <div className="w-full h-2 bg-gray-150 rounded-full overflow-hidden relative flex">
                        {/* Underperformance danger line at 85% */}
                        <div className="absolute top-0 bottom-0 left-[85%] w-0.5 bg-amber-500/40 z-10" />
                        {/* Stunted danger line at 70% */}
                        <div className="absolute top-0 bottom-0 left-[70%] w-0.5 bg-rose-500/40 z-10" />
                        
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            healthPrognosis.growthAlertLevel === 'optimal' ? 'bg-emerald-500' :
                            healthPrognosis.growthAlertLevel === 'normal' ? 'bg-lime-500' :
                            healthPrognosis.growthAlertLevel === 'underperforming' ? 'bg-amber-500' :
                            'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, healthPrognosis.performanceIndexPercent)}%` }}
                        />
                      </div>

                      {/* Growth speed comparison */}
                      <div className="flex justify-between text-[9px] text-gray-500 border-t border-gray-100 pt-1 mt-0.5 font-mono">
                        <div className="flex flex-col text-left">
                          <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider">{language === 'bn' ? 'প্রকৃত প্রবৃদ্ধি হার' : 'Simulated Growth'}</span>
                          <span className="font-extrabold text-gray-700 mt-0.5">{toBnNum(healthPrognosis.actualGrowthRateMetersPerYear)} {language === 'bn' ? 'মিটার/বছর' : 'm/year'}</span>
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider">{language === 'bn' ? 'বেঞ্চমার্ক প্রবৃদ্ধি' : 'Regional Benchmark'}</span>
                          <span className="font-extrabold text-gray-700 mt-0.5">{toBnNum(healthPrognosis.regionalBenchmark.benchmarkGrowthMetersPerYear)} {language === 'bn' ? 'মিটার/বছর' : 'm/year'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Alert Message Box */}
                    <div className={`p-2 rounded-lg border text-[9.5px] leading-relaxed text-left flex gap-1.5 ${
                      healthPrognosis.growthAlertLevel === 'optimal' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-900' :
                      healthPrognosis.growthAlertLevel === 'normal' ? 'bg-lime-500/5 border-lime-500/10 text-lime-900' :
                      healthPrognosis.growthAlertLevel === 'underperforming' ? 'bg-amber-500/5 border-amber-500/15 text-amber-900' :
                      'bg-rose-500/5 border-rose-500/15 text-rose-900'
                    }`}>
                      <span className="text-xs shrink-0 select-none mt-0.5">
                        {healthPrognosis.growthAlertLevel === 'optimal' ? '✅' :
                         healthPrognosis.growthAlertLevel === 'normal' ? '🌱' :
                         healthPrognosis.growthAlertLevel === 'underperforming' ? '⚠️' :
                         '🚨'}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-bold">
                          {language === 'bn' ? 'প্রবৃদ্ধি স্থিতি:' : 'Growth Alert Status:'}
                        </span>
                        <p className="text-gray-700 font-sans mt-0.5 leading-relaxed">
                          {language === 'bn' ? healthPrognosis.growthAlertMsgBn : healthPrognosis.growthAlertMsgEn}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Agricultural Advisory Box */}
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] leading-relaxed flex gap-1.5 text-left">
                    <span className="text-xs select-none shrink-0">💡</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-amber-900 mb-0.5">
                        {language === 'bn' ? 'কৃষি পরামর্শ ও যত্ন' : 'Silviculture Advice'}
                      </span>
                      <p className="text-gray-700 leading-relaxed font-sans">
                        {language === 'bn' ? healthPrognosis.advisoryBn : healthPrognosis.advisoryEn}
                      </p>
                    </div>
                  </div>

                  {/* Scientific Disclaimer */}
                  <p className="text-[8.5px] text-gray-400 leading-relaxed text-center italic">
                    {language === 'bn' 
                      ? '* বাংলাদেশের জলবায়ু ও বন বিভাগ নির্দেশিকা বিশ্লেষণ করে এই প্রাক্কলনটি তৈরি করা হয়েছে।' 
                      : '* Calculated using specialized silviculture indicators for tropical Bangladesh seasons.'}
                  </p>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
