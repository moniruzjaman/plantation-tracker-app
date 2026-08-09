import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Leaf, Cloud, Info, Loader2, AlertTriangle } from 'lucide-react';
import GPSCapture from '../components/GPSCapture';
import MapPicker from '../components/MapPicker';
import { getNdviForPoint } from '../services/ndvi';
import { getCarbonEstimateForPlants } from '../services/carbon';
import { resolveGeofenceMode } from '../hooks/useGeofenceMode';
import type { PlantationSite } from '../types/submission';
import { toBnNum } from '../../../utils/mapHelper';
import { roundCoord, formatCoord } from '../utils/coords';
import { isWithinBangladesh } from '../../../data/kurigramUpazilaBounds';
import { findContainingUpazila, isWithinUpazilaPolygon } from '../../../data/kurigramUpazilaPolygons';
import { canonicalizeUpazila } from '../../../utils/canonicalizeUpazila';

interface SiteStepProps {
  site: PlantationSite;
  onChange: (updater: (prev: PlantationSite) => PlantationSite) => void;
  language?: 'bn' | 'en';
}

const FIELD_ORDER: { key: keyof PlantationSite['location']; label: { bn: string; en: string } }[] = [
  { key: 'division', label: { bn: 'বিভাগ', en: 'Division' } },
  { key: 'district', label: { bn: 'জেলা', en: 'District' } },
  { key: 'upazila', label: { bn: 'উপজেলা', en: 'Upazila' } },
  { key: 'union', label: { bn: 'ইউনিয়ন', en: 'Union' } },
  { key: 'villageOrRoad', label: { bn: 'গ্রাম/রাস্তা', en: 'Village/Road' } },
  { key: 'postalCode', label: { bn: 'পোস্ট কোড', en: 'Postal Code' } },
  { key: 'fullAddress', label: { bn: 'সম্পূর্ণ ঠিকানা', en: 'Full Address' } },
];

