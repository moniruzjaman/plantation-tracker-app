import React, { useState, useCallback, useEffect, useRef, type JSX } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngBounds, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Cloud, RefreshCw, CheckCircle2, AlertTriangle, BarChart3, Plus, Minus, Crosshair, Loader2 } from 'lucide-react';
import type { GeoState } from '../GeolocationIndicator';
import {
  type LayerId,
  getLayerTiles,
  NDVI_BANDS,
} from '../../utils/mapHelper';

// ---------- Fix #2: Leaflet default marker icon paths break with Vite bundling ----------
// Must run before any MapContainer renders.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ---------- Layer labels (Bengali) ----------

const LAYER_LABELS: Record<LayerId, string> = {
  ndvi: '\uD83C\uDF3F NDVI',
  evi: '\uD83C\uDF43 EVI',
  satellite: '\uD83D\uDEF0\uFE0F \u09B8\u09CD\u09AF\u09BE\u099F\u09C7\u09B2\u09BE\u0987\u099F',
  osm: '\uD83D\uDDFA\uFE0F \u09AE\u09BE\u09A8\u099A\u09BF\u09A4\u09CD\u09B0',
};

// ---------- Pipeline result ----------

interface PipelineResult {
  ndvi_mean: number;
  evi_mean?: number;
  healthy_pct: number;
  stress_pct: number;
  bare_pct: number;
  area_ha: number;
  source?: string;
  ai_analysis?: string;
}

type PipelineState = 'idle' | 'running' | 'success' | 'error';

// ---------- Sub-components ----------

function LayerSwitcher({ active, onChange }: { active: LayerId; onChange: (l: LayerId) => void }) {
  return (
    <div className="absolute top-3 left-3 z-[1000] flex gap-1.5 bg-white/95 backdrop-blur rounded-full p-1 shadow-lg">
      {(Object.keys(LAYER_LABELS) as LayerId[]).map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
            active === id ? 'bg-emerald-700 text-white border border-emerald-800' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          {LAYER_LABELS[id]}
        </button>
      ))}
    </div>
  );
}

function CloudPipelineButton({ state, onRun }: { state: PipelineState; onRun: () => void }) {
  const config: Record<PipelineState, { icon: JSX.Element; ring: string; bg: string }> = {
    idle: { icon: <Cloud size={18} />, ring: '', bg: 'bg-slate-600' },
    running: { icon: <RefreshCw size={18} className="animate-spin" />, ring: 'ring-4 ring-amber-300/60 animate-pulse', bg: 'bg-amber-500' },
    success: { icon: <CheckCircle2 size={18} />, ring: '', bg: 'bg-emerald-600' },
    error: { icon: <AlertTriangle size={18} />, ring: '', bg: 'bg-red-500' },
  };
  const c = config[state];
  return (
    <button
      onClick={onRun}
      disabled={state === 'running'}
      className={`w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg transition-all ${c.bg} ${c.ring}`}
      title="\u09B8\u09CD\u09AF\u09BE\u099F\u09C7\u09B2\u09BE\u0987\u099F \u09AC\u09BF\u09B6\u09CD\u09B2\u09C7\u09B7\u09A3 \u099A\u09BE\u09B2\u09BE\u09A8"
    >
      {c.icon}
    </button>
  );
}

/**
 * Fix #16: Color-coding for result metrics.
 * Thresholds: healthy_pct >= 60 good, >= 35 warn, < 35 bad.
 * stress_pct <= 15 good, <= 30 warn, > 30 bad.
 */
