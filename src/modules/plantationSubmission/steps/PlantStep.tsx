import { useEffect, useRef, useState } from 'react';
import { Sprout, Plus, X } from 'lucide-react';
import PlantCard from '../components/PlantCard';
import PlantTypeSaveBar from '../components/PlantTypeSaveBar';
import DuplicateWarningBanner from '../components/DuplicateWarningBanner';
import { createEmptyPlant, type PlantationSite, type GeofenceMode } from '../types/submission';
import { resolveGeofenceMode } from '../hooks/useGeofenceMode';
import { fetchEntriesForDuplicateCheck, detectDuplicates } from '../services/duplicateDetection';

interface PlantStepProps {
  site: PlantationSite;
  siteLabel: string;
  onChange: (updater: (prev: PlantationSite) => PlantationSite) => void;
  /** Called when the officer answers "No" to "same plantation site?" —
   *  the wizard shell creates a new PlantationSite and navigates back to
   *  SiteStep for it (a fresh site needs its own location capture). */
  onRequestNewSite: () => void;
  language?: 'bn' | 'en';
}

/**
 * Step 2: Plant Information. Each plant added after the first triggers
 * the spec's "Is this plant located at the same plantation site?" prompt:
 *   Yes -> reuse this site's GPS/address/geofence/NDVI/carbon (just append
 *          another PlantEntry here)
 *   No  -> hand off to the wizard shell to create a new PlantationSite
 *          (fresh GPS capture required, so this routes back to SiteStep)
 */
