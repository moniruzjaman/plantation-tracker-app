import { useCallback, useEffect, useState } from 'react';
import { MapPin, Leaf, Cloud, Info, Loader2 } from 'lucide-react';
import GPSCapture from '../components/GPSCapture';
import MapPicker from '../components/MapPicker';
import { getNdviForPoint } from '../services/ndvi';
import { getCarbonEstimateForPlants } from '../services/carbon';
import { deriveGeofenceMode } from '../hooks/useGeofenceMode';
import type { PlantationSite } from '../types/submission';
import { toBnNum } from '../../../utils/mapHelper';

interface SiteStepProps {
  site: PlantationSite;
  onChange: (updater: (prev: PlantationSite) => PlantationSite) => void;
  language?: 'bn' | 'en';
}

const FIELD_ORDER: { key: keyof PlantationSite['location']; label: { bn: string; en: string } }[] = [
  { key: 'division', label: { bn: 'à¦¬à¦¿à¦­à¦¾à¦—', en: 'Division' } },
  { key: 'district', label: { bn: 'à¦œà§‡à¦²à¦¾', en: 'District' } },
  { key: 'upazila', label: { bn: 'à¦‰à¦ªà¦œà§‡à¦²à¦¾', en: 'Upazila' } },
  { key: 'union', label: { bn: 'à¦‡à¦‰à¦¨à¦¿à¦¯à¦¼à¦¨', en: 'Union' } },
  { key: 'villageOrRoad', label: { bn: 'à¦—à§à¦°à¦¾à¦®/à¦°à¦¾à¦¸à§à¦¤à¦¾', en: 'Village/Road' } },
  { key: 'postalCode', label: { bn: 'à¦ªà§‹à¦¸à§à¦Ÿ à¦•à§‹à¦¡', en: 'Postal Code' } },
  { key: 'fullAddress', label: { bn: 'à¦¸à¦®à§à¦ªà§‚à¦°à§à¦£ à¦ à¦¿à¦•à¦¾à¦¨à¦¾', en: 'Full Address' } },
];

