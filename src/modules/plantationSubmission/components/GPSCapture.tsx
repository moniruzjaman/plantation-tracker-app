import { useState } from 'react';
import { Crosshair, Loader2, CheckCircle2 } from 'lucide-react';

interface GPSCaptureProps {
  onCapture: (lat: number, lng: number, accuracy: number) => void;
  label?: string;
  language?: 'bn' | 'en';
}

/**
 * Standalone GPS capture control — separate from MapPicker so it can be
 * reused anywhere a raw device-location read is needed (not just the map).
 * Shows a loading spinner while acquiring a fix and a brief success state
 * with the accuracy reading once captured.
 */
export default function GPSCapture({ onCapture, label, language = 'bn' }: GPSCaptureProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);

  const t = {
    capture: language === 'bn' ? 'GPS ক্যাপচার করুন' : 'Capture GPS',
    capturing: language === 'bn' ? 'অবস্থান খোঁজা হচ্ছে...' : 'Acquiring location...',
    captured: language === 'bn' ? 'ক্যাপচার সম্পন্ন' : 'Captured',
    unsupported: language === 'bn' ? 'এই ডিভাইসে GPS সমর্থিত নয়' : 'GPS not supported on this device',
    failed: language === 'bn' ? 'অবস্থান পাওয়া যায়নি — আবার চেষ্টা করুন' : 'Could not get location — try again',
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
    </div>
  );
}