function ResultOverlay({ result, onClose }: { result: PipelineResult; onClose: () => void }) {
  const isDemo = !result.source || result.source === 'demo_estimate';
  const colorFor = (v: number, goodHigh = true) => {
    const good = goodHigh ? v >= 60 : v <= 15;
    const warn = goodHigh ? v >= 35 : v <= 30;
    return good ? 'text-emerald-600' : warn ? 'text-amber-600' : 'text-red-600';
  };
  return (
    <div className="absolute top-3 right-3 z-[1000] w-56 bg-white/95 backdrop-blur rounded-xl shadow-xl p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-gray-700">বিশ্লেষণ ফলাফল</h4>
        <button onClick={onClose} className="text-gray-400 text-xs">✕</button>
      </div>
      {isDemo && (
        <p className="text-[10px] bg-amber-50 text-amber-700 rounded px-1.5 py-1">
          ⚠️ ডেমো ডেটা — প্রকৃত স্যাটেলাইট বিশ্লেষণ নয়, GEE পাইপলাইন সংযুক্ত হলে বাস্তব মান দেখাবে
        </p>
      )}
      <div className="text-xs space-y-1">
        <div className="flex justify-between"><span className="text-gray-500">গড় NDVI</span><span className="font-semibold">{result.ndvi_mean.toFixed(2)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">সুস্থ%</span><span className={`font-semibold ${colorFor(result.healthy_pct, true)}`}>{result.healthy_pct}%</span></div>
        <div className="flex justify-between"><span className="text-gray-500">চাপগ্রস্ত%</span><span className={`font-semibold ${colorFor(result.stress_pct, false)}`}>{result.stress_pct}%</span></div>
        <div className="flex justify-between"><span className="text-gray-500">নগ্ন%</span><span className="font-semibold text-gray-700">{result.bare_pct}%</span></div>
        <div className="flex justify-between"><span className="text-gray-500">মোট হেক্টর</span><span className="font-semibold">{result.area_ha} ha</span></div>
      </div>
      {result.ai_analysis && <p className="text-[10px] text-gray-500 border-t pt-1.5 leading-relaxed">{result.ai_analysis}</p>}
    </div>
  );
}

function NDVILegend({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState(true);
  if (!visible) return null;
  return (
    <div className="absolute bottom-14 left-3 z-[1000]">
      {open ? (
        <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg p-2.5 w-40">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-gray-600">NDVI মান</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 text-[10px]">✕</button>
          </div>
          {NDVI_BANDS.map((b) => (
            <div key={b.label} className="flex items-center gap-1.5 text-[10px] py-0.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: b.color }} />
              <span className="text-gray-600 flex-1">{b.label}</span>
              <span className="text-gray-400">{b.range}</span>
            </div>
          ))}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-9 h-9 bg-white/95 rounded-full shadow-lg flex items-center justify-center">
          <BarChart3 size={16} className="text-gray-600" />
        </button>
      )}
    </div>
  );
}

/** Tracks the current map bounds for the pipeline request body. */
function BoundsTracker({ onBoundsChange }: { onBoundsChange: (b: LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
  });
  return null;
}

/** Fix #10: Custom zoom +/- buttons for mobile-friendly precise control. */
function CustomZoomControl({ mapRef }: { mapRef: React.RefObject<LeafletMap | null> }) {
  return (
    <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
      <button
        onClick={() => mapRef.current?.zoomIn()}
        className="w-9 h-9 bg-white/95 backdrop-blur rounded-lg shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-100 transition active:scale-95"
        title="জুম ইন"
      >
        <Plus size={18} />
      </button>
      <button
        onClick={() => mapRef.current?.zoomOut()}
        className="w-9 h-9 bg-white/95 backdrop-blur rounded-lg shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-100 transition active:scale-95"
        title="জুম আউট"
      >
        <Minus size={18} />
      </button>
    </div>
  );
}

/** Fix #13: Dashed rectangle showing the area that will be analyzed by the pipeline. */
function BoundsOverlay({ bounds }: { bounds: LatLngBounds | null }) {
  if (!bounds) return null;
  const positions: [number, number][] = [
    [bounds.getSouth(), bounds.getWest()],
    [bounds.getNorth(), bounds.getWest()],
    [bounds.getNorth(), bounds.getEast()],
    [bounds.getSouth(), bounds.getEast()],
    [bounds.getSouth(), bounds.getWest()],
  ];
  return (
    <div className="absolute inset-0 pointer-events-none z-[999] flex items-center justify-center">
      <div className="text-[10px] text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-medium">
        <Crosshair size={10} className="inline -mt-0.5 mr-1" />
        বিশ্লেষণ এলাকা
      </div>
    </div>
  );
}

/** Fix #11/#12: Tile loading indicator + error toast. */
function TileStatusIndicator({ loading, error }: { loading: boolean; error: boolean }) {
  if (!loading && !error) return null;
  return (
    <div className="absolute bottom-14 right-3 z-[1000]">
      {loading && (
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur rounded-full shadow-lg px-3 py-1.5 text-[10px] text-gray-600">
          <Loader2 size={12} className="animate-spin" />
          টাইল লোড হচ্ছে...
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1.5 bg-red-50/95 backdrop-blur rounded-full shadow-lg px-3 py-1.5 text-[10px] text-red-700">
          <AlertTriangle size={12} />
          টাইল লোড ব্যর্থ — ইন্টারনেট সংযোগ পরীক্ষা করুন
        </div>
      )}
    </div>
  );
}

/** Hook: listens for tile load events on the map to show loading/error state. */
function useTileStatus(mapRef: React.RefObject<LeafletMap | null>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onLoading = () => {
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
      setError(false);
      setLoading(true);
    };
    const onLoad = () => {
      setLoading(false);
      setError(false);
    };
    const onTileError = () => {
      setLoading(false);
      setError(true);
      // Auto-dismiss after 5 seconds
      clearTimeoutRef.current = setTimeout(() => setError(false), 5000);
    };

    map.on('tileloadstart', onLoading);
    map.on('tileload', onLoad);
    map.on('load', onLoad);
    map.on('tileerror', onTileError);

    return () => {
      map.off('tileloadstart', onLoading);
      map.off('tileload', onLoad);
      map.off('load', onLoad);
      map.off('tileerror', onTileError);
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
    };
  }, [mapRef]);

  return { loading, error };
}

