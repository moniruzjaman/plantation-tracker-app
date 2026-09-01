import { X, MapPin, Phone, User, Calendar, Trees, Camera, CheckCircle2, Clock } from 'lucide-react';
import type { PlantationSubmission } from '../types/plantation';
import { toBnNum } from '../utils/mapHelper';

interface RegistryDetailModalProps {
  submission: PlantationSubmission;
  language: 'bn' | 'en';
  onClose: () => void;
}

/**
 * Read-only drill-down for a single submission, opened from RegistryTab's
 * list. Mirrors kurigram_nursery_registry's Dialog-based detail view with
 * a pivoted per-species inventory table (see
 * docs/skills/registry-dashboard.md), adapted to this app's flat
 * `seedlings: SeedlingEntry[]` shape instead of a category/age-group pivot.
 */
export default function RegistryDetailModal({ submission: s, language, onClose }: RegistryDetailModalProps) {
  const totalCount = s.seedlings.reduce((sum, sd) => sum + (sd.count || 0), 0);
  const t = {
    title: language === 'bn' ? 'এন্ট্রির বিস্তারিত' : 'Entry Detail',
    location: language === 'bn' ? 'অবস্থান' : 'Location',
    species: language === 'bn' ? 'প্রজাতি ভিত্তিক বিবরণ' : 'Species Breakdown',
    caretaker: language === 'bn' ? 'পরিচর্যাকারী' : 'Caretaker',
    saao: language === 'bn' ? 'এসএএও' : 'SAAO',
    monitoring: language === 'bn' ? 'মনিটরিং অফিসার' : 'Monitoring Officer',
    remarks: language === 'bn' ? 'মন্তব্য' : 'Remarks',
    photos: language === 'bn' ? 'ছবি প্রমাণ' : 'Photo Evidence',
    synced: language === 'bn' ? 'সিঙ্ক সম্পন্ন' : 'Synced',
    unsynced: language === 'bn' ? 'সিঙ্ক বাকি' : 'Pending sync',
    total: language === 'bn' ? 'মোট চারা' : 'Total seedlings',
    date: language === 'bn' ? 'রোপণের তারিখ' : 'Planting date',
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
            <Trees size={15} /> {s.village || t.title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          {/* Sync status + total */}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-1 text-[11px] font-semibold ${s.synced ? 'text-emerald-600' : 'text-amber-600'}`}>
              {s.synced ? <CheckCircle2 size={13} /> : <Clock size={13} />}
              {s.synced ? t.synced : t.unsynced}
            </div>
            <div className="text-[11px] text-gray-500">
              {t.total}: <span className="font-bold text-emerald-800">{toBnNum(totalCount)}</span>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 flex items-center gap-1">
              <MapPin size={11} /> {t.location}
            </label>
            <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-0.5">
              <div className="text-gray-700">
                {s.district} · {s.upazila} · {s.union}
              </div>
              {s.village && <div className="text-gray-500">{s.village}</div>}
              <div className="font-mono text-[10px] text-gray-400">
                {s.latitude?.toFixed(6)}, {s.longitude?.toFixed(6)} (±{Math.round(s.accuracy || 0)}m)
              </div>
            </div>
          </div>

          {/* Planting date */}
          {s.plantationDate && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <Calendar size={12} className="text-gray-400" />
              <span className="text-[10px] text-gray-500">{t.date}:</span>
              <span className="font-medium">{s.plantationDate}</span>
            </div>
          )}

          {/* Species pivot table */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">{t.species}</label>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-[11px]">
                <tbody>
                  {s.seedlings.map((sd, i) => (
                    <tr key={sd.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-2.5 py-1.5 text-gray-700">{sd.speciesName}</td>
                      <td className="px-2.5 py-1.5 text-right font-semibold text-emerald-700">{toBnNum(sd.count)}</td>
                    </tr>
                  ))}
                  {s.seedlings.length === 0 && (
                    <tr>
                      <td className="px-2.5 py-2 text-gray-400 text-center" colSpan={2}>—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Caretaker / SAAO / Monitoring officer */}
          <div className="space-y-2">
            {s.caretakerName && (
              <div className="flex items-center gap-1.5">
                <User size={12} className="text-gray-400 shrink-0" />
                <span className="text-[10px] text-gray-500 shrink-0">{t.caretaker}:</span>
                <span className="font-medium truncate">{s.caretakerName}</span>
                {s.caretakerMobile && (
                  <span className="text-gray-400 flex items-center gap-0.5 ml-auto shrink-0">
                    <Phone size={10} /> {s.caretakerMobile}
                  </span>
                )}
              </div>
            )}
            {s.saaoName && (
              <div className="flex items-center gap-1.5">
                <User size={12} className="text-gray-400 shrink-0" />
                <span className="text-[10px] text-gray-500 shrink-0">{t.saao}:</span>
                <span className="font-medium truncate">{s.saaoName}</span>
              </div>
            )}
            {s.monitoringOfficerName && (
              <div className="flex items-center gap-1.5">
                <User size={12} className="text-gray-400 shrink-0" />
                <span className="text-[10px] text-gray-500 shrink-0">{t.monitoring}:</span>
                <span className="font-medium truncate">{s.monitoringOfficerName}</span>
              </div>
            )}
          </div>

          {/* Photos */}
          {s.photos && s.photos.length > 0 && (
            <div className="flex items-center gap-1.5 text-gray-600">
              <Camera size={12} className="text-gray-400" />
              <span className="text-[10px] text-gray-500">{t.photos}:</span>
              <span className="font-medium">{toBnNum(s.photos.length)}</span>
            </div>
          )}

          {/* Remarks */}
          {s.remarks && (
            <div>
              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">{t.remarks}</label>
              <p className="bg-gray-50 rounded-lg px-3 py-2 text-gray-700 leading-relaxed">{s.remarks}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
