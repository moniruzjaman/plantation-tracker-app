/**
 * VM0047 Monitoring Revisit Component
 *
 * Allows monitoring officers to record revisit data at each checkpoint
 * (month_6, year_1, year_2, year_3). Collects:
 * - DBH (Diameter at Breast Height) — critical for carbon stock calculation
 * - Height and canopy radius measurements
 * - VM0047 3-tier health status (healthy / stressed / dead)
 * - 3-type photo evidence (QR closeup, full tree, context)
 * - SDG co-benefit observations
 *
 * The component reads the original submission from IndexedDB, validates
 * GPS proximity (<15m geofence), and posts the revisit to the server.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardCheck, Camera, Ruler, Activity, TreePine,
  MapPin, CheckCircle, AlertTriangle, XCircle, ArrowLeft, Save, Leaf, TrendingUp
} from 'lucide-react';
import { db, getSubmissionReward, saveMonitoringRevisit, getRevisitsForSubmission, type MonitoringRevisitRecord } from '../../lib/db';
import type {
  PlantationSubmission, CheckpointStage, VM0047HealthStatus, PhotoType, PhotoRecord
} from '../../types/plantation';
import { compressPhoto, CHECKPOINT_GEOFENCE_METERS, distanceMeters, VM0047_REQUIRED_PHOTO_TYPES, PHOTO_TYPE_LABELS } from '../../utils/photoEvidence';
import { calculateGrowthPrognosis } from '../../utils/growthModel';
import { calculateCarbonStock } from '../../utils/carbonStock';
import { getNdviForPoint } from '../../modules/plantationSubmission/services/ndvi';
import { CHECKPOINT_LABEL } from '../../services/revisitSchedule';

interface MonitoringRevisitProps {
  submissionId: string;
  onBack: () => void;
  gpsLat?: number;
  gpsLon?: number;
  gpsAccuracy?: number;
}

interface RevisitFormData {
  stage: CheckpointStage;
  avgHeightM: string;
  avgDbhCm: string;
  avgCanopyRadiusM: string;
  vm0047HealthStatus: VM0047HealthStatus;
  survivalCount: string;
  deadCount: string;
  sdgIncomeChange: string;
  sdgSoilHealth: string;
  biodiversityNote: string;
  remarks: string;
}

const INITIAL_FORM: RevisitFormData = {
  stage: 'month_6',
  avgHeightM: '',
  avgDbhCm: '',
  avgCanopyRadiusM: '',
  vm0047HealthStatus: 'healthy',
  survivalCount: '',
  deadCount: '',
  sdgIncomeChange: '',
  sdgSoilHealth: '',
  biodiversityNote: '',
  remarks: '',
};

const STAGE_OPTIONS: { value: CheckpointStage; labelBn: string; labelEn: string }[] = [
  { value: 'month_6', labelBn: '৬ মাস পর', labelEn: '6-Month' },
  { value: 'year_1', labelBn: '১ বছর পর', labelEn: 'Year 1' },
  { value: 'year_2', labelBn: '২ বছর পর', labelEn: 'Year 2' },
  { value: 'year_3', labelBn: '৩ বছর পর', labelEn: 'Year 3' },
];

const HEALTH_OPTIONS: { value: VM0047HealthStatus; labelBn: string; icon: any; color: string }[] = [
  { value: 'healthy', labelBn: 'সুস্থ', icon: CheckCircle, color: 'text-emerald-600' },
  { value: 'stressed', labelBn: 'চাপাচাপি', icon: AlertTriangle, color: 'text-amber-600' },
  { value: 'dead', labelBn: 'মৃত', icon: XCircle, color: 'text-red-600' },
];

export default function MonitoringRevisit({ submissionId, onBack, gpsLat, gpsLon, gpsAccuracy }: MonitoringRevisitProps) {
  const [submission, setSubmission] = useState<PlantationSubmission | null>(null);
  const [form, setForm] = useState<RevisitFormData>(INITIAL_FORM);
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [showCarbonReport, setShowCarbonReport] = useState(false);
  const [ndvi, setNdvi] = useState<number | null>(null);
  const [ndviLoading, setNdviLoading] = useState(false);
  const [history, setHistory] = useState<MonitoringRevisitRecord[]>([]);
  const [savedOffline, setSavedOffline] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load original submission
  useEffect(() => {
    db.submissions.get(submissionId).then(setSubmission);
  }, [submissionId]);

  // Load this site's local revisit history — powers the growth/NDVI
  // trend shown below the form, and works fully offline.
  useEffect(() => {
    getRevisitsForSubmission(submissionId).then(setHistory);
  }, [submissionId]);

  // Sample NDVI at the revisit's GPS point, same source used at planting
  // time (modules/plantationSubmission/services/ndvi.ts) — this is what
  // lets the trend actually compare apples to apples across visits.
  useEffect(() => {
    if (!gpsLat || !gpsLon) return;
    let cancelled = false;
    setNdviLoading(true);
    getNdviForPoint(gpsLat, gpsLon)
      .then((r) => { if (!cancelled) setNdvi(r.ndvi); })
      .catch(() => { if (!cancelled) setNdvi(null); })
      .finally(() => { if (!cancelled) setNdviLoading(false); });
    return () => { cancelled = true; };
  }, [gpsLat, gpsLon]);

  // Calculate GPS distance from original planting point
  useEffect(() => {
    if (submission && gpsLat && gpsLon) {
      const dist = distanceMeters(submission.latitude, submission.longitude, gpsLat, gpsLon);
      setGpsDistance(dist);
    }
  }, [submission, gpsLat, gpsLon]);

  const updateField = useCallback((field: keyof RevisitFormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const handlePhotoCapture = useCallback(async (photoType: PhotoType) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const compressed = await compressPhoto(file, { vm0047Revisit: true, photoType });
        const newPhoto: PhotoRecord = {
          id: crypto.randomUUID(),
          stage: form.stage,
          url: compressed.url,
          sha256: compressed.sha256,
          capturedAt: new Date().toISOString(),
          latitude: gpsLat || 0,
          longitude: gpsLon || 0,
          distanceFromOriginMeters: gpsDistance ?? undefined,
          photoType,
        };
        setPhotos(prev => [...prev, newPhoto]);
      };
      input.click();
    } catch (err) {
      console.error('[Photo Capture]', err);
    }
  }, [form.stage, gpsLat, gpsLon, gpsDistance]);

  const handleSave = useCallback(async () => {
    if (!submission) return;
    setSaving(true);
    setSaveError(null);

    // A revisit filed with no signal in a char area must not be lost --
    // the local IndexedDB write always happens; the server POST is
    // best-effort and just flips `synced` on the local record.
    let syncedToServer = false;
    try {
      const res = await fetch('/api/monitoring/revisit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: submission.id,
          stage: form.stage,
          avgHeightM: parseFloat(form.avgHeightM) || null,
          avgDbhCm: parseFloat(form.avgDbhCm) || null,
          avgCanopyRadiusM: parseFloat(form.avgCanopyRadiusM) || null,
          vm0047HealthStatus: form.vm0047HealthStatus,
          survivalCount: parseInt(form.survivalCount) || null,
          deadCount: parseInt(form.deadCount) || null,
          latitude: gpsLat || 0,
          longitude: gpsLon || 0,
          accuracy: gpsAccuracy || 0,
          sdgIncomeChange: form.sdgIncomeChange || null,
          sdgSoilHealth: form.sdgSoilHealth || null,
          biodiversityNote: form.biodiversityNote || null,
          remarks: form.remarks || null,
        }),
      });
      syncedToServer = res.ok;
    } catch {
      syncedToServer = false; // offline/network error -- fall through to local save
    }

    try {
      // Update local submission with VM0047 health status
      await db.submissions.update(submission.id, {
        vm0047HealthStatus: form.vm0047HealthStatus,
      });

      // Add photos to local submission
      if (photos.length > 0) {
        const updated = { ...submission, photos: [...submission.photos, ...photos], vm0047HealthStatus: form.vm0047HealthStatus };
        await db.submissions.put(updated);
      }

      // Persist this revisit locally too -- powers the offline revisit-due
      // list and the growth/NDVI trend without depending on a server
      // round-trip every time the dashboard loads. This always runs, even
      // if the server POST above failed.
      await saveMonitoringRevisit({
        id: crypto.randomUUID(),
        submissionId: submission.id,
        stage: form.stage,
        recordedAt: new Date().toISOString(),
        avgHeightM: parseFloat(form.avgHeightM) || undefined,
        avgDbhCm: parseFloat(form.avgDbhCm) || undefined,
        avgCanopyRadiusM: parseFloat(form.avgCanopyRadiusM) || undefined,
        vm0047HealthStatus: form.vm0047HealthStatus,
        survivalCount: parseInt(form.survivalCount) || undefined,
        deadCount: parseInt(form.deadCount) || undefined,
        ndvi: ndvi ?? undefined,
        latitude: gpsLat || 0,
        longitude: gpsLon || 0,
        synced: syncedToServer,
      });

      setSavedOffline(!syncedToServer);
      setSaved(true);
    } catch (err) {
      console.error('[Save Monitoring]', err);
      setSaveError('স্থানীয়ভাবে সংরক্ষণ ব্যর্থ হয়েছে -- আবার চেষ্টা করুন');
    } finally {
      setSaving(false);
    }
  }, [submission, form, photos, gpsLat, gpsLon, gpsAccuracy, ndvi]);

  if (!submission) {
    return <div className="p-4 text-center text-gray-500">লোড হচ্ছে...</div>;
  }

  // Calculate carbon stock if measurements provided
  const carbonReport = (parseFloat(form.avgDbhCm) > 0 && parseFloat(form.avgHeightM) > 0)
    ? calculateCarbonStock(
        submission.seedlings,
        [{ speciesName: submission.seedlings[0]?.speciesName || '', avgDbhCm: parseFloat(form.avgDbhCm), avgHeightM: parseFloat(form.avgHeightM) }],
        (submission.areaSqMeters || 10000) / 10000,
      )
    : null;

  const missingPhotoTypes = VM0047_REQUIRED_PHOTO_TYPES.filter(
    t => !photos.some(p => p.photoType === t)
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 rounded-lg hover:bg-white/20">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              মনিটরিং পুনর্পরিদর্শন
            </h1>
            <p className="text-emerald-100 text-xs">
              {submission.treeSerial || submission.id.slice(0, 8)} • {submission.district}
            </p>
          </div>
        </div>
      </div>

      {saved ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="mx-4 mt-6 bg-white rounded-2xl p-6 text-center shadow-lg border border-emerald-200">
          <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">সফলভাবে সংরক্ষিত হয়েছে!</h2>
          <p className="text-gray-600 mb-1">চেকপয়েন্ট: {STAGE_OPTIONS.find(s => s.value === form.stage)?.labelBn}</p>
          <p className="text-gray-600 mb-1">স্বাস্থ্য: {HEALTH_OPTIONS.find(h => h.value === form.vm0047HealthStatus)?.labelBn}</p>
          {savedOffline && (
            <p className="text-amber-600 text-xs font-semibold mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-block">
              অফলাইনে সংরক্ষিত — নেটওয়ার্ক ফিরলে স্বয়ংক্রিয়ভাবে সার্ভারে পাঠানো হবে
            </p>
          )}
          {carbonReport && (
            <p className="text-emerald-700 font-medium mt-3">
              CO₂ সমতুল্য: {carbonReport.co2EquivalentTons.toFixed(4)} টন
            </p>
          )}
          <button onClick={onBack} className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl font-medium">
            ফিরে যান
          </button>
        </motion.div>
      ) : (
        <div className="space-y-4 p-4">
          {/* GPS Validation */}
          {gpsDistance !== null && (
            <div className={`rounded-xl p-3 flex items-center gap-2 text-sm ${
              gpsDistance <= CHECKPOINT_GEOFENCE_METERS
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              <MapPin className="w-4 h-4 shrink-0" />
              <span>
                {gpsDistance <= CHECKPOINT_GEOFENCE_METERS
                  ? `GPS যাচাই সফল (${gpsDistance.toFixed(1)}m)`
                  : `সতর্কতা: মূল বিন্দু থেকে ${gpsDistance.toFixed(1)}m দূরে`}
              </span>
            </div>
          )}

          {/* Checkpoint Stage */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2">চেকপয়েন্ট পর্যায়</label>
            <div className="grid grid-cols-2 gap-2">
              {STAGE_OPTIONS.map(opt => (
                <button key={opt.value}
                  onClick={() => updateField('stage', opt.value)}
                  className={`p-3 rounded-xl text-sm font-medium border-2 transition-all ${
                    form.stage === opt.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {opt.labelBn}
                </button>
              ))}
            </div>
          </div>

          {/* VM0047 Health Status */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Activity className="w-4 h-4 inline mr-1" />
              VM0047 স্বাস্থ্য অবস্থা
            </label>
            <div className="grid grid-cols-3 gap-2">
              {HEALTH_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button key={opt.value}
                    onClick={() => updateField('vm0047HealthStatus', opt.value)}
                    className={`p-3 rounded-xl text-center border-2 transition-all ${
                      form.vm0047HealthStatus === opt.value
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <Icon className={`w-6 h-6 mx-auto mb-1 ${form.vm0047HealthStatus === opt.value ? opt.color : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${form.vm0047HealthStatus === opt.value ? 'text-gray-800' : 'text-gray-500'}`}>
                      {opt.labelBn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Field Measurements */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <Ruler className="w-4 h-4 inline mr-1" />
              ক্ষেত্র পরিমাপ (কার্বন স্টক হিসাবের জন্য)
            </label>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">গড় উচ্চতা (মিটার)</label>
                <input type="number" step="0.01" placeholder="যেমন: 2.5"
                  value={form.avgHeightM}
                  onChange={e => updateField('avgHeightM', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">গড় DBH — বক্ষ উচ্চতায় ব্যাস (সে.মি.)</label>
                <input type="number" step="0.1" placeholder="যেমন: 5.2"
                  value={form.avgDbhCm}
                  onChange={e => updateField('avgDbhCm', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
                </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">গড় ক্যানোপি ব্যাসার্ধ (মিটার)</label>
                <input type="number" step="0.01" placeholder="যেমন: 1.2"
                  value={form.avgCanopyRadiusM}
                  onChange={e => updateField('avgCanopyRadiusM', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm" />
              </div>
            </div>

            {/* Carbon Stock Preview */}
            {carbonReport && (
              <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-blue-700">VM0047 কার্বন স্টক প্রাক্কলন</span>
                  <button onClick={() => setShowCarbonReport(!showCarbonReport)}
                    className="text-xs text-blue-600 underline">বিস্তারিত</button>
                </div>
                <p className="text-lg font-bold text-blue-800">
                  {carbonReport.co2EquivalentTons.toFixed(4)} টন CO₂e
                </p>
                <p className="text-xs text-blue-600">
                  উপরে কার্বন: {carbonReport.abovegroundCarbonMgPerHa.toFixed(3)} Mg/ha •
                  নিচে কার্বন: {carbonReport.belowgroundCarbonMgPerHa.toFixed(3)} Mg/ha •
                  আস্থা: {carbonReport.confidenceLevel === 'high' ? 'উচ্চ' : carbonReport.confidenceLevel === 'medium' ? 'মধ্যম' : 'নিম্ন'}
                </p>
                <AnimatePresence>
                  {showCarbonReport && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden text-xs text-blue-700 mt-2 space-y-1">
                      <p>পদ্ধতি: {carbonReport.methodology}</p>
                      <p>পরিমাপকৃত গাছ: {carbonReport.treesWithMeasurements}</p>
                      <p>অনুমানিত গাছ: {carbonReport.treesEstimated}</p>
                      <p>মোট কার্বন স্টক: {carbonReport.totalCarbonStockMg.toFixed(4)} Mg</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* NDVI reading at this revisit */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Leaf className="w-4 h-4 inline mr-1 text-emerald-600" />
              এই পরিদর্শনে NDVI (স্যাটেলাইট)
            </label>
            {ndviLoading ? (
              <p className="text-xs text-gray-400">NDVI পড়া হচ্ছে...</p>
            ) : ndvi !== null ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${ndvi >= 0.5 ? 'bg-emerald-500' : ndvi >= 0.25 ? 'bg-amber-500' : 'bg-red-400'}`}
                    style={{ width: `${Math.max(0, Math.min(1, ndvi)) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700 font-mono">{ndvi.toFixed(3)}</span>
              </div>
            ) : (
              <p className="text-xs text-gray-400">GPS পাওয়া গেলে NDVI স্বয়ংক্রিয়ভাবে যোগ হবে</p>
            )}
          </div>

          {/* Growth / NDVI trend across past checkpoints */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                <TrendingUp className="w-4 h-4 inline mr-1 text-emerald-600" />
                বৃদ্ধি ও NDVI ট্রেন্ড
              </label>
              <div className="space-y-2">
                {history.map((h) => {
                  const health = HEALTH_OPTIONS.find((o) => o.value === h.vm0047HealthStatus);
                  const HealthIcon = health?.icon || CheckCircle;
                  return (
                    <div key={h.id} className="flex items-center gap-2 text-xs border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                      <HealthIcon className={`w-3.5 h-3.5 shrink-0 ${health?.color || 'text-gray-400'}`} />
                      <span className="font-semibold text-gray-700 w-14 shrink-0">
                        {CHECKPOINT_LABEL[h.stage]?.bn || h.stage}
                      </span>
                      <span className="text-gray-400 w-20 shrink-0">{h.recordedAt.slice(0, 10)}</span>
                      {h.avgHeightM !== undefined && (
                        <span className="text-gray-600">{h.avgHeightM.toFixed(1)}মি</span>
                      )}
                      {h.ndvi !== undefined && (
                        <span className="ml-auto font-mono text-emerald-700 font-semibold">
                          NDVI {h.ndvi.toFixed(2)}
                        </span>
                      )}
                      {!h.synced && (
                        <span className="text-[9px] text-amber-500 font-semibold">অসিঙ্ক</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Survival Counts */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              <TreePine className="w-4 h-4 inline mr-1" />
              জীবনমৃত্যু গণনা
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">জীবিত গাছ</label>
                <input type="number" placeholder="সংখ্যা"
                  value={form.survivalCount}
                  onChange={e => updateField('survivalCount', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">মৃত গাছ</label>
                <input type="number" placeholder="সংখ্যা"
                  value={form.deadCount}
                  onChange={e => updateField('deadCount', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:border-red-400 outline-none text-sm" />
              </div>
            </div>
          </div>

          {/* VM0047 3-Type Photo Evidence */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              <Camera className="w-4 h-4 inline mr-1" />
              VM0047 ছবি প্রমাণ (৩ ধরনের)
            </label>
            <p className="text-xs text-gray-400 mb-3">প্রতিটি পুনর্পরিদর্শনে ৩টি নির্দিষ্ট ছবি আবশ্যক</p>
            <div className="grid grid-cols-3 gap-2">
              {VM0047_REQUIRED_PHOTO_TYPES.map(pt => {
                const hasPhoto = photos.some(p => p.photoType === pt);
                const labels = PHOTO_TYPE_LABELS[pt];
                return (
                  <button key={pt}
                    onClick={() => handlePhotoCapture(pt)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      hasPhoto
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-dashed border-gray-300 hover:border-emerald-400'
                    }`}>
                    <Camera className={`w-5 h-5 mx-auto mb-1 ${hasPhoto ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span className="text-xs font-medium text-gray-700 block">{labels.bn}</span>
                    {hasPhoto && <CheckCircle className="w-3 h-3 text-emerald-500 mx-auto mt-1" />}
                  </button>
                );
              })}
            </div>
            {missingPhotoTypes.length > 0 && (
              <p className="text-xs text-amber-600 mt-2">
                বাকি: {missingPhotoTypes.map(t => PHOTO_TYPE_LABELS[t].bn).join(', ')}
              </p>
            )}
          </div>

          {/* SDG Co-Benefits */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-700 mb-3">SDG সহ-সুবিধা পর্যবেক্ষণ</label>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">SDG ১: কৃষকের আয়ের পরিবর্তন</label>
                <select value={form.sdgIncomeChange}
                  onChange={e => updateField('sdgIncomeChange', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm">
                  <option value="">নির্বাচন করুন</option>
                  <option value="increased">আয় বৃদ্ধি পেয়েছে</option>
                  <option value="stable">আয় অপরিবর্তিত</option>
                  <option value="decreased">আয় হ্রাস পেয়েছে</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">SDG ১৫: মাটির স্বাস্থ্য</label>
                <select value={form.sdgSoilHealth}
                  onChange={e => updateField('sdgSoilHealth', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm">
                  <option value="">নির্বাচন করুন</option>
                  <option value="improved">উন্নত হয়েছে</option>
                  <option value="stable">অপরিবর্তিত</option>
                  <option value="degraded">অবন্নত হয়েছে</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">জীববৈচিত্র্য নোট (ঐচ্ছিক)</label>
                <textarea placeholder="পাখির প্রজাতি, কীটপতঙ্গ ইত্যাদি..."
                  value={form.biodiversityNote}
                  onChange={e => updateField('biodiversityNote', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm h-16 resize-none" />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="text-xs text-gray-500 mb-1 block">মন্তব্য</label>
            <textarea placeholder="অতিরিক্ত পর্যবেক্ষণ নোট..."
              value={form.remarks}
              onChange={e => updateField('remarks', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm h-16 resize-none" />
          </div>

          {/* Save Button */}
          {saveError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-center">
              {saveError}
            </p>
          )}
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-base
              flex items-center justify-center gap-2 shadow-lg shadow-emerald-200
              disabled:opacity-50 disabled:shadow-none hover:bg-emerald-700 transition-all">
            <Save className="w-5 h-5" />
            {saving ? 'সংরক্ষণ হচ্ছে...' : 'মনিটরিং সংরক্ষণ করুন'}
          </button>
        </div>
      )}
    </div>
  );
}