// ---------- Main component ----------

interface MapTabProps {
  geoState: GeoState | null;
}

const DEFAULT_CENTER: [number, number] = [25.805, 89.636]; // Kurigram district center, fallback only

export default function MapTab({ geoState }: MapTabProps) {
  const [activeLayer, setActiveLayer] = useState<LayerId>('ndvi');
  const [pipelineState, setPipelineState] = useState<PipelineState>('idle');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const center: [number, number] = geoState?.coords
    ? [geoState.coords.latitude, geoState.coords.longitude]
    : DEFAULT_CENTER;

  // Fix #4: GIBS date recalculated each render (or on demand), not frozen at module load
  const tiles = getLayerTiles(activeLayer);
  const satelliteTiles = getLayerTiles('satellite');

  // Fix #11/#12: track tile loading state
  const { loading: tileLoading, error: tileError } = useTileStatus(mapRef);

  const runPipeline = useCallback(async () => {
    setPipelineState('running');
    const timeout = setTimeout(() => setPipelineState((s) => (s === 'running' ? 'error' : s)), 8000);
    try {
      const boundsPayload = bounds
        ? [[bounds.getSouth(), bounds.getWest()], [bounds.getNorth(), bounds.getEast()]]
        : null;
      const endpoint = import.meta.env.VITE_GEE_PIPELINE_URL || '/api/gee-ndvi';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounds: boundsPayload,
          date_from: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
          date_to: new Date().toISOString().split('T')[0],
          indices: ['NDVI', 'EVI', 'LSWI'],
        }),
      });
      if (!res.ok) throw new Error('Pipeline request failed');
      const data = (await res.json()) as PipelineResult;
      setResult(data);
      setPipelineState('success');
    } catch {
      setPipelineState('error');
    } finally {
      clearTimeout(timeout);
      setTimeout(() => setPipelineState('idle'), 8000);
    }
  }, [bounds]);

  const showSatelliteUnderlay = activeLayer === 'ndvi' || activeLayer === 'evi';
  const showLegend = activeLayer === 'ndvi' || activeLayer === 'evi';

  /** Assign the map instance to our ref so CustomZoomControl can call zoomIn/zoomOut. */
  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);

  return (
    <div className="relative w-full h-full" style={{ minHeight: 0 }}>
      {/* Fix #1: explicit height ensures Leaflet computes correctly even inside flex/absolute parents */}
      <MapContainer
        center={center}
        zoom={12}
        className="w-full h-full"
        zoomControl={false}
        ref={handleMapReady}
      >
        {showSatelliteUnderlay && (
          <TileLayer
            key="satellite-underlay"
            url={satelliteTiles.url}
            attribution={satelliteTiles.attribution}
            opacity={0.4}
          />
        )}
        <TileLayer
          key={activeLayer}
          url={tiles.url}
          attribution={tiles.attribution}
        />
        <BoundsTracker onBoundsChange={setBounds} />
      </MapContainer>

      <LayerSwitcher active={activeLayer} onChange={setActiveLayer} />
      <NDVILegend visible={showLegend} />

      {/* Fix #10: Custom zoom controls (top-right, above pipeline button) */}
      <CustomZoomControl mapRef={mapRef} />

      {/* Fix #13: Bounds area indicator */}
      <BoundsOverlay bounds={bounds} />

      {/* Fix #11/#12: Tile loading/error indicator */}
      <TileStatusIndicator loading={tileLoading} error={tileError} />

      <div className="absolute bottom-4 right-3 z-[1000]">
        <CloudPipelineButton state={pipelineState} onRun={runPipeline} />
      </div>

      {result && pipelineState !== 'running' && (
        <ResultOverlay result={result} onClose={() => setResult(null)} />
      )}
    </div>
  );
}