import { Fence } from 'lucide-react';
import PolygonDrawer from '../components/PolygonDrawer';
import { deriveGeofenceMode } from '../hooks/useGeofenceMode';
import type { PlantationSite } from '../types/submission';
import type { LatLng } from '../services/geometry';

interface GeoFenceStepProps {
  site: PlantationSite;
  onChange: (updater: (prev: PlantationSite) => PlantationSite) => void;
  language?: 'bn' | 'en';
}

/**
 * Only reached when geofence mode is small_plantation or orchard —
 * the wizard shell skips straight past this step for single_tree sites
 * (nothing to configure beyond the point already captured in SiteStep).
 */
export default function GeoFenceStep({ site, onChange, language = 'bn' }: GeoFenceStepProps) {
  const totalQty = site.plants.reduce((sum, p) => sum + (p.quantity || 0), 0);
  const mode = deriveGeofenceMode(totalQty, site.geofence.areaSqMeters);

  const t = {
    title: language === 'bn' ? 'জিও-ফেন্স' : 'Geofence',
    smallDesc: language === 'bn'
      ? 'ছোট বাগানের জন্য একটি আওতা ব্যাসার্ধ (ঐচ্ছিক) নির্ধারণ করতে পারেন।'
      : 'For a small plantation, you may optionally set a coverage radius.',
    radius: language === 'bn' ? 'ব্যাসার্ধ (মিটার)' : 'Radius (meters)',
    orchardDesc: language === 'bn'
      ? `${totalQty}টি চারা — এটি একটি বাগান/বড় প্লট হিসেবে গণ্য হয়েছে। সীমানা আঁকা আবশ্যক।`
      : `${totalQty} plants — this qualifies as an orchard/large plot. A boundary polygon is required.`,
    area: language === 'bn' ? 'আয়তন' : 'Area',
    perimeter: language === 'bn' ? 'পরিধি' : 'Perimeter',
    polygonSet: language === 'bn' ? '✓ সীমানা নির্ধারিত হয়েছে' : '✓ Boundary set',
  };

  const setRadius = (radius: number | undefined) => {
    onChange((prev) => ({ ...prev, geofence: { ...prev.geofence, mode: 'small_plantation', radiusMeters: radius } }));
  };

  const handlePolygonComplete = (result: { polygon: LatLng[]; areaSqMeters: number; perimeterMeters: number; centroid: { latitude: number; longitude: number } }) => {
    onChange((prev) => ({
      ...prev,
      geofence: {
        ...prev.geofence,
        mode: 'orchard',
        polygon: result.polygon,
        areaSqMeters: result.areaSqMeters,
        perimeterMeters: result.perimeterMeters,
        centroid: result.centroid,
      },
    }));
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h3 className="font-bold text-gray-800 flex items-center gap-1.5">
        <Fence size={16} className="text-emerald-600" /> {t.title}
      </h3>

      {mode === 'small_plantation' && (
        <div className="bg-emerald-50 rounded-xl p-3 space-y-2">
          <p className="text-[11px] text-emerald-800">{t.smallDesc}</p>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block">{t.radius}</label>
            <input
              type="number"
              min={0}
              value={site.geofence.radiusMeters ?? ''}
              onChange={(e) => setRadius(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
              className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            />
          </div>
        </div>
      )}

      {mode === 'orchard' && (
        <div className="space-y-2">
          <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{t.orchardDesc}</p>
          <PolygonDrawer
            center={[site.location.latitude, site.location.longitude]}
            initialPolygon={site.geofence.polygon}
            onComplete={handlePolygonComplete}
            language={language}
          />
          {site.geofence.polygon && site.geofence.polygon.length >= 3 && (
            <div className="bg-emerald-50 rounded-lg px-3 py-2 text-[11px] text-emerald-700 font-semibold">
              {t.polygonSet} — {t.area}: {((site.geofence.areaSqMeters || 0) / 10000).toFixed(2)} ha ·{' '}
              {t.perimeter}: {Math.round(site.geofence.perimeterMeters || 0)}m
            </div>
          )}
        </div>
      )}
    </div>
  );
}
