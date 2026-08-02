import { useState } from 'react';
import { Trees, Sprout, LandPlot, CheckCircle2, Info } from 'lucide-react';
import type { GeofenceMode } from '../types/submission';

interface PlantTypeSaveBarProps {
  totalQuantity: number;
  currentMode: GeofenceMode;
  onSave: (mode: GeofenceMode) => void;
  language?: 'bn' | 'en';
}

const OPTIONS: { mode: GeofenceMode; icon: typeof Trees }[] = [
  { mode: 'single_tree', icon: Trees },
  { mode: 'small_plantation', icon: Sprout },
  { mode: 'orchard', icon: LandPlot },
];

/**
 * Lets the field officer explicitly classify and save the current site's
 * plant entries as একক গাছ (Individual Tree) / ছোট বাগান (Small
 * Plantation) / বাগান-বড় প্লট (Orchard/Large Plot), each with its own
 * Bangla instructions on when to use it. This sets `geofence.manualMode`
 * (see hooks/useGeofenceMode.ts -> resolveGeofenceMode), which takes
 * priority over the automatic quantity/area based classification — useful
 * when an officer wants to lock in "orchard" mode early to start drawing
 * the boundary, or override a borderline auto-classification.
 *
 * Because all plant entries for a site are already flattened into a single
 * legacy submission row (see services/flattenToLegacySubmission.ts), simply
 * adding multiple PlantEntry items to one PlantationSite and saving here
 * keeps every plant in that one submission row — no separate row per plant.
 */
export default function PlantTypeSaveBar({ totalQuantity, currentMode, onSave, language = 'bn' }: PlantTypeSaveBarProps) {
  const [justSaved, setJustSaved] = useState<GeofenceMode | null>(null);

  const t = {
    heading: language === 'bn' ? 'চারার ধরন নির্বাচন করে সংরক্ষণ করুন' : 'Choose plant entry type & save',
    savedAs: language === 'bn' ? 'সংরক্ষিত হয়েছে' : 'Saved as',
    plantCount: language === 'bn' ? `মোট চারা: ${totalQuantity}টি` : `Total plants: ${totalQuantity}`,
    labels: {
      single_tree: language === 'bn' ? 'একক গাছ' : 'Individual',
      small_plantation: language === 'bn' ? 'ছোট বাগান' : 'Small Plantation',
      orchard: language === 'bn' ? 'বাগান/বড় প্লট' : 'Orchard/Large Plot',
    } as Record<GeofenceMode, string>,
    instructions: {
      single_tree: language === 'bn'
        ? 'যখন শুধু ১টি চারা/গাছ রোপণ করা হয়েছে, তখন এই অপশনে সংরক্ষণ করুন। শুধু GPS পয়েন্ট (অবস্থান) দরকার — কোনো সীমানা আঁকার প্রয়োজন নেই।'
        : 'Use this when only 1 plant/tree has been planted. Only a GPS point is needed — no boundary drawing required.',
      small_plantation: language === 'bn'
        ? 'একসাথে ২–২০টি চারা রোপণ করা হলে এই অপশনে সংরক্ষণ করুন। অবস্থানের সাথে ঐচ্ছিকভাবে একটি আওতা ব্যাসার্ধ (মিটার) যোগ করা যাবে — সীমানা আঁকা বাধ্যতামূলক নয়।'
        : 'Use this when 2–20 plants are planted together. You may optionally add a coverage radius (meters) — drawing a boundary is not mandatory.',
      orchard: language === 'bn'
        ? '২০টির বেশি চারা অথবা বড় জমি/বাগানের ক্ষেত্রে এই অপশনে সংরক্ষণ করুন। এক্ষেত্রে মানচিত্রে জমির সীমানা (পলিগন) আঁকা বাধ্যতামূলক।'
        : 'Use this for more than 20 plants or a large plot/orchard. Drawing the plot boundary (polygon) on the map is mandatory in this mode.',
    } as Record<GeofenceMode, string>,
  };

  const handleSave = (mode: GeofenceMode) => {
    onSave(mode);
    setJustSaved(mode);
    window.setTimeout(() => setJustSaved(null), 2500);
  };

  return (
    <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-emerald-800">{t.heading}</p>
        <span className="text-[10px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-100">
          {t.plantCount}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map(({ mode, icon: Icon }) => {
          const isActive = currentMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleSave(mode)}
              className={`flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                isActive
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
              }`}
            >
              {justSaved === mode ? <CheckCircle2 size={16} /> : <Icon size={16} />}
              <span className="text-center leading-tight">{t.labels[mode]}</span>
            </button>
          );
        })}
      </div>

      {/* Bangla instructions for the currently-selected mode */}
      <div className="flex items-start gap-1.5 bg-white rounded-lg px-2.5 py-2 border border-emerald-100">
        <Info size={12} className="text-emerald-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-gray-600 leading-relaxed">{t.instructions[currentMode]}</p>
      </div>

      {justSaved && (
        <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
          <CheckCircle2 size={12} /> {t.labels[justSaved]} — {t.savedAs}
        </p>
      )}
    </div>
  );
}
