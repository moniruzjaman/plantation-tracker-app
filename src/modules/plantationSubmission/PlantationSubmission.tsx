import { useState } from 'react';
import { Save, Loader2, Sparkles, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useOfflineDraft } from './hooks/useOfflineDraft';
import { useAuth } from '../../hooks/useAuth';
import type { PlantationSubmission as LegacyPlantationSubmission } from '../../types/plantation';
import SiteStep from './steps/SiteStep';
import PlantStep from './steps/PlantStep';
import GeoFenceStep from './steps/GeoFenceStep';
import PersonnelStep from './steps/PersonnelStep';
import ReviewStep from './steps/ReviewStep';
import { deriveGeofenceMode } from './hooks/useGeofenceMode';
import { routeToValidator, type ValidationTask } from './services/validationRouter';
import { submitAllSites } from './services/flattenToLegacySubmission';
import { createEmptySite, createEmptyPersonnel, type SubmissionInfo } from './types/submission';

interface PlantationSubmissionProps {
  language?: 'bn' | 'en';
  /** Called once after all sites in the draft are saved, with the flattened
   *  legacy submissions -- lets the host page (App.tsx) award XP/tokens
   *  and refresh its own submission-count state the same way it does for
   *  the rest of the app, without this module needing to know about
   *  rewards/toasts itself. */
  onSubmitted?: (submissions: LegacyPlantationSubmission[]) => void;
}

type WizardStep = 'site' | 'plant' | 'geofence' | 'personnel' | 'review';

// Maps each internal step onto one of the 4 progress dots shown in the UI
// — 'geofence' is a conditional sub-step of Plant Information (only shown
// for small_plantation/orchard modes), so it shares Plant's dot rather
// than inventing a 5th, keeping the "Step X / 4" labeling from the spec.
const PROGRESS_DOT: Record<WizardStep, number> = { site: 0, plant: 1, geofence: 1, personnel: 2, review: 3 };

/**
 * New Plantation Submission — wizard shell. All 4 spec phases now wired:
 *   Phase 1 — Site step (GPS, map, reverse geocode, geofence mode, NDVI/carbon)
 *   Phase 2 — Plant step (multi-plant, photos, "same site?" branching)
 *   Phase 3 — Personnel, Review, validationRouter, geofenceValidator
 *   Phase 4 (this update) — GeoFenceStep (optional radius / mandatory
 *     polygon depending on mode), and final Submit now actually flattens
 *     each site into a legacy PlantationSubmission and writes it, so
 *     entries appear in Map/Dashboard/Registry immediately.
 *
 * Now wired as the ফর্ম tab's content (App.tsx) in place of the previous
 * single-step PlantationForm -- see onSubmitted below for how it reports
 * back to the host page.
 */
