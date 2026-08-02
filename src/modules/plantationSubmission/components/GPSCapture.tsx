import { useState } from 'react';
import { Crosshair, Loader2, CheckCircle2, ClipboardPaste } from 'lucide-react';

interface GPSCaptureProps {
  onCapture: (lat: number, lng: number, accuracy: number) => void;
  label?: string;
  language?: 'bn' | 'en';
}

/** Parses common "lat, lng" style strings copied from Google Maps, WhatsApp
 *  location shares, etc. Accepts extra whitespace, N/S/E/W suffixes, and
 *  either comma or space as the separator. Returns null if it can't find
 *  two valid coordinate numbers. */
function parseCoordinatePair(raw: string): { lat: number; lng: number } | null {
  const cleaned = raw
    .replace(/[°NnSsEeWw]/g, '')
    .trim();
  const parts = cleaned.split(/[,\s]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Standalone GPS capture control — separate from MapPicker so it can be
 * reused anywhere a raw device-location read is needed (not just the map).
 * Shows a loading spinner while acquiring a fix and a brief success state
 * with the accuracy reading once captured. Also offers a manual
 * copy-paste fallback for when the field officer already has coordinates
 * (e.g. shared over WhatsApp, read off another GPS device, or from a
 * previous visit) rather than capturing fresh from the device sensor.
 */
export default function GPSCapture({ onCapture, label, language = 'bn' }: GPSCaptureProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteSuccess, setPasteSuccess] = useState(false);

  const t = {
    capture: language === 'bn' ? 'GPS ক্যাপচার করুন' : 'Capture GPS',
    capturing: language === 'bn' ? 'অবস্থান খোঁজা হচ্ছে...' : 'Acquiring location...',
    captured: language === 'bn' ? 'ক্যাপচার সম্পন্ন' : 'Captured',
    unsupported: language === 'bn' ? 'এই ডিভাইসে GPS সমর্থিত নয়' : 'GPS not supported on this device',
    failed: language === 'bn' ? 'অবস্থান পাওয়া যায়নি — আবার চেষ্টা করুন' : 'Could not get location — try again',
    pasteToggle: language === 'bn' ? 'অথবা GPS কো-অর্ডিনেট পেস্ট/টাইপ করুন' : 'Or paste/type GPS coordinates',
    pasteLabel: language === 'bn' ? 'অক্ষাংশ, দ্রাঘিমাংশ (Latitude, Longitude)' : 'Latitude, Longitude',
    pasteHint: language === 'bn'
      ? 'উদাহরণ: 25.8103, 89.6614 — Google Maps বা অন্য কোনো স্থান থেকে কপি করে এখানে পেস্ট করুন'
      : 'Example: 25.8103, 89.6614 — copy from Google Maps or any source and paste here',
    pasteApply: language === 'bn' ? 'প্রয়োগ করুন' : 'Apply',
    pasteInvalid: language === 'bn'
      ? 'সঠিক ফরম্যাট নয়। "অক্ষাংশ, দ্রাঘিমাংশ" আকারে লিখুন — যেমন: 25.8103, 89.6614'
      : 'Invalid format. Use "latitude, longitude" — e.g. 25.8103, 89.6614',
    pasteApplied: language === 'bn' ? '✓ কো-অর্ডিনেট প্রয়োগ হয়েছে' : '✓ Coordinates applied',
  };

  const capture = () => {
    if (!navigator.geolocation) {
      setStatus('error');
      setError(t.unsupported);
      return;
    }
    setStatus('loading');
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus('success');
        setLastAccuracy(Math.round(pos.coords.accuracy));
        onCapture(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      () => {
        setStatus('error');
        setError(t.failed);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const applyPaste = () => {
    const parsed = parseCoordinatePair(pasteValue);
    if (!parsed) {
      setPasteError(t.pasteInvalid);
      setPasteSuccess(false);
      return;
    }
    setPasteError(null);
    setPasteSuccess(true);
    // Accuracy is unknown for a manually entered point — use 0 as a sentinel
    // (SiteStep/MapPicker already treat manuallyAdjusted separately).
    onCapture(parsed.lat, parsed.lng, 0);
  };

  return (
    <div>
      <button
        type="button"
        onClick={capture}
        disabled={status === 'loading'}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-700 text-white font-semibold text-sm hover:bg-emerald-800 active:scale-95 transition disabled:opacity-60 cursor-pointer"
      >
        {status === 'loading' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : status === 'success' ? (
          <CheckCircle2 size={16} />
        ) : (
          <Crosshair size={16} />
        )}
        {status === 'loading' ? t.capturing : status === 'success' ? t.captured : label || t.capture}
      </button>
      {status === 'success' && lastAccuracy !== null && (
        <p className="text-[10px] text-gray-400 mt-1 text-center">±{lastAccuracy}m</p>
      )}
      {error && <p className="text-[11px] text-red-600 mt-1 text-center">{error}</p>}

      {/* Copy-paste GPS coordinates fallback */}
      <button
        type="button"
        onClick={() => setShowPaste((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 mt-2 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 text-[11px] font-semibold hover:bg-gray-50 cursor-pointer"
      >
        <ClipboardPaste size={13} /> {t.pasteToggle}
      </button>

      {showPaste && (
        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-2.5 space-y-1.5">
          <label className="text-[10px] font-semibold text-gray-500 block">{t.pasteLabel}</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              value={pasteValue}
              onChange={(e) => {
                setPasteValue(e.target.value);
                setPasteError(null);
                setPasteSuccess(false);
              }}
              onPaste={() => setTimeout(() => setPasteError(null), 0)}
              placeholder="25.8103, 89.6614"
              className="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            <button
              type="button"
              onClick={applyPaste}
              className="px-3 py-2 rounded-lg bg-emerald-700 text-white text-[11px] font-bold hover:bg-emerald-800 cursor-pointer shrink-0"
            >
              {t.pasteApply}
            </button>
          </div>
          <p className="text-[10px] text-gray-400">{t.pasteHint}</p>
          {pasteError && <p className="text-[11px] text-red-600">{pasteError}</p>}
          {pasteSuccess && <p className="text-[11px] text-emerald-600 font-semibold">{t.pasteApplied}</p>}
        </div>
      )}
    </div>
  );
}
