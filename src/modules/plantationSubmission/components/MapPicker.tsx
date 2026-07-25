import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2 } from 'lucide-react';
import { reverseGeocode, type ReverseGeocodeResult } from '../services/nominatim';

// Leaflet's default marker icon paths break under Vite bundling — same fix
// used in components/plantation/MapTab.tsx, kept consistent across the app.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapPickerProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  onReverseGeocode?: (result: ReverseGeocodeResult) => void;
  language?: 'bn' | 'en';
  heightClassName?: string;
}

const DEFAULT_CENTER: [number, number] = [25.7439, 89.6653]; // Kurigram district center, fallback when no point set yet

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Tap/click anywhere on the map, or drag the marker, to set the site's
 * location. Every placement triggers a debounced Nominatim reverse
 * geocode so SiteStep can autofill the administrative-hierarchy fields —
 * all of which remain editable afterward, this is a convenience prefill.
 */
export default function MapPicker({
  latitude,
  longitude,
  onChange,
  onReverseGeocode,
  language = 'bn',
  heightClassName = 'h-56',
}: MapPickerProps) {
  const [geocoding, setGeocoding] = useState(false);
  const hasPoint = latitude !== 0 || longitude !== 0;
  const center: [number, number] = hasPoint ? [latitude, longitude] : DEFAULT_CENTER;

  const runReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      if (!onReverseGeocode) return;
      setGeocoding(true);
      try {
        const result = await reverseGeocode(lat, lng);
        onReverseGeocode(result);
      } finally {
        setGeocoding(false);
      }
    },
    [onReverseGeocode]
  );

  const handlePick = useCallback(
    (lat: number, lng: number) => {
      onChange(lat, lng);
      runReverseGeocode(lat, lng);
    },
    [onChange, runReverseGeocode]
  );

  // Reverse-geocode once on initial mount if a point already exists
  // (e.g. loaded from a draft) but hasn't been geocoded yet.
  useEffect(() => {
    if (hasPoint) {
      runReverseGeocode(latitude, longitude);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`relative w-full ${heightClassName} rounded-xl overflow-hidden border border-gray-200`}>
      <MapContainer center={center} zoom={hasPoint ? 16 : 11} className="w-full h-full" scrollWheelZoom>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ClickHandler onPick={handlePick} />
        {hasPoint && (
          <Marker
            position={[latitude, longitude]}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const m = e.target as L.Marker;
                const pos = m.getLatLng();
                handlePick(pos.lat, pos.lng);
              },
            }}
          />
        )}
      </MapContainer>
      {geocoding && (
        <div className="absolute top-2 right-2 z-[1000] bg-white/95 rounded-full px-2.5 py-1 text-[10px] font-semibold text-gray-600 flex items-center gap-1 shadow">
          <Loader2 size={11} className="animate-spin" />
          {language === 'bn' ? 'ঠিকানা খোঁজা হচ্ছে...' : 'Looking up address...'}
        </div>
      )}
      {!hasPoint && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-black/5 pointer-events-none">
          <span className="bg-white/95 rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-600 shadow">
            {language === 'bn' ? 'ম্যাপে ট্যাপ করে অবস্থান নির্বাচন করুন' : 'Tap the map to set location'}
          </span>
        </div>
      )}
    </div>
  );
}
