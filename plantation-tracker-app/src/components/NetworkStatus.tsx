import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Database, 
  Info, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  HardDrive
} from 'lucide-react';

export interface NetworkStatusData {
  isOnline: boolean;
  swState: 'active' | 'installing' | 'waiting' | 'uninstalled' | 'unsupported';
  storageEstimate: { used: string; total: string; percent: number } | null;
}

interface NetworkStatusProps {
  onStateChange?: (data: NetworkStatusData) => void;
}

export default function NetworkStatus({ onStateChange }: NetworkStatusProps = {}) {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  
  const [swState, setSwState] = useState<'active' | 'installing' | 'waiting' | 'uninstalled' | 'unsupported'>('unsupported');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [storageEstimate, setStorageEstimate] = useState<{ used: string; total: string; percent: number } | null>(null);

  // Invoke callback when state transitions
  useEffect(() => {
    if (onStateChange) {
      onStateChange({ isOnline, swState, storageEstimate });
    }
  }, [isOnline, swState, storageEstimate, onStateChange]);

  useEffect(() => {
    // 1. Connection Event Listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    // 2. Service Worker state detection
    let swInterval: NodeJS.Timeout;
    const controllerChangeHandler = () => {
      setSwState('active');
    };

    if (!('serviceWorker' in navigator) || !navigator.serviceWorker) {
      setSwState('unsupported');
    } else {
      const updateSWStatus = () => {
        try {
          if (!navigator.serviceWorker) {
            setSwState('unsupported');
            return;
          }
          if (navigator.serviceWorker.controller) {
            setSwState('active');
          } else {
            // Look dynamically at active registrations
            navigator.serviceWorker.getRegistrations().then((registrations) => {
              if (registrations && registrations.length > 0) {
                const reg = registrations[0];
                if (reg.installing) setSwState('installing');
                else if (reg.waiting) setSwState('waiting');
                else if (reg.active) setSwState('active');
                else setSwState('uninstalled');
              } else {
                setSwState('uninstalled');
              }
            }).catch(() => {
              setSwState('uninstalled');
            });
          }
        } catch (e) {
          console.warn('Service worker status check failed:', e);
          setSwState('unsupported');
        }
      };

      try {
        updateSWStatus();
        navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);
        // Poll periodically for state transitions (e.g. from installing to active)
        swInterval = setInterval(updateSWStatus, 4000);
      } catch (e) {
        console.warn('Service worker setup failed:', e);
        setSwState('unsupported');
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (swInterval) clearInterval(swInterval);
      try {
        if (navigator.serviceWorker) {
          navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
        }
      } catch (e) {
        // Ignore
      }
    };
  }, []);

  // 3. Storage availability calculation
  useEffect(() => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then((estimate) => {
          const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(1);
          const totalGB = ((estimate.quota || 0) / (1024 * 1024 * 1024)).toFixed(1);
          const percent = Math.round(((estimate.usage || 0) / (estimate.quota || 1)) * 100);
          setStorageEstimate({
            used: usedMB,
            total: totalGB,
            percent: Math.max(percent, 1)
          });
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Storage estimate failed:', e);
    }
  }, [isExpanded]);

  return (
    <div className="hidden md:block absolute top-4 right-4 z-50 pointer-events-none font-sans" id="networkStatusContainer">
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        {/* Connection status pill/badge */}
        <motion.div
          id="networkStatusBadge"
          layout
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg border backdrop-blur-sm transition-all cursor-pointer ${
            isOnline 
              ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800 hover:bg-emerald-100/95' 
              : 'bg-amber-50/95 border-amber-200 text-amber-800 hover:bg-amber-100/95'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isOnline ? (
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </div>
          ) : (
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          )}

          {isOnline ? (
            <Wifi className="w-4 h-4 text-emerald-600" id="iconWifiOn" />
          ) : (
            <WifiOff className="w-4 h-4 text-amber-600" id="iconWifiOff" />
          )}

          <span className="text-xs font-semibold tracking-wide">
            {isOnline ? 'সংযোগ: অনলাইন' : 'সংযোগ: অফলাইন'}
          </span>

          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 opacity-60" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          )}
        </motion.div>

        {/* Detailed Status Popup Board */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              id="networkStatusDetailsPanel"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="w-72 bg-white border border-gray-150 rounded-2xl p-4 shadow-xl text-gray-800 text-xs flex flex-col gap-3"
            >
              {/* Header */}
              <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
                <span className="font-semibold text-gray-700 text-sm">অ্যাপ সংযোগ স্ট্যাটাস</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>

              {/* Status Indicators */}
              <div className="flex flex-col gap-2.5">
                {/* 1. Internet connection status */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-500" /> : <WifiOff className="w-3.5 h-3.5 text-amber-500" />}
                    আজকের ইন্টারনেট সংযোগ:
                  </span>
                  <span className={`font-semibold ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isOnline ? 'সংযুক্ত' : 'অসংযুক্ত'}
                  </span>
                </div>

                {/* 2. Service Worker state */}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    {swState === 'active' ? (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    ) : swState === 'installing' || swState === 'waiting' ? (
                      <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    অফলাইন সিঙ্ক ইঞ্জিন:
                  </span>
                  <span className="font-medium text-gray-700">
                    {swState === 'active' && 'সক্রিয় ও সম্পূর্ণ নিরাপদ'}
                    {swState === 'installing' && 'ইন্সটল করা হচ্ছে...'}
                    {swState === 'waiting' && 'আপডেট অপেক্ষারত'}
                    {swState === 'uninstalled' && 'লোকাল এনভায়রনমেন্ট'}
                    {swState === 'unsupported' && 'ব্রাউজার সাপোর্ট নেই'}
                  </span>
                </div>

                {/* 3. Storage Space */}
                {storageEstimate && (
                  <div className="flex flex-col gap-1 border-t border-gray-50 pt-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-gray-400" />
                        অফলাইন সেভ করা স্টোরেজ:
                      </span>
                      <span className="font-semibold text-gray-700">
                        {storageEstimate.used} MB / {storageEstimate.total} GB
                      </span>
                    </div>
                    {/* Storage progress bar */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${storageEstimate.percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Informative Tip based on status */}
              <div className={`p-2 rounded-lg leading-relaxed text-[10.5px] border ${
                isOnline 
                  ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                  : 'bg-amber-50/50 border-amber-100 text-amber-800'
              }`}>
                {isOnline ? (
                  <div className="flex gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <p>অ্যাপ্লিকেশনটি অনলাইন সার্ভার ও অফলাইন লোকাল ডাটাবেজ উভয়ের সাথে সংযুক্ত রয়েছে। কোনো বিঘ্ন ছাড়াই নির্বিঘ্নে কাজ করুন।</p>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p>আপনি অফলাইনে আছেন! কিন্তু কোনো চিন্তা নেই — সম্পন্ন করা বৃক্ষরোপণ লগগুলি নিরাপদে ফোনে জমা থাকবে এবং লাইনে এলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