export default function SiteStep({ site, onChange, language = 'bn' }: SiteStepProps) {
  const t = {
    title: language === 'bn' ? 'à¦¸à§à¦¥à¦¾à¦¨à§‡à¦° à¦¤à¦¥à§à¦¯' : 'Plantation Site Information',
    gpsSection: language === 'bn' ? 'à¦…à¦¬à¦¸à§à¦¥à¦¾à¦¨ à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦£' : 'Location',
    addressSection: language === 'bn' ? 'à¦ à¦¿à¦•à¦¾à¦¨à¦¾ (à¦¸à§à¦¬à¦¯à¦¼à¦‚à¦•à§à¦°à¦¿à¦¯à¦¼ â€” à¦¸à¦®à§à¦ªà¦¾à¦¦à¦¨à¦¾à¦¯à§‹à¦—à§à¦¯)' : 'Address (auto-filled â€” editable)',
    geofenceSection: language === 'bn' ? 'à¦œà¦¿à¦“-à¦«à§‡à¦¨à§à¦¸ à¦®à§‹à¦¡' : 'Geofence Mode',
    envSection: language === 'bn' ? 'à¦ªà¦°à¦¿à¦¬à§‡à¦¶à¦—à¦¤ à¦¤à¦¥à§à¦¯' : 'Environmental Intelligence',
    manualHint: language === 'bn' ? 'à¦¸à§à¦¬à¦¯à¦¼à¦‚à¦•à§à¦°à¦¿à¦¯à¦¼à¦­à¦¾à¦¬à§‡ à¦¸à§‡à¦Ÿ à¦•à¦°à¦¾ à¦¹à¦¯à¦¼à§‡à¦›à§‡ â€” à¦¦à¦°à¦•à¦¾à¦° à¦¹à¦²à§‡ à¦®à¦¾à¦°à§à¦•à¦¾à¦° à¦Ÿà¦¾à¦¨ à¦•à¦°à§‡ à¦¬à¦¾ à¦®à¦¾à¦¨à¦šà¦¿à¦¤à§à¦°à§‡ à¦Ÿà§à¦¯à¦¾à¦ª à¦•à¦°à§‡ à¦¸à¦¾à¦®à¦¾à¦¨à§à¦¯ à¦•à¦°à§à¦¨' : 'Set automatically â€” adjust by dragging the marker or tapping the map if needed',
    modeUnset: language === 'bn'
      ? 'à¦šà¦¾à¦°à¦¾à¦° à¦¸à¦‚à¦–à§à¦¯à¦¾ à¦¯à§‹à¦— à¦•à¦°à¦¾à¦° à¦ªà¦° à¦®à§‹à¦¡ à¦¨à¦¿à¦°à§à¦§à¦¾à¦°à¦¿à¦¤ à¦¹à¦¬à§‡'
      : 'Mode will be finalized once plant quantities are added',
    ndvi: language === 'bn' ? 'NDVI' : 'NDVI',
    carbon: language === 'bn' ? 'à¦•à¦¾à¦°à§à¦¬à¦¨ à¦ªà§à¦°à¦¾à¦•à§à¦•à¦²à¦¨' : 'Carbon Estimate',
    loading: language === 'bn' ? 'à¦²à§‹à¦¡ à¦¹à¦šà§à¦›à§‡...' : 'Loading...',
    noPointYet: language === 'bn' ? 'à¦ªà§à¦°à¦¥à¦®à§‡ à¦à¦•à¦Ÿà¦¿ à¦…à¦¬à¦¸à§à¦¥à¦¾à¦¨ à¦¨à¦¿à¦°à§à¦¬à¦¾à¦šà¦¨ à¦•à¦°à§à¦¨' : 'Set a location first',
    autoLocating: language === 'bn' ? 'à¦¸à§à¦¬à¦¯à¦¼à¦‚à¦•à§à¦°à¦¿à¦¯à¦¼à¦­à¦¾à¦¬à§‡ à¦…à¦¬à¦¸à§à¦¥à¦¾à¦¨ à¦–à§à¦à¦œà§‡ à¦ªà¦¾à¦“à¦¯à¦¼à¦¾ à¦¹à¦šà§à¦›à§‡...' : 'Locating automatically...',
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
        upazila: result.upazila || prev.upazila,
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
        setLocation((prev) => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, manuallyAdjusted: false }));
        setGeofencePoint(pos.coords.latitude, pos.coords.longitude);
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

  const geofenceMode = deriveGeofenceMode(
    site.plants.reduce((sum, p) => sum + (p.quantity || 0), 0),
    site.geofence.areaSqMeters
  );

  const modeLabel: Record<string, { bn: string; en: string }> = {
    single_tree: { bn: 'ðŸŒ³ à¦à¦•à¦• à¦—à¦¾à¦›', en: 'ðŸŒ³ Single Tree' },
    small_plantation: { bn: 'ðŸŒ± à¦›à§‹à¦Ÿ à¦¬à¦¾à¦—à¦¾à¦¨', en: 'ðŸŒ± Small Plantation' },
    orchard: { bn: 'ðŸžï¸ à¦¬à¦¾à¦—à¦¾à¦¨/à¦¬à¦¡à¦¼ à¦ªà§à¦²à¦Ÿ (à¦ªà¦²à¦¿à¦—à¦¨ à¦ªà§à¦°à¦¯à¦¼à§‹à¦œà¦¨)', en: 'ðŸžï¸ Orchard/Large Plot (polygon required)' },
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
          <>
            <GPSCapture onCapture={handleGpsCapture} language={language} />
            {/* Manual GPS Input */}
            <div className="space-y-2 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400 mb-0.5 block">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={site.location.latitude}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        setLocation((prev) => ({ 
                          ...prev, 
                          latitude: value, 
                          manuallyAdjusted: true 
                        }));
                        setGeofencePoint(value, site.location.longitude);
                      }
                    }}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 mb-0.5 block">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={site.location.longitude}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        setLocation((prev) => ({ 
                          ...prev, 
                          longitude: value, 
                          manuallyAdjusted: true 
                        }));
                        setGeofencePoint(site.location.latitude, value);
                      }
                    }}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              {/* Token points indicator for GPS interaction */}
              <div className="flex items-center gap-1 text-[9px] text-green-500">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full" title="Earned for GPS interaction"></div>
                  <span>+10 pts for GPS interaction</span>
                </div>
              </div>
            </>
          )}
        <p className="text-[10px] text-gray-400 text-center">{t.manualHint}</p>
        <MapPicker
          latitude={site.location.latitude}
          longitude={site.location.longitude}
          onChange={handleMapPick}
          onReverseGeocode={handleReverseGeocode}
          language={language}
        />
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
                className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Geofence mode indicator */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
        <label className="text-xs font-semibold text-emerald-700 flex items-center gap-1 mb-1">
          <Info size={12} /> {t.geofenceSection}
        </label>
        <p className="text-sm font-bold text-emerald-900">{modeLabel[geofenceMode][language]}</p>
        {site.plants.length === 0 && <p className="text-[10px] text-emerald-600 mt-0.5">{t.modeUnset}</p>}
      </div>

      {/* Environmental intelligence â€” read-only */}
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
            <p className="text-[11px] text-gray-400">â€”</p>
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
            <p className="text-[11px] text-gray-400">â€”</p>
          )}
        </div>
      </div>
    </div>
  );
}