export default function PlantationSubmission({ language = 'bn', onSubmitted }: PlantationSubmissionProps) {
  const { draft, loading, saving, updateDraft, setStatus } = useOfflineDraft();
  const { session } = useAuth();
  const [activeSiteIndex, setActiveSiteIndex] = useState(0);
  const [wizardStep, setWizardStep] = useState<WizardStep>('site');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const t = {
    title: language === 'bn' ? 'নতুন বৃক্ষরোপণ এন্ট্রি' : 'New Plantation Submission',
    beta: language === 'bn' ? 'বেটা' : 'BETA',
    saving: language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...',
    saved: language === 'bn' ? 'খসড়া সংরক্ষিত' : 'Draft saved',
    loading: language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...',
    stepLabel: {
      site: language === 'bn' ? 'ধাপ ১ / ৪ — স্থানের তথ্য' : 'Step 1 / 4 — Site Information',
      plant: language === 'bn' ? 'ধাপ ২ / ৪ — চারার তথ্য' : 'Step 2 / 4 — Plant Information',
      geofence: language === 'bn' ? 'ধাপ ২ / ৪ — জিও-ফেন্স' : 'Step 2 / 4 — Geofence',
      personnel: language === 'bn' ? 'ধাপ ৩ / ৪ — ব্যক্তিগত তথ্য' : 'Step 3 / 4 — Personnel',
      review: language === 'bn' ? 'ধাপ ৪ / ৪ — পর্যালোচনা' : 'Step 4 / 4 — Review',
    },
    site: language === 'bn' ? 'সাইট' : 'Site',
    back: language === 'bn' ? 'পূর্ববর্তী' : 'Back',
    next: language === 'bn' ? 'পরবর্তী' : 'Next',
    submit: language === 'bn' ? 'জমা দিন' : 'Submit',
    submitting: language === 'bn' ? 'জমা হচ্ছে...' : 'Submitting...',
    needAtLeastOnePlant: language === 'bn' ? 'এগোতে হলে অন্তত একটি চারা যোগ করুন' : 'Add at least one plant to continue',
    needAllPlantNames: language === 'bn' ? 'প্রতিটি চারার নাম দিন — খালি রাখা যাবে না' : 'Every plant needs a name before continuing',
    needPolygon: language === 'bn' ? 'এগোতে হলে সীমানা আঁকুন' : 'Draw the boundary to continue',
    submittedTitle: language === 'bn' ? 'এন্ট্রি জমা হয়েছে' : 'Entry Submitted',
    submittedDesc: language === 'bn'
      ? 'এন্ট্রিটি সংরক্ষিত হয়েছে এবং ম্যাপ/ড্যাশবোর্ড/রেজিস্ট্রিতে দেখা যাবে। সার্ভার সিঙ্ক পরবর্তীতে স্বয়ংক্রিয়ভাবে হবে।'
      : 'The entry has been saved and will now appear in Map/Dashboard/Registry. Server sync happens automatically later.',
  };

  if (loading || !draft) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs gap-2">
        <Loader2 size={16} className="animate-spin" /> {t.loading}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 gap-3">
        <CheckCircle2 size={48} className="text-emerald-600" />
        <h3 className="font-bold text-gray-800">{t.submittedTitle}</h3>
        <p className="text-xs text-gray-500 max-w-xs">{t.submittedDesc}</p>
      </div>
    );
  }

  const site = draft.sites[activeSiteIndex];
  const currentPersonnel =
    draft.personnel.find((p) => p.site_id === site.site_id) ?? createEmptyPersonnel(site.site_id);

  const updateSiteAt = (index: number) => (updater: (prev: typeof site) => typeof site) => {
    updateDraft((prev) => ({
      ...prev,
      sites: prev.sites.map((s, i) => (i === index ? updater(s) : s)),
    }));
  };

  const updatePersonnelForSite = (siteId: string) => (updater: (prev: typeof currentPersonnel) => typeof currentPersonnel) => {
    updateDraft((prev) => {
      const exists = prev.personnel.some((p) => p.site_id === siteId);
      const base = prev.personnel.find((p) => p.site_id === siteId) ?? createEmptyPersonnel(siteId);
      const updated = updater(base);
      return {
        ...prev,
        personnel: exists
          ? prev.personnel.map((p) => (p.site_id === siteId ? updated : p))
          : [...prev.personnel, updated],
      };
    });
  };

  const handleRequestNewSite = () => {
    const newSite = createEmptySite();
    const newPersonnel = { ...currentPersonnel, site_id: newSite.site_id };
    updateDraft((prev) => ({
      ...prev,
      sites: [...prev.sites, newSite],
      personnel: [...prev.personnel, newPersonnel],
    }));
    setActiveSiteIndex(draft.sites.length);
    setWizardStep('site');
  };

  const canAdvanceToPlant = site.location.latitude !== 0 || site.location.longitude !== 0;
  // Was `site.plants.length > 0` only -- let an empty PlantCard (name never
  // typed) through as long as at least one card existed, so the very first
  // plant's name silently landed blank in the final submission (reported:
  // "1st plant name entry missing, directly going to [step] 2"). Every
  // plant on the site now has to actually have a species name before
  // Next unlocks, not just exist.
  const hasAllPlantNames = site.plants.length > 0 && site.plants.every((p) => p.speciesName.trim() !== '');
  const canAdvanceFromPlant = hasAllPlantNames;

  const currentMode = deriveGeofenceMode(
    site.plants.reduce((s, p) => s + (p.quantity || 0), 0),
    site.geofence.areaSqMeters
  );
  const needsGeofenceStep = currentMode !== 'single_tree';
  const canAdvanceFromGeofence = currentMode !== 'orchard' || (!!site.geofence.polygon && site.geofence.polygon.length >= 3);

  const goPlantNext = () => setWizardStep(needsGeofenceStep ? 'geofence' : 'personnel');
  const goPersonnelBack = () => setWizardStep(needsGeofenceStep ? 'geofence' : 'plant');

  const submissionInfo: SubmissionInfo = draft.submissionInfo ?? {
    submittedById: session?.uid || 'guest',
    submittedByName: session?.name || 'অনিবন্ধিত ব্যবহারকারী',
    office: session?.profile?.upazila
      ? `${session.profile.upazila} উপজেলা কৃষি অফিস`
      : session?.district
        ? `${session.district} কৃষি অফিস`
        : '—',
    submissionDate: new Date().toISOString(),
    status: 'pending_validation',
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      updateDraft((prev) => ({ ...prev, submissionInfo }));

      const routingBySiteId: Record<string, ValidationTask> = {};
      for (const s of draft.sites) {
        routingBySiteId[s.site_id] = routeToValidator(s);
      }

      const entryMode = session?.role === 'officer' ? 'dae_officer' : 'citizen';
      const saved = await submitAllSites(draft.sites, draft.personnel, submissionInfo, routingBySiteId, entryMode);
      onSubmitted?.(saved);

      setStatus('SUBMITTED');
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
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

        {/* Site switcher */}
        {draft.sites.length > 1 && wizardStep !== 'review' && (
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

        {/* Progress indicator — 4 dots */}
        <div className="flex items-center gap-1 mb-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= PROGRESS_DOT[wizardStep] ? 'bg-emerald-600' : 'bg-gray-100'}`} />
          ))}
        </div>
        <p className="text-[11px] font-semibold text-emerald-700 mb-3">{t.stepLabel[wizardStep]}</p>

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
                {!canAdvanceFromPlant && (
                  <p className="text-[10px] text-amber-600 mb-1">
                    {site.plants.length === 0 ? t.needAtLeastOnePlant : t.needAllPlantNames}
                  </p>
                )}
                <button
                  onClick={() => canAdvanceFromPlant && goPlantNext()}
                  disabled={!canAdvanceFromPlant}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {t.next} <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}

        {wizardStep === 'geofence' && (
          <>
            <GeoFenceStep site={site} onChange={updateSiteAt(activeSiteIndex)} language={language} />
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setWizardStep('plant')}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                <ChevronLeft size={14} /> {t.back}
              </button>
              <div className="text-right">
                {!canAdvanceFromGeofence && <p className="text-[10px] text-amber-600 mb-1">{t.needPolygon}</p>}
                <button
                  onClick={() => canAdvanceFromGeofence && setWizardStep('personnel')}
                  disabled={!canAdvanceFromGeofence}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {t.next} <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}

        {wizardStep === 'personnel' && (
          <>
            <PersonnelStep
              personnel={currentPersonnel}
              onChange={updatePersonnelForSite(site.site_id)}
              language={language}
            />
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={goPersonnelBack}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                <ChevronLeft size={14} /> {t.back}
              </button>
              <button
                onClick={() => setWizardStep('review')}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 active:scale-95 transition cursor-pointer"
              >
                {t.next} <ChevronRight size={14} />
              </button>
            </div>
          </>
        )}

        {wizardStep === 'review' && (
          <>
            <ReviewStep sites={draft.sites} personnel={draft.personnel} submissionInfo={submissionInfo} language={language} />
            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setWizardStep('personnel')}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50 cursor-pointer"
              >
                <ChevronLeft size={14} /> {t.back}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-60 cursor-pointer"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {submitting ? t.submitting : t.submit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
