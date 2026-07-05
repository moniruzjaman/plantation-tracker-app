import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Wifi, 
  WifiOff, 
  MapPin, 
  HelpCircle, 
  X, 
  Globe, 
  Info,
  ChevronRight,
  ChevronDown,
  Activity,
  Award,
  CircleDot,
  Copy,
  Check,
  CheckCircle2,
  HardDrive,
  Share2,
  User,
  Download
} from 'lucide-react';

import { GeoState } from './GeolocationIndicator';
import { NetworkStatusData } from './NetworkStatus';
import { Submission } from './OfflinePlantationDashboard';

interface MobileControlCenterProps {
  networkState: NetworkStatusData | null;
  geoState: GeoState | null;
  submissions: Submission[];
  userEmail: string;
}

export default function MobileControlCenter({ networkState, geoState, submissions, userEmail }: MobileControlCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'db' | 'net' | 'gps' | 'mydata'>('db');
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
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
    
    // Dispatch storage event locally so other components in the same tab update instantly
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'rural_data_saver_active',
      newValue: nextVal ? 'true' : 'false'
    }));

    // Send a message to the iframe so it updates instantly
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'rural-data-saver-change',
        enabled: nextVal
      }, '*');
    }
  };

  // Compute stats
  const { totalLogs, totalSeedlings, fruitCount, forestCount, medicinalCount, sortedDistricts } = useMemo(() => {
    let tLogs = submissions.length;
    let tSeedlings = 0;
    let fCount = 0;
    let foCount = 0;
    let mCount = 0;

    const districtMap: { [key: string]: number } = {};

    submissions.forEach(s => {
      const countCategory = (list?: any[]) => {
        let sum = 0;
        if (list && Array.isArray(list)) {
          list.forEach(item => {
            sum += (parseInt(item.count) || 0) + (parseInt(item.graftingCount) || 0);
          });
        }
        return sum;
      };

      const f = countCategory(s.fruitSeedlings);
      const fo = countCategory(s.forestSeedlings);
      const m = countCategory(s.medicinalSeedlings);

      fCount += f;
      foCount += fo;
      mCount += m;
      tSeedlings += (f + fo + m);

      if (s.district) {
        districtMap[s.district] = (districtMap[s.district] || 0) + 1;
      }
    });

    const sDistricts = Object.entries(districtMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { totalLogs: tLogs, totalSeedlings: tSeedlings, fruitCount: fCount, forestCount: foCount, medicinalCount: mCount, sortedDistricts: sDistricts };
  }, [submissions]);

  const toBnNum = (num: number): string => {
    if (language === 'en') return num.toLocaleString('en-US');
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return num.toString().replace(/\d/g, d => bnDigits[parseInt(d)]);
  };

  const hasGpsError = !!geoState?.error;
  const isOnline = networkState ? networkState.isOnline : true;

  // Programmatic manual launcher
  const handleOpenUserGuide = () => {
    setIsOpen(false);
    setTimeout(() => {
      const guideBtn = document.getElementById('btnShowWelcomeHelp');
      if (guideBtn) {
        guideBtn.setAttribute('class', 'flex absolute'); // Temporarily unhide to ensure layout trigger
        guideBtn.click();
        // Reset classes
        setTimeout(() => {
           guideBtn.setAttribute('class', 'hidden md:flex absolute top-[112px] right-4 z-45 items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 border border-gray-150 hover:bg-gray-50 shadow-md text-gray-600 font-medium text-xs cursor-pointer transition-all hover:scale-102 pointer-events-auto');
        }, 100);
      }
    }, 200);
  };

  // Programmatic coordinates copier
  const handleCopyCoords = () => {
    if (geoState?.coords) {
      const text = `${geoState.coords.latitude.toFixed(6)}, ${geoState.coords.longitude.toFixed(6)}`;
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch((err) => {
        console.warn('Coordinates copying failed, likely due to iframe focus: ', err);
      });
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'District', 'Upazila', 'Region', 'Nursery', 'Fruit Seedlings', 'Forest Seedlings', 'Medicinal Seedlings'];
    const rows = submissions.map(s => {
      const countCategory = (list?: any[]) => {
        let sum = 0;
        if (list && Array.isArray(list)) {
          list.forEach(item => {
            sum += (parseInt(item.count) || 0) + (parseInt(item.graftingCount) || 0);
          });
        }
        return sum;
      };
      return [
        s.plantingDate || s.submittedAt || new Date().toISOString().split('T')[0],
        s.district || '',
        s.upazila || '',
        s.region || '',
        s.nurseryName || '',
        countCategory(s.fruitSeedlings),
        countCategory(s.forestSeedlings),
        countCategory(s.medicinalSeedlings)
      ].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'plantation_entries.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // GPS precision rating
  const getGpsPrecisionBN = (meters: number) => {
    if (meters < 30) return { label: 'অত্যন্ত নির্ভুল', color: 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100' };
    if (meters < 100) return { label: 'সাধারণ সিগন্যাল', color: 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100' };
    return { label: 'দুর্বল সিগন্যাল', color: 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100' };
  };

  const getGpsPrecisionEN = (meters: number) => {
    if (meters < 30) return { label: 'High Precision', color: 'text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100' };
    if (meters < 100) return { label: 'Medium Signal', color: 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100' };
    return { label: 'Weak Signal', color: 'text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100' };
  };

  // Text resources
  const t = {
    title: language === 'bn' ? 'সিস্টেম ড্যাশবোর্ড' : 'System Hub',
    db: language === 'bn' ? 'অফলাইন রেকর্ড' : 'Offline DB',
    net: language === 'bn' ? 'নেট সংযোগ' : 'Network',
    gps: language === 'bn' ? 'জিপিএস সিগন্যাল' : 'GPS Location',
    guide: language === 'bn' ? 'ব্যবহার নির্দেশিকা' : 'Help Guide',
    offlineSub: language === 'bn' ? 'মোট অফলাইন রেকর্ড' : 'Total Offline Batches',
    totalPlanted: language === 'bn' ? 'মোট রোপণকৃত চারা' : 'Total Seedlings Planted',
    fruit: language === 'bn' ? '果 ফলদ চারা' : 'Fruit Seedlings',
    forest: language === 'bn' ? '🌲 বনজ চারা' : 'Forest Seedlings',
    medicinal: language === 'bn' ? '💊 ঔষধি চারা' : 'Medicinal',
    districts: language === 'bn' ? 'শীর্ষ অঞ্চলসমূহ' : 'Top Areas',
    conStat: language === 'bn' ? 'ইন্টারনেট সংযোগ:' : 'Connection:',
    syncEngine: language === 'bn' ? 'সিঙ্ক সিস্টেম:' : 'Sync Manager:',
    activeSafe: language === 'bn' ? 'সক্রিয় ও সুরক্ষিত' : 'Active & Secured',
    localEnv: language === 'bn' ? 'লোকাল স্টোরেজ' : 'Local Storage',
    browserSupport: language === 'bn' ? 'ব্রাউজার মোড' : 'Web Fallback',
    diskUsed: language === 'bn' ? 'ডিভাইস স্টোরেজ স্পেস:' : 'App Storage:',
    coords: language === 'bn' ? 'ভৌগোলিক স্থানাঙ্ক:' : 'Coordinates:',
    accuracy: language === 'bn' ? 'অবস্থানের নির্ভুলতা:' : 'Accuracy Margin:',
    gpsPerm: language === 'bn' ? 'জিপিএস অনুমতি:' : 'GPS Permission:',
    loading: language === 'bn' ? 'লোকেশন ট্র্যাক করা হচ্ছে...' : 'Tracking GPS position...',
    okPerm: language === 'bn' ? 'অনুমোদিত' : 'Granted',
    noPerm: language === 'bn' ? 'অনুমতি প্রয়োজন' : 'Action Required',
    guideLaunchText: language === 'bn' ? 'অ্যাপ্লিকেশন ব্যবহার নির্দেশিকা' : 'Interactive Launch Guide',
    guideDesc: language === 'bn' ? 'কিভাবে তথ্য অফলাইনে সংরক্ষণ ও সিঙ্ক করতে হবে তা বিস্তারিত জানুন।' : 'Learn step-by-step how to log plantations offline and sync manually.',
    openGuideBtn: language === 'bn' ? 'ইউজার গাইড খুলুন' : 'Open Manual Guide',
    warningOffline: language === 'bn' ? 'সংযোগ বিচ্ছিন্ন! কিন্তু কোনো ডাটা হারাবে না।' : 'You are offline! Data is secured.',
    secureBg: language === 'bn' ? 'সকল তথ্য ফোনের লোকাল মেমোরিতে শতভাগ সুরক্ষিত আছে।' : '100% data remains securely encrypted in device sandbox cache.',
    goalTitle: language === 'bn' ? '৫ বছরে ২৫ কোটি লক্ষ্যমাত্রা' : 'National 250 Million Tree Goal',
    goalProgress: language === 'bn' ? 'আপনার রোপনকৃত বৃক্ষরোপণ রেকর্ড দেশের লক্ষ্য অর্জনে সাহায্য করছে।' : 'Your nursery logging acts directly towards satisfying the green targets.'
  };

  return (
    <div className="md:hidden block fixed top-3 right-3 z-50 pointer-events-none font-sans" id="mobileControlCenterLayout">
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        
        {/* Floating Toggle Hub FAB Button */}
        <motion.button
          id="mobileControlCenterFAB"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-full shadow-xl border backdrop-blur-md transition-all text-[10px] font-bold cursor-pointer ${
            totalLogs > 0
              ? 'bg-emerald-600 border-emerald-500 text-white'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Status LEDs inside button */}
          <span className="flex items-center gap-0.5">
            {/* Database dot */}
            {totalLogs > 0 ? (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 border border-white animate-pulse" />
            ) : (
              <span className="inline-block w-1 h-1 rounded-full bg-gray-400" />
            )}
            {/* Network dot */}
            {isOnline ? (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 border border-white" />
            ) : (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 border border-white animate-pulse" />
            )}
            {/* GPS dot */}
            {hasGpsError ? (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 border border-white animate-pulse" />
            ) : geoState?.loading ? (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 border border-white" />
            ) : (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 border border-white" />
            )}
          </span>

          <Activity className="w-3 h-3" />
          <span>
            {language === 'bn' ? 'স্ট্যাটাস' : 'Status'}{' '}
            <strong className="bg-white/20 px-1 py-0 rounded ml-0.5">
              {toBnNum(totalLogs)}
            </strong>
          </span>
        </motion.button>
        
        {/* Sharing Button */}
        <button
          onClick={() => {
            const shareData = {
              title: language === 'bn' ? 'বৃক্ষরোপণ ট্র্যাকার' : 'Plantation Tracker',
              text: 'গাছ লাগাই গাছ বাচাই।',
              url: 'https://plantation-tracker-v1-1073841706415.us-west1.run.app/',
            };
            if (navigator.share) {
              navigator.share(shareData).catch((err) => {
                // If sharing was cancelled/aborted, do not fallback to clipboard copy or report errors
                if (err.name === 'AbortError' || err.message?.toLowerCase().includes('cancel') || err.message?.toLowerCase().includes('abort')) {
                  console.log('Sharing canceled or aborted by user.');
                  return;
                }
                console.warn('Sharing failed, attempting clipboard fallback:', err);
                navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`).then(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                }).catch((clipErr) => {
                  console.warn('Clipboard fallback also failed:', clipErr);
                });
              });
            } else {
              navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`).then(() => {
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              }).catch((clipErr) => {
                console.warn('Clipboard copy failed:', clipErr);
              });
            }
          }}
          className="p-2.5 bg-white text-gray-800 rounded-full shadow-lg border border-gray-150 cursor-pointer hover:bg-slate-50 transition-all flex items-center justify-center relative"
          title={language === 'bn' ? 'শেয়ার করুন' : 'Share'}
        >
          {shareCopied ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
          {shareCopied && (
            <span className="absolute -top-8 right-0 bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow-md whitespace-nowrap font-sans">
              {language === 'bn' ? 'লিঙ্ক কপি করা হয়েছে!' : 'Link Copied!'}
            </span>
          )}
        </button>

        {/* Dynamic Slide-Up Bottom Drawer sheet popup */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Back backdrop to cover view smartly */}
              <div 
                className="fixed inset-0 bg-black/40 backdrop-blur-sm -z-10" 
                onClick={() => setIsOpen(false)}
              />

              <motion.div
                id="mobileControlCenterDrawer"
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 15, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                className="w-[88vw] max-w-sm bg-white/95 border border-gray-200 shadow-2xl rounded-2xl p-4 flex flex-col gap-3 max-h-[80vh] overflow-y-auto"
              >
                {/* Drawer Header Navbar */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-gray-800 text-xs tracking-tight uppercase flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                      {t.title}
                    </span>
                    <span className="text-[9.5px] text-gray-400 mt-0.5 uppercase tracking-wider">
                      {language === 'bn' ? 'লাইভ সিস্টেম প্যারামিটার' : 'Live System Monitor'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle Language */}
                    <button
                      id="mobileCenterLangToggle"
                      onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
                      className="px-2 py-0.5 rounded border border-gray-200 bg-white text-[10px] font-semibold text-gray-600 active:bg-gray-50 flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3 text-gray-400" />
                      {language === 'bn' ? 'English' : 'বাংলা'}
                    </button>
                    {/* Close Drawer button */}
                    <button
                      id="mobileCenterCloseBtn"
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 rounded-full text-gray-400 active:text-gray-800 active:bg-gray-100 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Grid Tabs Selection Row */}
                <div className="grid grid-cols-4 gap-1 bg-gray-50 border border-gray-100 p-1 rounded-xl">
                  {/* Tab 1: DB */}
                  <button
                    onClick={() => setActiveTab('db')}
                    className={`py-1.5 rounded-lg text-[10.5px] font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      activeTab === 'db'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 active:bg-gray-100'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    {t.db}
                  </button>

                  {/* Tab 2: Connection */}
                  <button
                    onClick={() => setActiveTab('net')}
                    className={`py-1.5 rounded-lg text-[10.5px] font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      activeTab === 'net'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 active:bg-gray-100'
                    }`}
                  >
                    {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 text-amber-500" />}
                    {t.net}
                  </button>

                  {/* Tab 3: GPS */}
                  <button
                    onClick={() => setActiveTab('gps')}
                    className={`py-1.5 rounded-lg text-[10.5px] font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      activeTab === 'gps'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 active:bg-gray-100'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {t.gps}
                  </button>
                  
                  {/* Tab 4: My Data */}
                  <button
                    onClick={() => setActiveTab('mydata')}
                    className={`py-1.5 rounded-lg text-[10.5px] font-semibold flex flex-col items-center justify-center gap-1 transition-all ${
                      activeTab === 'mydata'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-gray-600 active:bg-gray-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    {language === 'bn' ? 'আমার তথ্য' : 'MyData'}
                  </button>
                  </div>

                {/* Tab Contents Frame */}
                <div className="flex-1 min-h-[160px] max-h-[280px] overflow-y-auto py-1">
                  
                  {/* SECTION 4: MY DATA */}
                  {activeTab === 'mydata' && (
                    <div className="flex flex-col gap-3 animate-in" id="mobileControlCenterTabMyData">
                      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold">
                            {userEmail.substring(0,2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-900">{userEmail.split('@')[0]}</h4>
                            <p className="text-[10px] text-gray-500">{userEmail}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="p-3 bg-emerald-50 rounded-lg">
                            <span className="text-[9px] text-emerald-600 font-bold uppercase">Total Entry</span>
                            <p className="text-lg font-black text-emerald-900">{toBnNum(totalLogs)}</p>
                          </div>
                          <div className="p-3 bg-cyan-50 rounded-lg">
                            <span className="text-[9px] text-cyan-600 font-bold uppercase">Total Plantation</span>
                            <p className="text-lg font-black text-cyan-900">{toBnNum(totalSeedlings)}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h5 className="text-[10px] uppercase font-black text-gray-400">Profile Details</h5>
                          <div className="text-[11px] space-y-1 text-gray-600">
                            <p><strong>Area:</strong> {submissions[0]?.district || 'Not set'}</p>
                            <p><strong>Role:</strong> DAE Officer</p>
                          </div>
                          
                          <button
                            onClick={exportToCSV}
                            className="w-full flex items-center justify-center gap-2 py-2 mt-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {language === 'bn' ? 'CSV এক্সপোর্ট করুন' : 'Export to CSV'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SECTION 1: DATABASE CODES */}
                  {activeTab === 'db' && (
                    <div className="flex flex-col gap-3 animate-in" id="mobileControlCenterTabDB">
                      
                      {/* Grid Metrics */}
                      <div className="grid grid-cols-2 gap-2">
                        {/* Batches count */}
                        <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded-xl text-center flex flex-col items-center justify-center">
                          <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider opacity-80">{t.offlineSub}</span>
                          <span className="text-xl font-extrabold text-emerald-700 mt-0.5">{toBnNum(totalLogs)}</span>
                        </div>
                        {/* Seedlings count */}
                        <div className="bg-lime-50/50 border border-lime-100 p-2.5 rounded-xl text-center flex flex-col items-center justify-center">
                          <span className="text-[10px] text-lime-800 font-bold uppercase tracking-wider opacity-80">{t.totalPlanted}</span>
                          <span className="text-xl font-extrabold text-lime-700 mt-0.5">{toBnNum(totalSeedlings)}</span>
                        </div>
                      </div>

                      {/* Seedling varieties bar tracker */}
                      <div className="flex flex-col gap-2 bg-gray-50 border border-gray-100 p-3 rounded-xl">
                        
                        {/* Fruit seedlings */}
                        <div className="flex flex-col gap-0.5">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-orange-600">{t.fruit}</span>
                            <span className="text-gray-700">{toBnNum(fruitCount)}</span>
                          </div>
                          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div className="bg-orange-500 h-full rounded" style={{ width: `${totalSeedlings > 0 ? (fruitCount / totalSeedlings) * 100 : 0}%` }} />
                          </div>
                        </div>

                        {/* Forest seedlings */}
                        <div className="flex flex-col gap-0.5">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-emerald-700">{t.forest}</span>
                            <span className="text-gray-700">{toBnNum(forestCount)}</span>
                          </div>
                          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div className="bg-emerald-600 h-full rounded" style={{ width: `${totalSeedlings > 0 ? (forestCount / totalSeedlings) * 100 : 0}%` }} />
                          </div>
                        </div>

                        {/* Medicinal seedlings */}
                        <div className="flex flex-col gap-0.5">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-blue-600">{t.medicinal}</span>
                            <span className="text-gray-700">{toBnNum(medicinalCount)}</span>
                          </div>
                          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full rounded" style={{ width: `${totalSeedlings > 0 ? (medicinalCount / totalSeedlings) * 100 : 0}%` }} />
                          </div>
                        </div>

                      </div>

                      {/* Top Districts */}
                      {sortedDistricts.length > 0 && (
                        <div className="flex flex-col gap-1.5 pt-0.5">
                          <span className="text-[10px] text-gray-500 font-black uppercase tracking-wider">{t.districts}</span>
                          <div className="flex flex-col gap-1">
                            {sortedDistricts.map(([name, val]) => (
                              <div key={name} className="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[11px]">
                                <span className="font-semibold text-gray-600">{name}</span>
                                <span className="bg-white px-2 py-0.5 rounded border border-gray-200 font-bold text-emerald-700 text-[10px]">
                                  {toBnNum(val)} {language === 'bn' ? 'টি এন্ট্রি' : 'entries'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* National Goal Badge panel */}
                      <div className="bg-amber-50/40 border border-amber-100/50 p-2.5 rounded-xl text-[10px] flex gap-2">
                        <Award className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex flex-col">
                          <strong className="text-amber-800 font-bold">{t.goalTitle}</strong>
                          <span className="text-gray-600 leading-normal mt-0.5">{t.goalProgress}</span>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* SECTION 2: CONNECTION & REGULATION */}
                  {activeTab === 'net' && (
                    <div className="flex flex-col gap-3 animate-in hover:shadow-none" id="mobileControlCenterTabNet">
                      
                      {/* Live items stat list */}
                      <div className="flex flex-col gap-2.5 bg-gray-50 border border-gray-100 p-3 rounded-xl">
                        
                        {/* Online or offline status */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">{t.conStat}</span>
                          <span className={`font-black uppercase tracking-wide flex items-center gap-1.5 ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                            <CircleDot className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-500' : 'text-amber-500 animate-pulse'}`} />
                            {isOnline ? (language === 'bn' ? 'সংযুক্ত' : 'Connected') : (language === 'bn' ? 'সংযোগ বিচ্ছিন্ন' : 'Offline')}
                          </span>
                        </div>

                        {/* Service Worker Sync details */}
                        <div className="flex items-center justify-between text-xs border-t border-gray-200/50 pt-2">
                          <span className="text-gray-500 font-medium">{t.syncEngine}</span>
                          <span className="text-gray-700 font-bold">
                            {networkState?.swState === 'active' 
                              ? t.activeSafe 
                              : networkState?.swState === 'uninstalled' 
                              ? t.localEnv 
                              : t.browserSupport}
                          </span>
                        </div>

                        {/* Storage usage estimate on device disk */}
                        {networkState?.storageEstimate && (
                          <div className="flex flex-col gap-1 border-t border-gray-200/50 pt-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-500 font-medium flex items-center gap-1">
                                <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                                {t.diskUsed}
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

                      </div>

                      {/* Rural Data Saver Mode Switch */}
                      <div className={`p-3 rounded-xl border flex flex-col gap-2 ${
                        ruralDataSaver 
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900 shadow-sm' 
                          : 'bg-emerald-50/40 border-emerald-100 text-emerald-900'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">🌾</span>
                            <div className="flex flex-col text-left">
                              <span className="text-xs font-bold">
                                {language === 'bn' ? 'গ্রামীণ ডাটা সেভার মোড' : 'Rural Data Saver Mode'}
                              </span>
                              <span className="text-[9px] text-gray-500 font-medium">
                                {language === 'bn' ? 'ডাটা ও ব্যাটারি সাশ্রয় করুন' : 'Saves mobile data & battery'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Beautiful Toggle Switch */}
                          <button
                            id="btnToggleRuralDataSaver"
                            onClick={handleToggleDataSaver}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                              ruralDataSaver ? 'bg-amber-500 justify-end' : 'bg-gray-300 justify-start'
                            }`}
                          >
                            <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                          </button>
                        </div>
                        
                        <p className="text-[10px] text-gray-500 leading-relaxed font-sans mt-1">
                          {ruralDataSaver ? (
                            language === 'bn' 
                              ? 'সক্রিয়: স্যাটেলাইট ম্যাপ বন্ধ, এআই ছবি কম্প্রেশন ৯৯% সচল, ডেটা ট্রান্সফার সীমাবদ্ধ।' 
                              : 'Active: Satellite layers blocked, AI leaf snapshots compressed by 99%, data transfer limited.'
                          ) : (
                            language === 'bn' 
                              ? 'অফলাইনে আছেন? ডাটা সেভার চালু করলে আপনার ইন্টারনেট খরচ বিপুল পরিমাণ কমে যাবে।' 
                              : 'Slow internet? Enable to save data and battery in remote fields.'
                          )}
                        </p>
                      </div>

                      {/* Visual sync info box depending on mode */}
                      <div className={`p-3 rounded-xl border text-[10px] leading-relaxed flex gap-2 ${
                        isOnline 
                          ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                          : 'bg-amber-50/50 border-amber-100 text-amber-800'
                      }`}>
                        <Info className="w-4 h-4 shrink-0 mt-0.5 text-current" />
                        <div className="flex flex-col gap-0.5">
                          <strong className="font-black">
                            {isOnline 
                              ? (language === 'bn' ? 'সংযুক্ত নেটওয়ার্ক মোড' : 'Online Sync Active') 
                              : t.warningOffline}
                          </strong>
                          <span>
                            {isOnline 
                              ? (language === 'bn' ? 'আপনার সকল কার্যক্রম ক্লাউড সিকিউর ডাটাবেজের সাথে নিখুঁতভাবে রিয়েল-টাইমে সিঙ্ক করা হচ্ছে।' : 'All system operations are running synced with the secure servers.')
                              : t.secureBg}
                          </span>
                        </div>
                      </div>

                    </div>
                  )}

                  {/* SECTION 3: GEOLOCATION PRECISIONS */}
                  {activeTab === 'gps' && (
                    <div className="flex flex-col gap-3 animate-in" id="mobileControlCenterTabGPS">
                      
                      <div className="flex flex-col gap-2.5 bg-gray-50 border border-gray-100 p-3 rounded-xl">
                        
                        {/* Coords detail */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-medium">{t.coords}</span>
                          {geoState?.coords ? (
                            <div className="flex items-center gap-1.5 font-bold text-gray-800 font-mono">
                              <span>
                                {geoState.coords.latitude.toFixed(5)}, {geoState.coords.longitude.toFixed(5)}
                              </span>
                              <button
                                onClick={handleCopyCoords}
                                className="p-1 rounded bg-white border border-gray-200 active:bg-gray-100 text-gray-500 active:text-gray-800"
                                title="স্থানাঙ্ক কপি করুন"
                              >
                                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic font-mono">{t.loading}</span>
                          )}
                        </div>

                        {/* Accuracy accuracy */}
                        <div className="flex items-center justify-between text-xs border-t border-gray-200/50 pt-2">
                          <span className="text-gray-500 font-medium">{t.accuracy}</span>
                          {geoState?.coords ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-700">
                                {toBnNum(Math.round(geoState.coords.accuracy))} {language === 'bn' ? 'মিটার' : 'm'}
                              </span>
                              <span className={language === 'bn' 
                                ? getGpsPrecisionBN(geoState.coords.accuracy).color 
                                : getGpsPrecisionEN(geoState.coords.accuracy).color
                              }>
                                {language === 'bn' 
                                  ? getGpsPrecisionBN(geoState.coords.accuracy).label 
                                  : getGpsPrecisionEN(geoState.coords.accuracy).label}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>

                        {/* Permission permission state */}
                        <div className="flex items-center justify-between text-xs border-t border-gray-200/50 pt-2">
                          <span className="text-gray-500 font-medium">{t.gpsPerm}</span>
                          <span className={`font-bold flex items-center gap-1 text-[11px] ${
                            geoState?.error ? 'text-red-600' : 'text-emerald-700'
                          }`}>
                            <CircleDot className="w-3.5 h-3.5" />
                            {geoState?.error ? t.noPerm : t.okPerm}
                          </span>
                        </div>

                      </div>

                      {/* Error panel or tips */}
                      {geoState?.error ? (
                        <div className="p-3 bg-red-50 border border-red-150 text-red-800 text-[10.5px] rounded-xl leading-relaxed">
                          <strong className="font-bold block mb-0.5">গুগল ম্যাপ রিমোট জিপিএস ত্রুটি:</strong>
                          <span>{geoState.error}</span>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-sky-50/50 border border-sky-100 text-sky-800 rounded-xl text-[10px] leading-relaxed flex gap-2">
                          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                          <span>
                            {language === 'bn' 
                              ? 'আপনার জিপিএস সিগন্যালে অবস্থান নির্ভুলভাবে ট্র্যাকিং করা হচ্ছে। বৃক্ষ রোপণের সঠিক লোকেশন ম্যাপে চিহ্নিত হতে এটি কার্যকর।'
                              : 'Highly accurate real-time coordinates are synced automatically onto the layout maps to pinpoint nurseries.'}
                          </span>
                        </div>
                      )}

                    </div>
                  )}

                </div>

                {/* Subfooter: Core User Guide button (Manual trigger) */}
                <div className="border-t border-gray-100 pt-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-emerald-50/30 border border-emerald-100/40 p-2.5 rounded-xl">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-gray-800 text-[11px] flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-green-600" />
                        {t.guideLaunchText}
                      </span>
                      <span className="text-[10px] text-gray-500 leading-normal">
                        {t.guideDesc}
                      </span>
                    </div>
                    
                    <button
                      id="mobileCenterGuideLauncher"
                      onClick={handleOpenUserGuide}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] transition-colors shadow flex items-center gap-0.5 cursor-pointer shrink-0"
                    >
                      {language === 'bn' ? 'টিউটোরিয়াল' : 'Tutorial'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