export default function PlantStep({ site, siteLabel, onChange, onRequestNewSite, language = 'bn' }: PlantStepProps) {
  const [pendingSamSitePrompt, setPendingSameSitePrompt] = useState(false);

  const t = {
    title: language === 'bn' ? 'চারার তথ্য' : 'Plant Information',
    siteLabel: language === 'bn' ? 'বর্তমান সাইট' : 'Current Site',
    addPlant: language === 'bn' ? '+ আরেকটি চারা যোগ করুন' : '+ Add Another Plant',
    addFirstPlant: language === 'bn' ? '+ প্রথম চারা যোগ করুন' : '+ Add First Plant',
    promptTitle: language === 'bn' ? 'এই চারাটি কি একই স্থানে?' : 'Is this plant located at the same plantation site?',
    promptDesc: language === 'bn'
      ? 'একই স্থান হলে বর্তমান GPS/ঠিকানা পুনরায় ব্যবহার হবে। ভিন্ন স্থান হলে নতুন সাইট তৈরি হবে এবং GPS আবার নিতে হবে।'
      : 'Same site reuses this GPS/address. A different site creates a new site and needs fresh GPS capture.',
    yes: language === 'bn' ? 'হ্যাঁ, একই স্থান' : 'Yes, same site',
    no: language === 'bn' ? 'না, ভিন্ন স্থান' : 'No, different site',
    noPlants: language === 'bn' ? 'এখনও কোনো চারা যোগ করা হয়নি' : 'No plants added yet',
  };

  const updatePlantAt = (index: number) => (updater: (prev: (typeof site.plants)[number]) => (typeof site.plants)[number]) => {
    onChange((prev) => ({
      ...prev,
      plants: prev.plants.map((p, i) => (i === index ? updater(p) : p)),
    }));
  };

  const removePlantAt = (index: number) => {
    onChange((prev) => ({ ...prev, plants: prev.plants.filter((_, i) => i !== index) }));
  };

  const appendPlantHere = () => {
    onChange((prev) => ({ ...prev, plants: [...prev.plants, createEmptyPlant()] }));
    setPendingSameSitePrompt(false);
  };

  const handleAddPlantClick = () => {
    if (site.plants.length === 0) {
      // First plant at this site — nothing to compare against, no need
      // to ask "same site?" yet.
      appendPlantHere();
      return;
    }
    setPendingSameSitePrompt(true);
  };

  const totalQuantity = site.plants.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const currentMode = resolveGeofenceMode(site);

  const handleSavePlantType = (mode: GeofenceMode) => {
    onChange((prev) => ({ ...prev, geofence: { ...prev.geofence, manualMode: mode, mode } }));
  };

  // ---- Fraud-proofing: debounced duplicate-submission check ----
  // Re-runs whenever the site's GPS point or any plant's species/date
  // changes, debounced so it doesn't hit the network on every keystroke
  // while typing a custom species name.
  const hasPoint = site.location.latitude !== 0 || site.location.longitude !== 0;
  const plantSignature = site.plants.map((p) => `${p.speciesName.trim().toLowerCase()}|${p.plantationDate}`).join(',');
  const prevMatchIdsRef = useRef<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!hasPoint || site.plants.length === 0) return;

    debounceRef.current = setTimeout(() => {
      onChange((prev) => ({
        ...prev,
        fraudCheck: { ...(prev.fraudCheck ?? { checking: false, matches: [], acknowledged: false }), checking: true, error: undefined },
      }));
      fetchEntriesForDuplicateCheck()
        .then((entries) => {
          const matches = detectDuplicates(site, entries);
          const matchIds = matches.map((m) => m.submissionId).sort().join(',');
          const changed = matchIds !== prevMatchIdsRef.current;
          prevMatchIdsRef.current = matchIds;
          onChange((prev) => ({
            ...prev,
            fraudCheck: {
              ...(prev.fraudCheck ?? { checking: false, matches: [], acknowledged: false }),
              checking: false,
              matches,
              // Only reset the acknowledgement when the actual set of
              // flagged entries changes -- not on every debounce tick
              // that happens to land on the same result.
              acknowledged: changed ? matches.length === 0 : prev.fraudCheck?.acknowledged ?? false,
            },
          }));
        })
        .catch((err) => {
          onChange((prev) => ({
            ...prev,
            fraudCheck: {
              ...(prev.fraudCheck ?? { checking: false, matches: [], acknowledged: false }),
              checking: false,
              error: err?.message || 'failed',
            },
          }));
        });
    }, 900);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.location.latitude, site.location.longitude, plantSignature, hasPoint]);

  const handleAcknowledgeDuplicate = () => {
    onChange((prev) => ({ ...prev, fraudCheck: { ...prev.fraudCheck, acknowledged: true } }));
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-800 flex items-center gap-1.5">
          <Sprout size={16} className="text-emerald-600" /> {t.title}
        </h3>
        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
          {t.siteLabel}: {siteLabel}
        </span>
      </div>

      {site.plants.length === 0 && (
        <p className="text-center text-xs text-gray-400 py-6">{t.noPlants}</p>
      )}

      <div className="space-y-2.5">
        {site.plants.map((plant, i) => (
          <PlantCard
            key={plant.plant_id}
            plant={plant}
            onChange={updatePlantAt(i)}
            onRemove={site.plants.length > 0 ? () => removePlantAt(i) : undefined}
            siteLatitude={site.location.latitude}
            siteLongitude={site.location.longitude}
            language={language}
          />
        ))}
      </div>

      {site.fraudCheck && (site.fraudCheck.checking || site.fraudCheck.matches.length > 0) && (
        <DuplicateWarningBanner fraudCheck={site.fraudCheck} onAcknowledge={handleAcknowledgeDuplicate} language={language} />
      )}

      <button
        type="button"
        onClick={handleAddPlantClick}
        className="w-full py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition cursor-pointer flex items-center justify-center gap-1.5"
      >
        <Plus size={14} /> {t.addPlant}
      </button>

      {site.plants.length > 0 && (
        <PlantTypeSaveBar
          totalQuantity={totalQuantity}
          currentMode={currentMode}
          onSave={handleSavePlantType}
          language={language}
        />
      )}

      {/* "Same plantation site?" prompt */}
      {pendingSamSitePrompt && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl shadow-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm text-gray-800">{t.promptTitle}</h4>
              <button onClick={() => setPendingSameSitePrompt(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">{t.promptDesc}</p>
            <div className="flex gap-2">
              <button
                onClick={appendPlantHere}
                className="flex-1 py-2.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 cursor-pointer"
              >
                {t.yes}
              </button>
              <button
                onClick={() => {
                  setPendingSameSitePrompt(false);
                  onRequestNewSite();
                }}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                {t.no}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