export default function SiteStep({ site, onChange, language = 'bn' }: SiteStepProps) {
  const t = {
    title: language === 'bn' ? 'স্থানের তথ্য' : 'Plantation Site Information',
    gpsSection: language === 'bn' ? 'অবস্থান নির্ধারণ' : 'Location',
    addressSection: language === 'bn' ? 'ঠিকানা (স্বয়ংক্রিয় — সম্পাদনাযোগ্য)' : 'Address (auto-filled — editable)',
    geofenceSection: language === 'bn' ? 'জিও-ফেন্স মোড' : 'Geofence Mode',
    envSection: language === 'bn' ? 'পরিবেশগত তথ্য' : 'Environmental Intelligence',
    manualHint: language === 'bn' ? 'স্বয়ংক্রিয়ভাবে সেট করা হয়েছে — দরকার হলে মার্কার টান করে বা মানচিত্রে ট্যাপ করে সামান্য করুন' : 'Set automatically — adjust by dragging the marker or tapping the map if needed',
    modeUnset: language === 'bn'
      ? 'চারার সংখ্যা যোগ করার পর মোড নির্ধারিত হবে'
      : 'Mode will be finalized once plant quantities are added',
    ndvi: language === 'bn' ? 'NDVI' : 'NDVI',
    carbon: language === 'bn' ? 'কার্বন প্রাক্কলন' : 'Carbon Estimate',
    loading: language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...',
    noPointYet: language === 'bn' ? 'প্রথমে একটি অবস্থান নির্বাচন করুন' : 'Set a location first',
    autoLocating: language === 'bn' ? 'স্বয়ংক্রিয়ভাবে অবস্থান খুঁজে পাওয়া হচ্ছে...' : 'Locating automatically...',
    capturedCoords: language === 'bn' ? 'ধারণকৃত GPS কো-অর্ডিনেট (৭ দশমিক ঘর নির্ভুলতা)' : 'Captured GPS coordinates (7-decimal precision)',
    lat: language === 'bn' ? 'অক্ষাংশ' : 'Latitude',
    lng: language === 'bn' ? 'দ্রাঘিমাংশ' : 'Longitude',
  };
  const [autoLocating, setAutoLocating] = useState(false);

  const setLocation = useCallback(
    (updater: (prev: PlantationSite['location']) => PlantationSite['location']) => {
      onChange((prev) => ({ ...prev, location: updater(prev.location) }));
    },
    [onChange]
  );

  const setGeofencePoint = useCallback(
    (lat: number, lng: number) => {
      onChange((prev) => ({
        ...prev,
        geofence: { ...prev.geofence, latitude: lat, longitude: lng },
        location: { ...prev.location, latitude: lat, longitude: lng },
      }));
    },
    [onChange]
  );

  const handleGpsCapture = useCallback(
    (lat: number, lng: number, accuracy: number) => {
      setLocation((prev) => ({ ...prev, latitude: lat, longitude: lng, accuracy, manuallyAdjusted: false }));
      setGeofencePoint(lat, lng);
    },
    [setLocation, setGeofencePoint]
  );

  const handleMapPick = useCallback(
    (lat: number, lng: number) => {
      setLocation((prev) => ({ ...prev, latitude: lat, longitude: lng, manuallyAdjusted: true }));
      setGeofencePoint(lat, lng);
    },
    [setLocation, setGeofencePoint]
  );

  const handleReverseGeocode = useCallback(
    (result: { division: string; district: string; upazila: string; union: string; villageOrRoad: string; postalCode: string; fullAddress: string }) => {
      setLocation((prev) => ({
        ...prev,
        division: result.division || prev.division,
        district: result.district || prev.district,
        // Reconciled against our own canonical spelling here, at the
        // single point every submission's upazila value originates from
        // (Nominatim's raw OSM text otherwise flows straight into
        // storage) -- see canonicalizeUpazila.ts for why this matters:
        // an uncanonicalized value silently fails every downstream
        // exact-match comparison (map filter pills, marker color,
        // geofence checks) even though it's obviously the same real
        // upazila to a person reading it.
        upazila: result.upazila ? canonicalizeUpazila(result.upazila) : prev.upazila,
        union: result.union || prev.union,
        villageOrRoad: result.villageOrRoad || prev.villageOrRoad,
        postalCode: result.postalCode || prev.postalCode,
        fullAddress: result.fullAddress || prev.fullAddress,
      }));
    },
    [setLocation]
  );

  // ---- Environmental intelligence: fetch once a point exists, refetch on move ----
  const hasPoint = site.location.latitude !== 0 || site.location.longitude !== 0;

  useEffect(() => {
    if (!hasPoint) return;
    let cancelled = false;

    onChange((prev) => ({ ...prev, environmental: { ...prev.environmental, ndviLoading: true, ndviError: undefined } }));
    getNdviForPoint(site.location.latitude, site.location.longitude)
      .then((r) => {
        if (cancelled) return;
        onChange((prev) => ({ ...prev, environmental: { ...prev.environmental, ndvi: r.ndvi, ndviLoading: false } }));
      })
      .catch((err) => {
        if (cancelled) return;
        onChange((prev) => ({
          ...prev,
          environmental: { ...prev.environmental, ndviLoading: false, ndviError: err?.message || 'failed' },
        }));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.location.latitude, site.location.longitude, hasPoint]);

  useEffect(() => {
    onChange((prev) => ({ ...prev, environmental: { ...prev.environmental, carbonLoading: true, carbonError: undefined } }));
    try {
      const r = getCarbonEstimateForPlants(site.plants);
      onChange((prev) => ({ ...prev, environmental: { ...prev.environmental, carbonEstimateTons: r.estimatedTons, carbonLoading: false } }));
    } catch (err: any) {
      onChange((prev) => ({ ...prev, environmental: { ...prev.environmental, carbonLoading: false, carbonError: err?.message || 'failed' } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.plants]);

  // Auto-get GPS on mount if no location is set
  useEffect(() => {
    const hasPoint = site.location.latitude !== 0 || site.location.longitude !== 0;
    if (hasPoint) return;

    setAutoLocating(true);
    if (!navigator.geolocation) {
      setAutoLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = roundCoord(pos.coords.latitude);
        const lng = roundCoord(pos.coords.longitude);
        setLocation((prev) => ({ ...prev, latitude: lat, longitude: lng, accuracy: pos.coords.accuracy, manuallyAdjusted: false }));
        setGeofencePoint(lat, lng);
        setAutoLocating(false);
      },
      (err) => {
        setAutoLocating(false);
        // Optionally show an error, but we'll just leave it to the user to try manually
        console.warn('Geolocation failed:', err);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [site.location.latitude, site.location.longitude, setLocation, setGeofencePoint]);

  // Live jurisdiction check — runs on every location change (GPS capture,
  // map tap/drag, or manual upazila edit), so the officer sees a mismatch
  // immediately on the form instead of only in the backend review score.
  const jurisdictionWarning = useMemo(() => {
    const { latitude: lat, longitude: lng, upazila } = site.location;
    if (lat === 0 && lng === 0) return null;

    if (!isWithinBangladesh(lat, lng)) {
      return language === 'bn'
        ? 'GPS অবস্থান বাংলাদেশের সীমানার বাইরে দেখাচ্ছে। অবস্থান পুনরায় যাচাই করুন।'
        : 'GPS location appears to be outside Bangladesh. Please re-check the location.';
    }
    if (!upazila) return null; // nothing declared yet to compare against

    if (!isWithinUpazilaPolygon(lat, lng, upazila)) {
      const actual = findContainingUpazila(lat, lng);
      if (language === 'bn') {
        return actual
          ? `GPS অবস্থান "${actual}" উপজেলায় আছে বলে মনে হচ্ছে, কিন্তু ঠিকানায় "${upazila}" দেওয়া আছে। মিলিয়ে দেখুন।`
          : `GPS location doesn't match "${upazila}". Please verify the address fields.`;
      }
      return actual
        ? `GPS location appears to be in "${actual}" upazila, but the address says "${upazila}". Please double-check.`
        : `GPS location falls outside "${upazila}"'s boundary. Please verify.`;
    }
    return null;
  }, [site.location.latitude, site.location.longitude, site.location.upazila, language]);

  const geofenceMode = resolveGeofenceMode(site);

  const modeLabel: Record<string, { bn: string; en: string }> = {
    single_tree: { bn: '🌳 একক গাছ', en: '🌳 Single Tree' },
    small_plantation: { bn: '🌱 ছোট বাগান', en: '🌱 Small Plantation' },
    orchard: { bn: '🏞️ বাগান/বড় প্লট (পলিগন প্রয়োজন)', en: '🏞️ Orchard/Large Plot (polygon required)' },
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      <h3 className="font-bold text-gray-800 flex items-center gap-1.5">
        <MapPin size={16} className="text-emerald-600" /> {t.title}
      </h3>

      {/* GPS + Map */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500">{t.gpsSection}</label>
        {autoLocating ? (
          <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-700 text-white font-semibold text-sm">
            <Loader2 size={16} className="animate-spin" /> {t.autoLocating}
          </div>
        ) : (
          <GPSCapture onCapture={handleGpsCapture} language={language} />
        )}
        <p className="text-[10px] text-gray-400 text-center">{t.manualHint}</p>
        <MapPicker
          latitude={site.location.latitude}
          longitude={site.location.longitude}
          onChange={handleMapPick}
          onReverseGeocode={handleReverseGeocode}
          language={language}
        />
        {hasPoint && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2">
            <p className="text-[9px] font-semibold text-gray-400 mb-1">{t.capturedCoords}</p>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-gray-700">
              <span>{t.lat}: {formatCoord(site.location.latitude)}</span>
              <span>{t.lng}: {formatCoord(site.location.longitude)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Reverse-geocoded address fields, all editable */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500">{t.addressSection}</label>
        <div className="grid grid-cols-2 gap-2">
          {FIELD_ORDER.map(({ key, label }) => (
            <div key={key} className={key === 'fullAddress' ? 'col-span-2' : ''}>
              <label className="text-[10px] text-gray-400 mb-0.5 block">{label[language]}</label>
              <input
                type="text"
                value={site.location[key] as string}
                onChange={(e) => setLocation((prev) => ({ ...prev, [key]: e.target.value }))}
                onBlur={key === 'upazila' ? (e) => setLocation((prev) => ({ ...prev, upazila: canonicalizeUpazila(e.target.value) })) : undefined}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ))}
        </div>
        {jurisdictionWarning && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-snug">{jurisdictionWarning}</p>
          </div>
        )}
      </div>

      {/* Geofence mode indicator */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
        <label className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mb-1">
          <Info size={12} /> {t.geofenceSection}
        </label>
        <p className="text-sm font-bold text-emerald-900">{modeLabel[geofenceMode][language]}</p>
        {site.plants.length === 0 && <p className="text-[10px] text-emerald-600 mt-0.5">{t.modeUnset}</p>}
      </div>

      {/* Environmental intelligence — read-only */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-xl p-3">
          <label className="text-[10px] font-semibold text-gray-500 flex items-center gap-1 mb-1">
            <Leaf size={11} /> {t.ndvi}
          </label>
          {!hasPoint ? (
            <p className="text-[11px] text-gray-400">{t.noPointYet}</p>
          ) : site.environmental.ndviLoading ? (
            <p className="text-[11px] text-gray-400">{t.loading}</p>
          ) : site.environmental.ndvi !== null ? (
            <p className="text-lg font-black text-emerald-700">{site.environmental.ndvi.toFixed(2)}</p>
          ) : (
            <p className="text-[11px] text-gray-400">—</p>
          )}
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <label className="text-[10px] font-semibold text-gray-500 flex items-center gap-1 mb-1">
            <Cloud size={11} /> {t.carbon}
          </label>
          {site.environmental.carbonLoading ? (
            <p className="text-[11px] text-gray-400">{t.loading}</p>
          ) : site.environmental.carbonEstimateTons !== null ? (
            <p className="text-lg font-black text-emerald-700">
              {toBnNum(Math.round(site.environmental.carbonEstimateTons * 100) / 100)} <span className="text-xs font-normal">t</span>
            </p>
          ) : (
            <p className="text-[11px] text-gray-400">—</p>
          )}
        </div>
      </div>
    </div>
  );
}
