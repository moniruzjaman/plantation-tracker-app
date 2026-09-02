import { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Undo2, Trash2, CheckCircle2 } from 'lucide-react';
import { polygonAreaSqMeters, polygonPerimeterMeters, polygonCentroid, type LatLng } from '../services/geometry';

interface PolygonDrawerProps {
  center: LatLng;
  initialPolygon?: LatLng[];
  onComplete: (result: { polygon: LatLng[]; areaSqMeters: number; perimeterMeters: number; centroid: { latitude: number; longitude: number } }) => void;
  language?: 'bn' | 'en';
}

function ClickToAddVertex({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Tap the map to place polygon vertices, one at a time. No leaflet-draw
 * dependency — a minimal custom tool built on react-leaflet's own click
 * events + Polygon/Polyline rendering, since orchard mode only needs
 * "place points, close the ring, compute area/perimeter/centroid," not
 * a full drawing toolkit (edit handles, multi-shape support, etc.).
 */
export default function PolygonDrawer({ center, initialPolygon, onComplete, language = 'bn' }: PolygonDrawerProps) {
  const [points, setPoints] = useState<LatLng[]>(initialPolygon || []);
  const [closed, setClosed] = useState(!!initialPolygon && initialPolygon.length >= 3);

  const t = {
    instructions: language === 'bn' ? 'জমির সীমানা বরাবর ট্যাপ করে পয়েন্ট যোগ করুন' : 'Tap along the plot boundary to add points',
    minPoints: language === 'bn' ? 'কমপক্ষে ৩টি পয়েন্ট প্রয়োজন' : 'At least 3 points required',
    undo: language === 'bn' ? 'শেষ পয়েন্ট মুছুন' : 'Undo last point',
    clear: language === 'bn' ? 'সব মুছুন' : 'Clear all',
    finish: language === 'bn' ? 'সীমানা সম্পন্ন করুন' : 'Finish Boundary',
    area: language === 'bn' ? 'আয়তন' : 'Area',
    perimeter: language === 'bn' ? 'পরিধি' : 'Perimeter',
    edit: language === 'bn' ? 'সম্পাদনা করুন' : 'Edit',
    points: language === 'bn' ? 'পয়েন্ট' : 'points',
    hectares: language === 'bn' ? 'হেক্টর' : 'ha',
  };

  const addVertex = (lat: number, lng: number) => {
    if (closed) return;
    setPoints((prev) => [...prev, [lat, lng]]);
  };

  const undoLast = () => setPoints((prev) => prev.slice(0, -1));
  const clearAll = () => {
    setPoints([]);
    setClosed(false);
  };

  const finish = () => {
    if (points.length < 3) return;
    setClosed(true);
    const areaSqMeters = polygonAreaSqMeters(points);
    const perimeterMeters = polygonPerimeterMeters(points);
    const centroid = polygonCentroid(points);
    onComplete({ polygon: points, areaSqMeters, perimeterMeters, centroid });
  };

  const area = points.length >= 3 ? polygonAreaSqMeters(points) : 0;
  const perimeter = points.length >= 2 ? polygonPerimeterMeters(points) : 0;

  return (
    <div className="space-y-2">
      <div className="relative w-full h-64 rounded-xl overflow-hidden border border-gray-200">
        <MapContainer center={center} zoom={17} className="w-full h-full" scrollWheelZoom>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <ClickToAddVertex onAdd={addVertex} />
          {points.map((p, i) => (
            <CircleMarker key={i} center={p} radius={4} pathOptions={{ color: '#059669', fillColor: '#059669', fillOpacity: 1 }} />
          ))}
          {points.length >= 3 ? (
            <Polygon positions={points} pathOptions={{ color: '#059669', fillColor: '#059669', fillOpacity: 0.25, weight: 2 }} />
          ) : points.length >= 2 ? (
            <Polyline positions={points} pathOptions={{ color: '#059669', weight: 2 }} />
          ) : null}
        </MapContainer>
        {!closed && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 rounded-full px-3 py-1 text-[10px] font-medium text-gray-600 shadow whitespace-nowrap">
            {t.instructions}
          </div>
        )}
      </div>

      {points.length > 0 && (
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>{points.length} {t.points}</span>
          {points.length >= 3 && (
            <span>
              {t.area}: {area >= 10000 ? `${(area / 10000).toFixed(2)} ${t.hectares}` : `${Math.round(area)} m²`} · {t.perimeter}: {Math.round(perimeter)}m
            </span>
          )}
        </div>
      )}

      <div className="flex gap-1.5">
        {!closed ? (
          <>
            <button
              type="button"
              onClick={undoLast}
              disabled={points.length === 0}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-gray-50 text-gray-600 text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
            >
              <Undo2 size={12} /> {t.undo}
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={points.length === 0}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-red-50 text-red-600 text-[11px] font-semibold disabled:opacity-40 cursor-pointer"
            >
              <Trash2 size={12} /> {t.clear}
            </button>
            <button
              type="button"
              onClick={finish}
              disabled={points.length < 3}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-emerald-700 text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer"
            >
              <CheckCircle2 size={12} /> {t.finish}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setClosed(false)}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-[11px] font-semibold cursor-pointer"
          >
            {t.edit}
          </button>
        )}
      </div>
      {points.length > 0 && points.length < 3 && <p className="text-[10px] text-amber-600">{t.minPoints}</p>}
    </div>
  );
}
