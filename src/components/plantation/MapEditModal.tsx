import { useState } from 'react';
import { Crosshair, Loader2, X, Save } from 'lucide-react';
import type { PlantationSubmission } from '../../types/plantation';

interface MapEditModalProps {
  submission: PlantationSubmission;
  onSave: (updated: PlantationSubmission) => void;
  onClose: () => void;
}

/**
 * Focused edit modal opened from a map marker popup. Deliberately lighter
 * than the full multi-step PlantationForm entry wizard — this is for
 * quick on-site corrections (wrong GPS pin, updated seedling count,
 * caretaker contact fix), not re-running the whole entry flow.
 *
 * Pattern source: moniruzjaman/nursery-mapping's EditModal + in-modal GPS
 * capture button (see docs/skills/offline-field-mapping.md).
 */
export default function MapEditModal({ submission, onSave, onClose }: MapEditModalProps) {
  const [form, setForm] = useState<PlantationSubmission>(submission);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const set = <K extends keyof PlantationSubmission>(key: K, value: PlantationSubmission[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const setSeedlingCount = (id: string, count: number) => {
    setForm((f) => ({
      ...f,
      seedlings: f.seedlings.map((s) => (s.id === id ? { ...s, count } : s)),
    }));
  };

  const recaptureGps = () => {
    if (!navigator.geolocation) {
      setGpsError('এই ডিভাইসে GPS সমর্থিত নয়');
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', +pos.coords.latitude.toFixed(6));
        set('longitude', +pos.coords.longitude.toFixed(6));
        set('accuracy', Math.round(pos.coords.accuracy));
        setGpsLoading(false);
      },
      () => {
        setGpsError('অবস্থান পাওয়া যায়নি — আবার চেষ্টা করুন');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = () => {
    // Mark unsynced so this edit gets picked up by the existing offline
    // sync queue (useOfflineQueue), instead of introducing a separate
    // save/sync path just for map edits.
    onSave({ ...form, synced: false });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-900">এন্ট্রি সম্পাদনা</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">অবস্থান (GPS)</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 font-mono text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-700">
                {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                <span className="text-gray-400 ml-1">(±{Math.round(form.accuracy)}m)</span>
              </div>
              <button
                onClick={recaptureGps}
                disabled={gpsLoading}
                className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 active:scale-95 transition disabled:opacity-60 cursor-pointer"
                title="বর্তমান অবস্থান দিয়ে আপডেট করুন"
              >
                {gpsLoading ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
                রিক্যাপচার
              </button>
            </div>
            {gpsError && <p className="text-[11px] text-red-600 mt-1">{gpsError}</p>}
          </div>

          {/* Village / Union / Upazila (read context, editable village only —
              upazila/union changes should go through the full form's
              directory cascade, not a quick map edit) */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">গ্রাম</label>
            <input
              type="text"
              value={form.village}
              onChange={(e) => set('village', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              {form.upazila} · {form.union}
            </p>
          </div>

          {/* Seedling counts */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">চারার সংখ্যা</label>
            <div className="space-y-1.5">
              {form.seedlings.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-gray-700 truncate">{s.speciesName}</span>
                  <input
                    type="number"
                    min={0}
                    value={s.count}
                    onChange={(e) => setSeedlingCount(s.id, Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Caretaker */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">পরিচর্যাকারী</label>
              <input
                type="text"
                value={form.caretakerName}
                onChange={(e) => set('caretakerName', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">মোবাইল</label>
              <input
                type="text"
                value={form.caretakerMobile}
                onChange={(e) => set('caretakerMobile', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">মন্তব্য</label>
            <textarea
              value={form.remarks ?? ''}
              onChange={(e) => set('remarks', e.target.value)}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 cursor-pointer"
          >
            বাতিল
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Save size={14} /> সংরক্ষণ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
