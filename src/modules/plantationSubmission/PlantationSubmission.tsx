import { Save, Loader2, Sparkles } from 'lucide-react';
import { useOfflineDraft } from './hooks/useOfflineDraft';
import SiteStep from './steps/SiteStep';

interface PlantationSubmissionProps {
  language?: 'bn' | 'en';
}

/**
 * New Plantation Submission — wizard shell.
 *
 * Phase 1 scope: Site step only (GPS capture, map picker + reverse
 * geocode, geofence mode indicator, NDVI/carbon read-only display),
 * wired to offline draft autosave. Subsequent phases add:
 *   Phase 2 — PlantStep (multi-plant, photos, "same site?" branching)
 *   Phase 3 — PersonnelStep, ReviewStep, validationRouter, geofenceValidator
 *   Phase 4 — PolygonDrawer for orchard mode, nav integration, full
 *             flatten-to-legacy-submission on final submit
 *
 * This component is intentionally not wired into App.tsx's tab navigation
 * yet — per the brief, the existing Form tab must keep working untouched
 * while this module is built and tested independently. Phase 4 adds the
 * "New Form Beta" nav entry.
 */
export default function PlantationSubmission({ language = 'bn' }: PlantationSubmissionProps) {
  const { draft, loading, saving, updateDraft } = useOfflineDraft();

  const t = {
    title: language === 'bn' ? 'নতুন বৃক্ষরোপণ এন্ট্রি' : 'New Plantation Submission',
    beta: language === 'bn' ? 'বেটা' : 'BETA',
    saving: language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...',
    saved: language === 'bn' ? 'খসড়া সংরক্ষিত' : 'Draft saved',
    loading: language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...',
    step1of4: language === 'bn' ? 'ধাপ ১ / ৪ — স্থানের তথ্য' : 'Step 1 / 4 — Site Information',
    comingSoon: language === 'bn'
      ? 'পরবর্তী ধাপগুলো (চারার তথ্য, ব্যক্তিগত তথ্য, পর্যালোচনা) শীঘ্রই যুক্ত হবে।'
      : 'Remaining steps (Plants, Personnel, Review) are coming in the next phase.',
  };

  if (loading || !draft) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs gap-2">
        <Loader2 size={16} className="animate-spin" /> {t.loading}
      </div>
    );
  }

  const site = draft.sites[0];

  // Phase 1: single-site only. Updates a site by index inside the draft's
  // `sites` array (rather than assuming sites[0] directly) so multi-site
  // branching in Phase 2 ("same plantation site?" from the Plant step,
  // which appends to this array) is additive, not a rewrite of this logic.
  const updateSiteAt = (index: number) => (updater: (prev: typeof site) => typeof site) => {
    updateDraft((prev) => ({
      ...prev,
      sites: prev.sites.map((s, i) => (i === index ? updater(s) : s)),
    }));
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-white font-sans">
      <div className="w-full max-w-2xl mx-auto p-4 pb-24">
        {/* Header */}
        <div className="border-b border-gray-100 pb-2.5 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-600" />
            <span className="font-bold text-gray-800 text-sm">{t.title}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{t.beta}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            {saving ? (
              <>
                <Loader2 size={11} className="animate-spin" /> {t.saving}
              </>
            ) : (
              <>
                <Save size={11} /> {t.saved}
              </>
            )}
          </div>
        </div>

        {/* Progress indicator — 4 steps, only step 1 active in Phase 1 */}
        <div className="flex items-center gap-1 mb-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={`flex-1 h-1.5 rounded-full ${n === 1 ? 'bg-emerald-600' : 'bg-gray-100'}`} />
          ))}
        </div>
        <p className="text-[11px] font-semibold text-emerald-700 mb-3">{t.step1of4}</p>

        <SiteStep
          site={site}
          onChange={updateSiteAt(0)}
          language={language}
        />

        <p className="text-[10px] text-gray-400 text-center mt-6">{t.comingSoon}</p>
      </div>
    </div>
  );
}
