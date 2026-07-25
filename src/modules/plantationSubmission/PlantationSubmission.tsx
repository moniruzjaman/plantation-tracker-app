import { useState } from 'react';
import { Save, Loader2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOfflineDraft } from './hooks/useOfflineDraft';
import SiteStep from './steps/SiteStep';
import PlantStep from './steps/PlantStep';
import { createEmptySite } from './types/submission';

interface PlantationSubmissionProps {
  language?: 'bn' | 'en';
}

type WizardStep = 'site' | 'plant';

/**
 * New Plantation Submission — wizard shell.
 *
 * Phase 1: Site step (GPS, map, reverse geocode, geofence mode, NDVI/carbon).
 * Phase 2 (this update): Plant step (multi-plant, photos, "same site?"
 *   branching that creates additional PlantationSites), plus Site<->Plant
 *   navigation and a site switcher for multi-site drafts.
 * Still to come:
 *   Phase 3 — PersonnelStep, ReviewStep, validationRouter, geofenceValidator
 *   Phase 4 — PolygonDrawer for orchard mode, flatten-to-legacy-submission
 *             on final submit, replacing the current Form tab after testing
 */
export default function PlantationSubmission({ language = 'bn' }: PlantationSubmissionProps) {
  const { draft, loading, saving, updateDraft } = useOfflineDraft();
  const [activeSiteIndex, setActiveSiteIndex] = useState(0);
  const [wizardStep, setWizardStep] = useState<WizardStep>('site');

  const t = {
    title: language === 'bn' ? 'নতুন বৃক্ষরোপণ এন্ট্রি' : 'New Plantation Submission',
    beta: language === 'bn' ? 'বেটা' : 'BETA',
    saving: language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...',
    saved: language === 'bn' ? 'খসড়া সংরক্ষিত' : 'Draft saved',
    loading: language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...',
    stepSite: language === 'bn' ? 'ধাপ ১ / ৪ — স্থানের তথ্য' : 'Step 1 / 4 — Site Information',
    stepPlant: language === 'bn' ? 'ধাপ ২ / ৪ — চারার তথ্য' : 'Step 2 / 4 — Plant Information',
    comingSoon: language === 'bn'
      ? 'পরবর্তী ধাপগুলো (ব্যক্তিগত তথ্য, পর্যালোচনা) শীঘ্রই যুক্ত হবে।'
      : 'Remaining steps (Personnel, Review) are coming in the next phase.',
    site: language === 'bn' ? 'সাইট' : 'Site',
    back: language === 'bn' ? 'পূর্ববর্তী' : 'Back',
    next: language === 'bn' ? 'পরবর্তী' : 'Next',
    needAtLeastOnePlant: language === 'bn' ? 'এগোতে হলে অন্তত একটি চারা যোগ করুন' : 'Add at least one plant to continue',
  };

  if (loading || !draft) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs gap-2">
        <Loader2 size={16} className="animate-spin" /> {t.loading}
      </div>
    );
  }

  const site = draft.sites[activeSiteIndex];

  const updateSiteAt = (index: number) => (updater: (prev: typeof site) => typeof site) => {
    updateDraft((prev) => ({
      ...prev,
      sites: prev.sites.map((s, i) => (i === index ? updater(s) : s)),
    }));
  };

  // "No, different site" from PlantStep's same-site prompt — appends a
  // fresh PlantationSite, makes it active, and routes back to SiteStep
  // since a new site needs its own GPS capture before plants can be added.
  const handleRequestNewSite = () => {
    const newSite = createEmptySite();
    updateDraft((prev) => ({ ...prev, sites: [...prev.sites, newSite] }));
    setActiveSiteIndex(draft.sites.length); // index of the about-to-be-appended site
    setWizardStep('site');
  };

  const canAdvanceToPlant = site.location.latitude !== 0 || site.location.longitude !== 0;
  const canAdvanceFromPlant = site.plants.length > 0;

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

        {/* Site switcher — only shown once a "different site" branch exists */}
        {draft.sites.length > 1 && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
            {draft.sites.map((s, i) => (
              <button
                key={s.site_id}
                onClick={() => {
                  setActiveSiteIndex(i);
                  setWizardStep('site');
                }}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold cursor-pointer ${
                  i === activeSiteIndex ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {t.site} {i + 1} {s.plants.length > 0 && `(${s.plants.length})`}
              </button>
            ))}
          </div>
        )}

        {/* Progress indicator — 4 steps */}
        <div className="flex items-center gap-1 mb-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`flex-1 h-1.5 rounded-full ${
                (n === 1 && (wizardStep === 'site' || wizardStep === 'plant')) || (n === 2 && wizardStep === 'plant')
                  ? 'bg-emerald-600'
                  : 'bg-gray-100'
              }`}
            />
          ))}
        </div>
        <p className="text-[11px] font-semibold text-emerald-700 mb-3">
          {wizardStep === 'site' ? t.stepSite : t.stepPlant}
        </p>

        {wizardStep === 'site' && (
          <>
            <SiteStep site={site} onChange={updateSiteAt(activeSiteIndex)} language={language} />
            <div className="flex justify-end mt-4">
              <button
                onClick={() => canAdvanceToPlant && setWizardStep('plant')}
                disabled={!canAdvanceToPlant}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {t.next} <ChevronRight size={14} />
              </button>
            </div>
          </>
        )}

        {wizardStep === 'plant' && (
          <>
            <PlantStep
              site={site}
              siteLabel={`${t.site} ${activeSiteIndex + 1}`}
              onChange={updateSiteAt(activeSiteIndex)}
              onRequestNewSite={handleRequestNewSite}
              language={language}
            />
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setWizardStep('site')}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                <ChevronLeft size={14} /> {t.back}
              </button>
              <div className="text-right">
                {!canAdvanceFromPlant && <p className="text-[10px] text-amber-600 mb-1">{t.needAtLeastOnePlant}</p>}
                <button
                  disabled={!canAdvanceFromPlant}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {t.next} <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 text-center mt-6">{t.comingSoon}</p>
          </>
        )}
      </div>
    </div>
  );
}
