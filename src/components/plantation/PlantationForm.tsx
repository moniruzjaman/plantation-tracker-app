import { useState, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, MapPin, User, Users, Search, Camera, AlertTriangle, X } from 'lucide-react';
import {
  PlantationSubmission,
  SeedlingEntry,
  EntryMode,
  createEmptySubmission,
} from '../../types/plantation';
import { getRegionOptions, getDistrictsByRegion, getUpazilasByDistrict } from '../../data/geoData';
import { getUnionNameSuggestions, getBlockNameSuggestions } from '../../data/administrativeDirectory';
import EditableCombobox from '../ui/EditableCombobox';
import { PLANT_TYPES, getSpeciesByPlantType, addPendingSpecies, addPendingPlantType } from '../../data/taxonomy';
import { checkSpacing } from '../../data/spacingNorms';
import { compressPhoto, distanceMeters, CHECKPOINT_GEOFENCE_METERS } from '../../utils/photoEvidence';
import { useSaaoDirectory, useMonitoringOfficerDirectory } from '../../hooks/useDirectory';
import type { GeoState } from '../GeolocationIndicator';

interface PlantationFormProps {
  geoState: GeoState | null;
  onSubmit: (submission: PlantationSubmission) => void;
}

export default function PlantationForm({ geoState, onSubmit }: PlantationFormProps) {
  const [mode, setMode] = useState<EntryMode>('dae_officer');
  const [form, setForm] = useState<PlantationSubmission>(() => createEmptySubmission('dae_officer'));
  const [photoBusy, setPhotoBusy] = useState(false);

  const saaoDirectory = useSaaoDirectory();
  const officerDirectory = useMonitoringOfficerDirectory(form.upazila);

  const switchMode = (next: EntryMode) => {
    setMode(next);
    setForm((prev) => ({ ...createEmptySubmission(next), village: prev.village }));
  };

  const update = <K extends keyof PlantationSubmission>(key: K, value: PlantationSubmission[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ---- Geo cascade ----
  const regionOptions = getRegionOptions(mode);
  const districtOptions = form.region ? getDistrictsByRegion(mode, form.region) : [];
  const upazilaOptions = form.district ? getUpazilasByDistrict(form.district) : [];

  const onRegionChange = (region: string) => setForm((p) => ({ ...p, region, district: '', upazila: '' }));
  const onDistrictChange = (district: string) => setForm((p) => ({ ...p, district, upazila: '' }));

  // ---- Seedling rows ----
  const addSeedling = () => {
    const row: SeedlingEntry = { id: crypto.randomUUID(), speciesName: '', count: 0 };
    update('seedlings', [...form.seedlings, row]);
  };
  const updateSeedling = (id: string, patch: Partial<SeedlingEntry>) => {
    update('seedlings', form.seedlings.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const removeSeedling = (id: string) => {
    update('seedlings', form.seedlings.filter((s) => s.id !== id));
  };

  const setSeedlingPlantType = (id: string, plantTypeId: string) => {
    updateSeedling(id, { plantTypeId, speciesId: undefined, speciesName: '' });
  };
  const setSeedlingSpecies = (id: string, speciesId: string, speciesList: { id: string; name: string }[]) => {
    const sp = speciesList.find((s) => s.id === speciesId);
    updateSeedling(id, { speciesId, speciesName: sp?.name ?? '' });
  };
  const addNewSpecies = (id: string, plantTypeId: string, name: string) => {
    if (!name.trim()) return;
    const sp = addPendingSpecies(name.trim(), plantTypeId);
    updateSeedling(id, { speciesId: sp.id, speciesName: sp.name });
  };
  const addNewPlantType = (id: string, name: string) => {
    if (!name.trim()) return;
    const pt = addPendingPlantType(name.trim());
    setSeedlingPlantType(id, pt.id);
  };

  // ---- SAAO selection ----
  const pickSaao = (entryId: string) => {
    const saao = saaoDirectory.results.find((s) => s.id === entryId);
    if (!saao) return;
    const resolved = saaoDirectory.resolve(saao);
    setForm((prev) => ({
      ...prev,
      saaoId: saao.id,
      saaoName: saao.name,
      saaoMobile: saao.mobile,
      blockId: resolved.blockId,
      blockName: resolved.blockName ?? prev.blockName,
      union: resolved.union ?? prev.union,
    }));
    saaoDirectory.setQuery('');
  };

  // ---- Photo capture ----
  const capturePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const compressed = await compressPhoto(file);
      const lat = geoState?.coords?.latitude ?? form.latitude;
      const lon = geoState?.coords?.longitude ?? form.longitude;
      const origin = form.photos[0];
      const dist = origin ? distanceMeters(origin.latitude, origin.longitude, lat, lon) : undefined;
      update('photos', [
        ...form.photos,
        {
          id: crypto.randomUUID(),
          stage: 'planting' as const,
          url: compressed.url,
          sha256: compressed.sha256,
          capturedAt: new Date().toISOString(),
          latitude: lat,
          longitude: lon,
          distanceFromOriginMeters: dist,
        },
      ]);
    } finally {
      setPhotoBusy(false);
    }
  };
  const removePhoto = (id: string) => update('photos', form.photos.filter((p) => p.id !== id));

  // ---- GPS + submit ----
  const useGps = () => {
    if (geoState?.coords) {
      update('latitude', geoState.coords.latitude);
      update('longitude', geoState.coords.longitude);
      update('accuracy', geoState.coords.accuracy);
    }
  };

  const handleSubmit = () => {
    onSubmit({ ...form, timestamp: new Date().toISOString() });
    setForm(createEmptySubmission(mode));
  };

  return (
    <div className="w-full max-w-lg mx-auto p-4 space-y-5 pb-24">
      {/* Mode toggle */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200">
        <button
          onClick={() => switchMode('dae_officer')}
          className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 ${mode === 'dae_officer' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`}
        >
          <Users size={16} /> DAE কর্মকর্তা
        </button>
        <button
          onClick={() => switchMode('citizen')}
          className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 ${mode === 'citizen' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600'}`}
        >
          <User size={16} /> নাগরিক / বহিরাগত
        </button>
      </div>

      {/* Location — region cascade */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">অবস্থান</h3>
        <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.region} onChange={(e) => onRegionChange(e.target.value)}>
          <option value="">{mode === 'dae_officer' ? 'DAE অঞ্চল নির্বাচন করুন' : 'বিভাগ নির্বাচন করুন'}</option>
          {regionOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select className="w-full border rounded-lg px-3 py-2 text-sm" value={form.district} onChange={(e) => onDistrictChange(e.target.value)} disabled={!form.region}>
          <option value="">জেলা নির্বাচন করুন</option>
          {districtOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <EditableCombobox
          value={form.upazila}
          onChange={(v) => setForm((p) => ({ ...p, upazila: v, union: '', blockName: '' }))}
          options={upazilaOptions}
          placeholder="উপজেলা নির্বাচন করুন বা লিখুন"
          disabled={!form.district}
        />
        <EditableCombobox
          value={form.union}
          onChange={(v) => update('union', v)}
          options={form.upazila ? getUnionNameSuggestions(form.upazila) : []}
          placeholder="ইউনিয়ন নির্বাচন করুন বা লিখুন"
          disabled={!form.upazila}
        />
        <div>
          <EditableCombobox
            value={form.blockName ?? ''}
            onChange={(v) => update('blockName', v)}
            options={form.upazila && form.union ? getBlockNameSuggestions(form.upazila, form.union) : []}
            placeholder="ব্লক (ঐচ্ছিক) — নির্বাচন করুন বা লিখুন"
            disabled={!form.union}
          />
          <p className="text-[11px] text-gray-400 mt-1">SAAO নির্বাচন করলে স্বয়ংক্রিয়ভাবে পূরণ হবে — তালিকায় না থাকলে সরাসরি লিখুন</p>
        </div>
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="গ্রাম" value={form.village} onChange={(e) => update('village', e.target.value)} />
        <button onClick={useGps} className="w-full flex items-center justify-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg py-2">
          <MapPin size={16} />
          {form.latitude ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)} (±${Math.round(form.accuracy)}m)` : 'বর্তমান GPS অবস্থান ব্যবহার করুন'}
        </button>
        <div>
          <input
            type="number"
            min={0}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="রোপণ এলাকার আয়তন (বর্গমিটার, ঐচ্ছিক)"
            value={form.areaSqMeters || ''}
            onChange={(e) => update('areaSqMeters', parseFloat(e.target.value) || undefined)}
          />
          <p className="text-[11px] text-gray-400 mt-1">দূরত্ব-ভিত্তিক পর্যালোচনার জন্য — রিপোর্টের সংখ্যা পরিবর্তন করে না</p>
        </div>
      </section>

      {/* Species — plant type + species cascade, both extensible */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">রোপণকৃত প্রজাতি</h3>
          <button onClick={addSeedling} className="flex items-center gap-1 text-emerald-600 text-sm">
            <Plus size={16} /> যোগ করুন
          </button>
        </div>
        <AnimatePresence>
          {form.seedlings.map((s) => {
            const speciesList = s.plantTypeId ? getSpeciesByPlantType(s.plantTypeId) : [];
            const spacing = form.areaSqMeters && s.plantTypeId ? checkSpacing(form.areaSqMeters, s.plantTypeId, s.count) : null;
            return (
              <motion.div key={s.id} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <select
                    className="flex-1 border rounded-lg px-2 py-2 text-sm"
                    value={s.plantTypeId ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        const name = prompt('নতুন গাছের ধরন লিখুন');
                        if (name) addNewPlantType(s.id, name);
                      } else {
                        setSeedlingPlantType(s.id, e.target.value);
                      }
                    }}
                  >
                    <option value="">ধরন নির্বাচন করুন</option>
                    {PLANT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.pending ? ' (পর্যালোচনাধীন)' : ''}</option>
                    ))}
                    <option value="__new__">+ নতুন ধরন যোগ করুন</option>
                  </select>
                  <button onClick={() => removeSeedling(s.id)} className="text-red-500 p-2">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <select
                    className="flex-1 border rounded-lg px-2 py-2 text-sm"
                    value={s.speciesId ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        const name = prompt('নতুন প্রজাতির নাম লিখুন');
                        if (name && s.plantTypeId) addNewSpecies(s.id, s.plantTypeId, name);
                      } else {
                        setSeedlingSpecies(s.id, e.target.value, speciesList);
                      }
                    }}
                    disabled={!s.plantTypeId}
                  >
                    <option value="">প্রজাতি নির্বাচন করুন</option>
                    {speciesList.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                    <option value="__new__">+ নতুন প্রজাতি যোগ করুন</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    className="w-20 border rounded-lg px-2 py-2 text-sm"
                    placeholder="সংখ্যা"
                    value={s.count || ''}
                    onChange={(e) => updateSeedling(s.id, { count: parseInt(e.target.value) || 0 })}
                  />
                </div>
                {spacing?.flagged && (
                  <p className="text-[11px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={12} /> আনুমানিক {spacing.expectedCount}টি (এলাকা ও দূরত্ব অনুসারে) — পর্যালোচনার জন্য চিহ্নিত, রিপোর্ট অপরিবর্তিত থাকবে
                  </p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {form.seedlings.length === 0 && <p className="text-xs text-gray-400 text-center py-2">কোনো প্রজাতি যোগ করা হয়নি</p>}
      </section>

      {/* Date */}
      <section className="bg-white rounded-xl p-4 shadow-sm">
        <label className="text-xs text-gray-500">রোপণের তারিখ</label>
        <input type="date" className="w-full border rounded-lg px-3 py-2 text-sm mt-1" value={form.plantationDate} onChange={(e) => update('plantationDate', e.target.value)} />
      </section>

      {/* Photo evidence */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">ছবি প্রমাণ (রোপণের সময়)</h3>
        <div className="flex flex-wrap gap-2">
          {form.photos.map((p) => (
            <div key={p.id} className="relative w-20 h-20">
              <img src={p.url} className="w-20 h-20 object-cover rounded-lg" alt="plantation evidence" />
              <button onClick={() => removePhoto(p.id)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5">
                <X size={12} />
              </button>
              {p.distanceFromOriginMeters !== undefined && p.distanceFromOriginMeters > CHECKPOINT_GEOFENCE_METERS && (
                <p className="text-[9px] text-amber-600 absolute -bottom-4 w-20 text-center">দূরত্ব বেশি</p>
              )}
            </div>
          ))}
          <label className="w-20 h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400 cursor-pointer">
            <Camera size={20} />
            <span className="text-[10px] mt-1">{photoBusy ? '...' : 'যোগ করুন'}</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={capturePhoto} disabled={photoBusy} />
          </label>
        </div>
        <p className="text-[11px] text-gray-400">প্রতিটি ছবি আপলোডের আগে সংকুচিত হয় (~80–150KB); ৬ মাস/১/২/৩ বছর পর ফলো-আপ ছবি যাচাইয়ের সুযোগ ভবিষ্যতে যুক্ত হবে</p>
      </section>

      {/* Caretaker — always manual */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">পরিচর্যাকারীর তথ্য</h3>
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="পরিচর্যাকারীর নাম" value={form.caretakerName} onChange={(e) => update('caretakerName', e.target.value)} />
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="মোবাইল নাম্বার" value={form.caretakerMobile} onChange={(e) => update('caretakerMobile', e.target.value)} />
      </section>

      {/* SAAO */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">সংশ্লিষ্ট SAAO</h3>
        {mode === 'dae_officer' && saaoDirectory.ready ? (
          <div className="relative">
            <div className="flex items-center border rounded-lg px-3 py-2">
              <Search size={14} className="text-gray-400 mr-2" />
              <input className="flex-1 text-sm outline-none" placeholder={form.saaoName || 'SAAO নাম বা মোবাইল দিয়ে খুঁজুন'} value={saaoDirectory.query} onChange={(e) => saaoDirectory.setQuery(e.target.value)} />
            </div>
            {saaoDirectory.results.length > 0 && (
              <div className="absolute z-10 w-full bg-white border rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                {saaoDirectory.results.map((s) => (
                  <button key={s.id} onClick={() => pickSaao(s.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex justify-between">
                    <span>{s.name}</span>
                    <span className="text-gray-400">{s.mobile}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="SAAO-র নাম" value={form.saaoName} onChange={(e) => update('saaoName', e.target.value)} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="SAAO-র মোবাইল" value={form.saaoMobile} onChange={(e) => update('saaoMobile', e.target.value)} />
          </>
        )}
      </section>

      {/* Monitoring Officer */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">মনিটরিং অফিসার</h3>
        {mode === 'dae_officer' && officerDirectory.ready && officerDirectory.candidates.length > 0 ? (
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={form.monitoringOfficerId ?? ''}
            onChange={(e) => {
              const officer = officerDirectory.candidates.find((o) => o.id === e.target.value);
              if (officer) {
                setForm((prev) => ({ ...prev, monitoringOfficerId: officer.id, monitoringOfficerName: officer.name, monitoringOfficerMobile: officer.mobile }));
              }
            }}
          >
            <option value="">নির্বাচন করুন</option>
            {officerDirectory.candidates.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.designation})</option>
            ))}
          </select>
        ) : (
          <>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="মনিটরিং অফিসারের নাম" value={form.monitoringOfficerName} onChange={(e) => update('monitoringOfficerName', e.target.value)} />
            <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="মনিটরিং অফিসারের মোবাইল" value={form.monitoringOfficerMobile} onChange={(e) => update('monitoringOfficerMobile', e.target.value)} />
            {mode === 'dae_officer' && !officerDirectory.ready && <p className="text-[11px] text-gray-400">অফিসার তালিকা এখনো লোড হয়নি — ম্যানুয়ালি লিখুন</p>}
          </>
        )}
      </section>

      {/* Seedling source — reference only, full nursery module deferred */}
      <section className="bg-white rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">চারার উৎস (ঐচ্ছিক)</h3>
        <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="নার্সারি/সরবরাহকারীর নাম" value={form.nurserySourceName ?? ''} onChange={(e) => update('nurserySourceName', e.target.value)} />
        <p className="text-[11px] text-gray-400">নার্সারি ম্যাপিং রেজিস্ট্রির সাথে সংযোগ ও মানচিত্র সংযুক্তি পরবর্তী ধাপে যুক্ত হবে</p>
      </section>

      {/* Remarks */}
      <section className="bg-white rounded-xl p-4 shadow-sm">
        <textarea className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="মন্তব্য (ঐচ্ছিক)" rows={2} value={form.remarks ?? ''} onChange={(e) => update('remarks', e.target.value)} />
      </section>

      <button
        onClick={handleSubmit}
        disabled={!form.village || !form.upazila || form.seedlings.length === 0}
        className="w-full bg-emerald-600 disabled:bg-gray-300 text-white font-medium rounded-xl py-3 text-sm"
      >
        সংরক্ষণ করুন
      </button>
    </div>
  );
}
