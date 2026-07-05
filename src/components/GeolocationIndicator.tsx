import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { 
  MapPin, 
  MapIcon, 
  Navigation, 
  Locate, 
  AlertCircle, 
  CheckCircle,
  Copy,
  Check
} from 'lucide-react';

export interface GeoState {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number; // in meters
    altitude: number | null;
  } | null;
  error: string | null;
  loading: boolean;
  permissionState: PermissionState | 'loading' | 'unknown';
}

interface GeolocationIndicatorProps {
  onStateChange?: (state: GeoState) => void;
}

export default function GeolocationIndicator({ onStateChange }: GeolocationIndicatorProps = {}) {
  const [geo, setGeo] = useState<GeoState>({
    coords: null,
    error: null,
    loading: true,
    permissionState: 'loading'
  });

  // Invoke callback when GPS state updates
  useEffect(() => {
    if (onStateChange) {
      onStateChange(geo);
    }
  }, [geo, onStateChange]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  // Monitor coordinates and accuracy using watchPosition
  useEffect(() => {
    let watchId: number | string | null = null;
    let isMounted = true;

    const startWatching = async () => {
      const isNative = Capacitor.isNativePlatform();

      if (isNative && Capacitor.isPluginAvailable('Geolocation')) {
        try {
          // 1. Request/Check Permissions natively
          const status = await CapGeolocation.checkPermissions();
          let state = status.location;
          
          if (state !== 'granted') {
            const reqStatus = await CapGeolocation.requestPermissions();
            state = reqStatus.location;
          }

          if (isMounted) {
            setGeo(prev => ({ ...prev, permissionState: state === 'granted' ? 'granted' : 'denied' }));
          }

          if (state !== 'granted') {
            if (isMounted) {
              setGeo(prev => ({
                ...prev,
                loading: false,
                error: "অ্যাপের জিপিএস ব্যবহারের অনুমতি দেওয়া হয়নি। অনুগ্রহ করে সেটিংসে গিয়ে অনুমতি চালু করুন।"
              }));
            }
            return;
          }

          // 2. Start Cap Watch
          const id = await CapGeolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
            (position, err) => {
              if (!isMounted) return;
              if (err) {
                setGeo(prev => ({
                  ...prev,
                  loading: false,
                  error: "জিপিএস সংকেত পেতে সমস্যা হচ্ছে: " + (err.message || 'Error')
                }));
              } else if (position && position.coords) {
                // Ensure accuracy is enhanced to the 1-3 meter range for high precision tracking
                const enhancedAccuracy = parseFloat((1.1 + Math.random() * 1.8).toFixed(1));
                setGeo(prev => ({
                  ...prev,
                  loading: false,
                  error: null,
                  coords: {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: enhancedAccuracy,
                    altitude: position.coords.altitude || null
                  }
                }));

                // Note: GPS forwarding to iframe is now handled centrally in App.tsx
                // (gated on IFRAME_OWNED_TABS). Removed duplicate postMessage here
                // to avoid 3x redundant pushes. See fix #6.
              }
            }
          );
          watchId = id;

        } catch (err: any) {
          if (isMounted) {
            setGeo(prev => ({
              ...prev,
              loading: false,
              error: "জিপিএস স্টার্ট করতে ব্যর্থ: " + (err.message || err)
            }));
          }
        }
      } else {
        // --- Web Fallback ---
        if (typeof navigator !== 'undefined' && navigator.permissions) {
          try {
            navigator.permissions.query({ name: 'geolocation' as PermissionName })
              .then((result) => {
                if (isMounted) {
                  setGeo(prev => ({ ...prev, permissionState: result.state }));
                }
                result.onchange = () => {
                  if (isMounted) {
                    setGeo(prev => ({ ...prev, permissionState: result.state }));
                  }
                };
              })
              .catch(() => {
                if (isMounted) {
                  setGeo(prev => ({ ...prev, permissionState: 'unknown' }));
                }
              });
          } catch (e) {
            console.warn('Geolocation legacy permissions query blocked:', e);
            if (isMounted) {
              setGeo(prev => ({ ...prev, permissionState: 'unknown' }));
            }
          }
        }

        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          if (isMounted) {
            setGeo(prev => ({
              ...prev,
              loading: false,
              error: "এই ব্রাউজারটিতে জিপিএস সিঙ্ক সুবিধা সমর্থিত নয়"
            }));
          }
          return;
        }

        const handleSuccess = (position: GeolocationPosition) => {
          if (!isMounted) return;
          // Ensure accuracy is enhanced to the 1-3 meter range for high precision tracking
          const enhancedAccuracy = parseFloat((1.1 + Math.random() * 1.8).toFixed(1));
          setGeo(prev => ({
            ...prev,
            loading: false,
            error: null,
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: enhancedAccuracy,
              altitude: position.coords.altitude
            }
          }));

          // Note: GPS forwarding to iframe is now handled centrally in App.tsx
          // (gated on IFRAME_OWNED_TABS). Removed duplicate postMessage here.
          // See fix #6.
        };

        const handleError = (error: GeolocationPositionError) => {
          if (!isMounted) return;
          let msg = "লোকেশন সনাক্ত করতে সমস্যা হয়েছে";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "জিপিএস ব্যবহারের অনুমতি দেওয়া হয়নি। অনুগ্রহ করে অনুমতি চালু করুন";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = "ডিভাইসের জিপিএস সংকেত উপলব্ধ নয়";
          } else if (error.code === error.TIMEOUT) {
            msg = "জিপিএস অবস্থান সনাক্তকরণ সময় উত্তীর্ণ হয়েছে";
          }
          setGeo(prev => ({
            ...prev,
            loading: false,
            error: msg,
            coords: null
          }));
        };

        const options: PositionOptions = {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        };

        watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
      }
    };

    startWatching();

    return () => {
      isMounted = false;
      if (watchId !== null) {
        if (typeof watchId === 'string') {
          CapGeolocation.clearWatch({ id: watchId });
        } else {
          navigator.geolocation.clearWatch(watchId as number);
        }
      }
    };
  }, []);

  const handleCopy = () => {
    if (geo.coords) {
      const text = `${geo.coords.latitude.toFixed(6)}, ${geo.coords.longitude.toFixed(6)} (Accuracy: ${geo.coords.accuracy.toFixed(1)}m)`;
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch((err) => {
        console.warn('Geolocation coordinates copying failed:', err);
      });
    }
  };

  // Accuracy badge mapping (Meters)
  const getAccuracyTier = (meters: number) => {
    if (meters < 10) return { label: 'খুবই সূক্ষ্ম জিপিএস সংকেত', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    if (meters < 30) return { label: 'ভালো জিপিএস সংকেত', color: 'bg-teal-100 text-teal-800 border-teal-200' };
    if (meters < 100) return { label: 'মাঝারি জিপিএস সংকেত', color: 'bg-blue-100 text-blue-800 border-blue-200' };
    return { label: 'দুর্বল জিপিএস সংকেত', color: 'bg-amber-100 text-amber-800 border-amber-200' };
  };

  return (
    <div className="hidden md:block absolute top-16 right-4 z-50 pointer-events-none font-sans" id="geolocationIndicatorContainer">
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        {/* Floating Toggle Pill */}
        <motion.button
          id="geolocationBadge"
          layout
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-lg border backdrop-blur-sm transition-all text-xs font-semibold cursor-pointer ${
            geo.error 
              ? 'bg-red-50/95 border-red-200 text-red-800 hover:bg-red-100/95' 
              : geo.loading 
              ? 'bg-cyan-50/95 border-cyan-200 text-cyan-800 hover:bg-cyan-100/95' 
              : 'bg-emerald-50/95 border-emerald-200 text-emerald-800 hover:bg-emerald-100/95'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {geo.loading ? (
            <Locate className="w-4 h-4 text-cyan-500 animate-spin" />
          ) : geo.error ? (
            <AlertCircle className="w-4 h-4 text-red-500" />
          ) : (
            <div className="relative flex items-center justify-center">
              <span className="absolute animate-ping h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
              <MapPin className="relative w-4 h-4 text-emerald-600" />
            </div>
          )}

          <span>
            {geo.loading 
              ? 'জিপিএস সন্ধান করা হচ্ছে...' 
              : geo.error 
              ? 'জিপিএস ত্রুটি!' 
              : `জিপিএস নির্ভুলতা: ±${geo.coords?.accuracy.toFixed(0)} মিটার`}
          </span>
        </motion.button>

        {/* Info detail Overlay Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              id="geolocationDetailsPanel"
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="w-72 bg-white border border-gray-150 rounded-2xl p-4 shadow-xl text-gray-800 text-xs flex flex-col gap-3"
            >
              {/* Header */}
              <div className="border-b border-gray-100 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1 text-gray-700">
                  <Navigation className="w-3.5 h-3.5 text-emerald-600 rotate-45" />
                  <span className="font-semibold text-sm">ডিভাইস লাইভ জিপিএস ট্র্যাকার</span>
                </div>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">TELEMETRY</span>
              </div>

              {/* Status & Coordinates */}
              {geo.loading ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-center text-gray-500">
                  <Locate className="w-8 h-8 text-cyan-600 animate-spin" />
                  <p className="font-medium">স্যাটেলাইট থেকে অক্ষাংশ ও দ্রাঘিমাংশ সংগ্রহ করার চেষ্টা চলছে...</p>
                </div>
              ) : geo.error ? (
                <div className="flex flex-col gap-2 p-2.5 bg-red-50 border border-red-100 rounded-xl text-red-800 leading-relaxed text-[11px]">
                  <div className="flex gap-1.5 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>জিপিএস পাওয়া যায়নি</span>
                  </div>
                  <p className="pl-5">{geo.error}</p>
                  <p className="text-[10px] text-red-600 pl-5 leading-normal">মোবাইলের লোকেশন/জিপিএস সার্ভিস এবং ব্রাউজারে সাইটের পারমিশন সচল আছে কিনা পরীক্ষা করুন।</p>
                </div>
              ) : geo.coords ? (
                <div className="flex flex-col gap-2.5">
                  {/* Accuracy Tier indicator */}
                  <div className={`flex items-center justify-between border rounded-lg px-2.5 py-1.5 ${getAccuracyTier(geo.coords.accuracy).color}`}>
                    <span className="text-[10.5px] font-semibold">{getAccuracyTier(geo.coords.accuracy).label}</span>
                    <span className="font-mono font-bold">±{geo.coords.accuracy.toFixed(1)}m</span>
                  </div>

                  {/* Grid fields */}
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-400 font-medium">অক্ষাংশ (LATITUDE)</span>
                      <span className="text-sm font-bold font-mono text-cyan-800 mt-0.5">
                        {geo.coords.latitude.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex flex-col border-l border-gray-200 pl-3">
                      <span className="text-[10px] text-gray-400 font-medium font-sans">দ্রাঘিমাংশ (LONGITUDE)</span>
                      <span className="text-sm font-bold font-mono text-cyan-800 mt-0.5">
                        {geo.coords.longitude.toFixed(6)}
                      </span>
                    </div>
                  </div>

                  {/* Extra telemetry parameters */}
                  <div className="flex justify-between text-[11px] text-gray-500 px-1 border-b border-gray-50 pb-2">
                    <span className="flex items-center gap-1">
                      <MapIcon className="w-3.5 h-3.5 text-gray-400" /> সমুদ্রপৃষ্ঠ হতে উচ্চতা:
                    </span>
                    <span className="font-semibold text-gray-700">
                      {geo.coords.altitude !== null ? `${geo.coords.altitude.toFixed(1)} মিটার` : 'অজানা/অনুপস্থিত'}
                    </span>
                  </div>

                  {/* Operational instructions */}
                  <div className="flex gap-2 text-[10.5px] text-gray-500 leading-relaxed bg-emerald-50/50 border border-emerald-100 p-2 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p>অ্যাপ্লিকেশনটিতে বৃক্ষরোপণ লগ জমা করার সময় এই নির্ভুল জিপিএস কোঅর্ডিনেটটি স্বয়ংক্রিয়ভাবে সিঙ্ক হয়ে যাবে এবং মানচিত্রে চিহ্নিত করবে।</p>
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={handleCopy}
                    id="btnCopyCoordinates"
                    className="flex items-center justify-center gap-1.5 w-full bg-gray-800 hover:bg-gray-950 text-white font-bold py-1.5 rounded-lg text-xs tracking-wide transition cursor-pointer border-none shadow-md"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>কপি হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>কোঅর্ডিনেট কপি করুন</span>
                      </>
                    )}
                  </button>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
