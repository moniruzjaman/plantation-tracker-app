import { useState } from 'react';
import { Save, Loader2, Sparkles, CheckCircle2, MapPin, Sprout, Fence, UserCircle2, ClipboardCheck } from 'lucide-react';
import { useOfflineDraft } from './hooks/useOfflineDraft';
import { useAuth } from '../../hooks/useAuth';
import type { PlantationSubmission as LegacyPlantationSubmission } from '../../types/plantation';
import SiteStep from './steps/SiteStep';
import PlantStep from './steps/PlantStep';
import GeoFenceStep from './steps/GeoFenceStep';
import PersonnelStep from './steps/PersonnelStep';
import ReviewStep from './steps/ReviewStep';
import CollapsibleSection from './components/CollapsibleSection';
import { resolveGeofenceMode } from './hooks/useGeofenceMode';
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

type SectionId = 'site' | 'plant' | 'geofence' | 'personnel' | 'review';

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
  // All form sections render on one scrollable page as independent
  // collapsibles rather than a click-through step wizard — Site and Plant
  // start open (the two things almost every entry needs), the rest start
  // collapsed so the page isn't overwhelming, but any section can be
  // opened/closed freely and in any order.
  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    site: true,
    plant: true,
    geofence: false,
    personnel: false,
    review: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleSection = (id: SectionId) => setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  const openOnly = (ids: SectionId[]) =>
    setOpenSections((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = true; });
      return next;
    });

  const t = {
    title: language === 'bn' ? 'নতুন বৃক্ষরোপণ এন্ট্রি' : 'New Plantation Submission',
    beta: language === 'bn' ? 'বেটা' : 'BETA',
    saving: language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...',
    saved: language === 'bn' ? 'খসড়া সংরক্ষিত' : 'Draft saved',
    loading: language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...',
    sectionTitle: {
      site: language === 'bn' ? 'স্থানের তথ্য' : 'Site Information',
      plant: language === 'bn' ? 'চারার তথ্য' : 'Plant Information',
      geofence: language === 'bn' ? 'জিও-ফেন্স' : 'Geofence',
      personnel: language === 'bn' ? 'ব্যক্তিগত তথ্য' : 'Personnel',
      review: language === 'bn' ? 'পর্যালোচনা ও জমা' : 'Review & Submit',
    },
    sectionSubtitle: {
      site: language === 'bn' ? 'GPS, ম্যাপ, ঠিকানা' : 'GPS, map, address',
      plant: language === 'bn' ? 'প্রজাতি, সংখ্যা, ছবি' : 'Species, quantity, photos',
      geofence: language === 'bn' ? 'ব্যাসার্ধ বা সীমানা আঁকুন' : 'Radius or boundary polygon',
      personnel: language === 'bn' ? 'রোপণকারী ও পরিচর্যাকারী' : 'Planter & caretaker',
      review: language === 'bn' ? 'জমা দেওয়ার আগে যাচাই করুন' : 'Verify before submitting',
    },
    site: language === 'bn' ? 'সাইট' : 'Site',
    submit: language === 'bn' ? 'জমা দিন' : 'Submit',
    submitting: language === 'bn' ? 'জমা হচ্ছে...' : 'Submitting...',
    needLocation: language === 'bn' ? 'স্থানের তথ্যে GPS অবস্থান নির্ধারণ করুন' : 'Set a GPS location in Site Information',
    needAtLeastOnePlant: language === 'bn' ? 'অন্তত একটি চারা যোগ করুন' : 'Add at least one plant',
    needAllPlantNames: language === 'bn' ? 'প্রতিটি চারার নাম দিন — খালি রাখা যাবে না' : 'Every plant needs a name',
    needPolygon: language === 'bn' ? 'জিও-ফেন্সে সীমানা আঁকুন' : 'Draw the boundary in Geofence',
    readyToSubmit: language === 'bn' ? 'সব তথ্য সম্পূর্ণ — জমা দিতে প্রস্তুত' : 'All set — ready to submit',
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
    openOnly(['site', 'plant']);
  };

  const hasLocation = site.location.latitude !== 0 || site.location.longitude !== 0;
  // Was `site.plants.length > 0` only -- let an empty PlantCard (name never
  // typed) through as long as at least one card existed, so the very first
  // plant's name silently landed blank in the final submission (reported:
  // "1st plant name entry missing, directly going to [step] 2"). Every
  // plant on the site now has to actually have a species name before
  // submission is allowed, not just exist.
  const hasAllPlantNames = site.plants.length > 0 && site.plants.every((p) => p.speciesName.trim() !== '');

  const currentMode = resolveGeofenceMode(site);
  const needsGeofenceSection = currentMode !== 'single_tree';
  const geofenceSatisfied = currentMode !== 'orchard' || (!!site.geofence.polygon && site.geofence.polygon.length >= 3);

  // Everything the active site needs before the whole draft can be
  // submitted -- surfaced both as a disabled Submit button and as a short
  // checklist, since sections can now be opened/filled in any order.
  const outstanding: string[] = [];
  if (!hasLocation) outstanding.push(t.needLocation);
  if (site.plants.length === 0) outstanding.push(t.needAtLeastOnePlant);
  else if (!hasAllPlantNames) outstanding.push(t.needAllPlantNames);
  if (needsGeofenceSection && !geofenceSatisfied) outstanding.push(t.needPolygon);
  const canSubmit = outstanding.length === 0;

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
        {draft.sites.length > 1 && (
          <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
            {draft.sites.map((s, i) => (
              <button
                key={s.site_id}
                onClick={() => {
                  setActiveSiteIndex(i);
                  openOnly(['site', 'plant']);
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

        {/* All sections on one scrollable page, each independently
            collapsible — Site, Geofence, Plant, Personnel, Review. */}
        <div className="space-y-2.5">
          <CollapsibleSection
            title={t.sectionTitle.site}
            subtitle={t.sectionSubtitle.site}
            icon={<MapPin size={16} />}
            open={openSections.site}
            onToggle={() => toggleSection('site')}
            complete={hasLocation}
            needsAttention={!hasLocation}
          >
            <SiteStep site={site} onChange={updateSiteAt(activeSiteIndex)} language={language} />
          </CollapsibleSection>

          <CollapsibleSection
            title={t.sectionTitle.plant}
            subtitle={t.sectionSubtitle.plant}
            icon={<Sprout size={16} />}
            open={openSections.plant}
            onToggle={() => toggleSection('plant')}
            complete={hasAllPlantNames}
            needsAttention={site.plants.length === 0 || !hasAllPlantNames}
          >
            <PlantStep
              site={site}
              siteLabel={`${t.site} ${activeSiteIndex + 1}`}
              onChange={updateSiteAt(activeSiteIndex)}
              onRequestNewSite={handleRequestNewSite}
              language={language}
            />
          </CollapsibleSection>

          {needsGeofenceSection && (
            <CollapsibleSection
              title={t.sectionTitle.geofence}
              subtitle={t.sectionSubtitle.geofence}
              icon={<Fence size={16} />}
              open={openSections.geofence}
              onToggle={() => toggleSection('geofence')}
              complete={geofenceSatisfied}
              needsAttention={!geofenceSatisfied}
            >
              <GeoFenceStep site={site} onChange={updateSiteAt(activeSiteIndex)} language={language} />
            </CollapsibleSection>
          )}

          <CollapsibleSection
            title={t.sectionTitle.personnel}
            subtitle={t.sectionSubtitle.personnel}
            icon={<UserCircle2 size={16} />}
            open={openSections.personnel}
            onToggle={() => toggleSection('personnel')}
            complete={!!currentPersonnel.planterName || !!currentPersonnel.caretakerName}
          >
            <PersonnelStep
              personnel={currentPersonnel}
              onChange={updatePersonnelForSite(site.site_id)}
              language={language}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title={t.sectionTitle.review}
            subtitle={t.sectionSubtitle.review}
            icon={<ClipboardCheck size={16} />}
            open={openSections.review}
            onToggle={() => toggleSection('review')}
          >
            <ReviewStep sites={draft.sites} personnel={draft.personnel} submissionInfo={submissionInfo} language={language} />
          </CollapsibleSection>
        </div>

        {/* Single submit bar — sections no longer gate each other; this is
            the only place that must be satisfied before saving the draft. */}
        <div className="mt-5 border-t border-gray-100 pt-4">
          {!canSubmit && (
            <ul className="mb-2.5 space-y-1">
              {outstanding.map((msg) => (
                <li key={msg} className="text-[11px] text-amber-600 flex items-center gap-1">
                  • {msg}
                </li>
              ))}
            </ul>
          )}
          {canSubmit && <p className="text-[11px] text-emerald-600 font-semibold mb-2.5">{t.readyToSubmit}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className="w-full flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {submitting ? t.submitting : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
}

