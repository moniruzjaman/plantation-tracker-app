import { useState } from 'react';
import { Save, Loader2, Sparkles, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useOfflineDraft } from './hooks/useOfflineDraft';
import { useAuth } from '../../hooks/useAuth';
import SiteStep from './steps/SiteStep';
import PlantStep from './steps/PlantStep';
import PersonnelStep from './steps/PersonnelStep';
import ReviewStep from './steps/ReviewStep';
import { createEmptySite, createEmptyPersonnel, type SubmissionInfo } from './types/submission';

interface PlantationSubmissionProps {
  language?: 'bn' | 'en';
}

type WizardStep = 'site' | 'plant' | 'personnel' | 'review';
const STEP_ORDER: WizardStep[] = ['site', 'plant', 'personnel', 'review'];

/**
 * New Plantation Submission — wizard shell.
 *
 * Phase 1: Site step (GPS, map, reverse geocode, geofence mode, NDVI/carbon).
 * Phase 2: Plant step (multi-plant, photos, "same site?" branching that
 *   creates additional PlantationSites), Site<->Plant navigation, site switcher.
 * Phase 3 (this update): Personnel step (planter/caretaker, same-as-planter),
 *   Review step (per-site geofence validation score + auto-assigned SAAO via
 *   validationRouter, submission info auto-populated from the logged-in
 *   profile). "Submit" here transitions the draft to READY_FOR_SUBMISSION —
 *   actually flattening each site into a legacy PlantationSubmission and
 *   writing it to the `submissions` table (so it appears in Map/Dashboard/
 *   Registry) is Phase 4, alongside the orchard PolygonDrawer.
 *
 * Still to come:
 *   Phase 4 — PolygonDrawer for orchard mode, flatten-to-legacy-submission
 *             on final submit, replacing the current Form tab after testing
 */
export default function PlantationSubmission({ language = 'bn' }: PlantationSubmissionProps) {
  const { draft, loading, saving, updateDraft, setStatus } = useOfflineDraft();
  const { session } = useAuth();
  const [activeSiteIndex, setActiveSiteIndex] = useState(0);
  const [wizardStep, setWizardStep] = useState<WizardStep>('site');
  const [submitted, setSubmitted] = useState(false);

  const t = {
    title: language === 'bn' ? 'নতুন বৃক্ষরোপণ এন্ট্রি' : 'New Plantation Submission',
    beta: language === 'bn' ? 'বেটা' : 'BETA',
    saving: language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...',
    saved: language === 'bn' ? 'খসড়া সংরক্ষিত' : 'Draft saved',
    loading: language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...',
    stepLabel: {
      site: language === 'bn' ? 'ধাপ ১ / ৪ — স্থানের তথ্য' : 'Step 1 / 4 — Site Information',
      plant: language === 'bn' ? 'ধাপ ২ / ৪ — চারার তথ্য' : 'Step 2 / 4 — Plant Information',
      personnel: language === 'bn' ? 'ধাপ ৩ / ৪ — ব্যক্তিগত তথ্য' : 'Step 3 / 4 — Personnel',
      review: language === 'bn' ? 'ধাপ ৪ / ৪ — পর্যালোচনা' : 'Step 4 / 4 — Review',
    },
    site: language === 'bn' ? 'সাইট' : 'Site',
    back: language === 'bn' ? 'পূর্ববর্তী' : 'Back',
    next: language === 'bn' ? 'পরবর্তী' : 'Next',
    submit: language === 'bn' ? 'জমা দিন' : 'Submit',
    needAtLeastOnePlant: language === 'bn' ? 'এগোতে হলে অন্তত একটি চারা যোগ করুন' : 'Add at least one plant to continue',
    submittedTitle: language === 'bn' ? 'এন্ট্রি জমা হয়েছে' : 'Entry Submitted',
    submittedDesc: language === 'bn'
      ? 'আপনার এন্ট্রি সংরক্ষিত হয়েছে এবং যাচাইয়ের জন্য সারিবদ্ধ করা হয়েছে। সিঙ্ক ফিচার (Phase 4) যুক্ত হলে এটি স্বয়ংক্রিয়ভাবে সার্ভারে পাঠানো হবে।'
      : 'Your entry has been saved and queued for validation. Once sync (Phase 4) is wired up, it will be sent automatically.',
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

  // "No, different site" from PlantStep's same-site prompt — appends a
  // fresh PlantationSite (+ a Personnel record defaulted from the current
  // site's, since the same officer is usually filing both), makes it
  // active, and routes back to SiteStep (a new site needs its own GPS).
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
  const canAdvanceFromPlant = site.plants.length > 0;

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

  const handleSubmit = () => {
    updateDraft((prev) => ({ ...prev, submissionInfo }));
    setStatus('READY_FOR_SUBMISSION');
    setSubmitted(true);
  };

  const stepIndex = STEP_ORDER.indexOf(wizardStep);

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

        {/* Site switcher — only shown once a "different site" branch exists,
            hidden on the Review step since that already lists every site */}
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

        {/* Progress indicator — 4 steps */}
        <div className="flex items-center gap-1 mb-4">
          {STEP_ORDER.map((s, n) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full ${n <= stepIndex ? 'bg-emerald-600' : 'bg-gray-100'}`} />
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
                {!canAdvanceFromPlant && <p className="text-[10px] text-amber-600 mb-1">{t.needAtLeastOnePlant}</p>}
                <button
                  onClick={() => canAdvanceFromPlant && setWizardStep('personnel')}
                  disabled={!canAdvanceFromPlant}
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
                onClick={() => setWizardStep('plant')}
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
                className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 active:scale-95 transition cursor-pointer"
              >
                <CheckCircle2 size={14} /> {t.submit}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
