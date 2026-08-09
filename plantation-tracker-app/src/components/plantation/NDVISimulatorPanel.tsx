/**
 * Satellite NDVI Simulator & Canopy Growth Tracker
 * উপগ্রহ এনডিভিআই সিমুলেটর ও বৃদ্ধি ট্র্যাকিং
 *
 * Side panel that opens on the Map page. Combines:
 *   - Year-by-year canopy projection (2026 → 2031) with NDVI + carbon stats
 *   - Google Earth Engine (GEE) cloud integration badge & dataset info
 *   - Sentinel-2 band combination selector (True Color / False Color / NDVI)
 *   - Cloud-cover filter control (< 10% default)
 *   - Read-only GEE JavaScript Code Editor preview
 *   - Live Platform Logs stream emitted when a pipeline run is triggered
 *   - 4-band NDVI canopy scale legend
 *
 * The panel is purely additive — it does not modify the existing MapTab
 * pipeline state machine; it shares it via props so the existing
 * CloudPipelineButton and the new "Run Cloud Pipeline" button stay in sync.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Satellite,
  Cloud,
  Code2,
  Terminal,
  Play,
  ChevronDown,
  ChevronUp,
  Trees,
  Car,
  Activity,
  Layers,
  Gauge,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Leaf,
  Wifi,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import {
  GEE_ENDPOINT,
  GEE_API_VERSION,
  GEE_DATASET,
  BAND_COMBOS,
  type BandComboId,
  NDVI_SCALE_BANDS,
  ndviStageLabelBn,
  ndviStageColor,
  GEE_SAMPLE_SCRIPT,
  GIBS_REALTIME_LOG_STEPS,
} from '../../utils/geeConfig';
import {
  PROJECTION_YEARS,
  predictNDVI,
  predictCarbon,
  carbonOffsetEquivalence,
  SEED_SUMMARY,
  type ProjectionYear,
} from '../../utils/canopyProjection';
import {
  getOrFetchRegionNDVI,
  clearRegionNDVICache,
  type RegionNDVIResult,
} from '../../utils/realtimeNdvi';
import { toBnNum } from '../../utils/mapHelper';

// ---------- Shared types (mirrors MapTab's pipeline state) ----------

export type PipelineState = 'idle' | 'running' | 'success' | 'error';

interface LogEntry {
  level: 'info' | 'auth' | 'success' | 'process' | 'render' | 'error';
  message: string;
  ts: number;
}

export interface NDVISimulatorPanelProps {
  open: boolean;
  onClose: () => void;

  /** Shares pipeline state with MapTab so both buttons stay in sync. */
  pipelineState: PipelineState;
  /** Triggered when the user clicks "GEE লাইভ অ্যানালিসিস রান করুন".
   *  In realtime mode this is invoked AFTER the GIBS sampler completes so the
   *  logs and stats stay aligned with the actual satellite fetch. */
  onRunPipeline?: () => void;

  /** Latest NDVI value returned by the legacy mock /api/gee-ndvi endpoint.
   *  Optional — only used as a fallback display. The realtime GIBS sampler
   *  is the primary source. */
  liveNdvi?: number | null;
}

// ---------- Static helpers ----------

const levelColor: Record<LogEntry['level'], string> = {
  info: 'text-sky-600',
  auth: 'text-violet-600',
  success: 'text-emerald-600',
  process: 'text-amber-700',
  render: 'text-cyan-600',
  error: 'text-red-600',
};

const levelTag: Record<LogEntry['level'], string> = {
  info: 'info',
  auth: 'auth',
  success: 'success',
  process: 'process',
  render: 'render',
  error: 'error',
};

// ---------- Sub-components ----------

function StatTile({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: 'emerald' | 'amber' | 'sky' | 'violet';
}) {
  const accentClasses: Record<typeof accent, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
  };
  return (
    <div className={`rounded-xl border p-2.5 sm:p-3 ${accentClasses[accent]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="opacity-80">{icon}</span>
        <span className="text-[10px] sm:text-[11px] font-semibold opacity-80">{label}</span>
      </div>
      <div className="text-base sm:text-lg font-black leading-tight">{value}</div>
      {sub && <div className="text-[10px] sm:text-[11px] mt-0.5 opacity-75">{sub}</div>}
    </div>
  );
}

function YearChip({
  py,
  active,
  onClick,
}: {
  py: ProjectionYear;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap transition-all border ${
        active
          ? 'bg-emerald-700 text-white border-emerald-800 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
      }`}
    >
      <span className="block leading-tight">{toBnNum(py.year)}</span>
      <span className={`block text-[9px] sm:text-[10px] font-medium leading-tight mt-0.5 ${active ? 'text-emerald-200' : 'text-slate-400'}`}>
        {py.stageBn}
      </span>
    </button>
  );
}

function BandComboOption({
  id,
  labelBn,
  bands,
  descriptionBn,
  active,
  onClick,
}: {
  id: BandComboId;
  labelBn: string;
  bands: string[];
  descriptionBn: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-left rounded-lg border p-2 transition-all ${
        active
          ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-300'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[11px] font-bold text-slate-700">{labelBn}</span>
        <div className="flex gap-0.5">
          {bands.map((b) => (
            <span
              key={b}
              className="px-1 py-px rounded text-[8px] font-mono font-bold bg-slate-100 text-slate-600"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
      <p className="text-[9px] text-slate-500 leading-tight">{descriptionBn}</p>
    </button>
  );
}

function CodeEditorBlock({ script }: { script: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="ml-2 text-[10px] text-slate-400 font-mono">GEE JavaScript (Code Editor)</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-[10px] text-slate-300 hover:text-white px-1.5 py-0.5 rounded bg-slate-700/70 hover:bg-slate-700 transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-2.5 text-[10px] sm:text-[11px] leading-relaxed font-mono text-slate-200 overflow-x-auto max-h-44 overflow-y-auto">
        <code>{script}</code>
      </pre>
    </div>
  );
}

function PlatformLogs({
  logs,
  connected,
}: {
  logs: LogEntry[];
  connected: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Terminal size={11} className="text-slate-400" />
          <span className="text-[10px] text-slate-300 font-mono font-semibold">Platform Logs</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}
          />
          <span className={`text-[9px] font-mono ${connected ? 'text-emerald-400' : 'text-slate-500'}`}>
            {connected ? 'Connected' : 'Idle'}
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="p-2 text-[10px] font-mono leading-relaxed max-h-32 overflow-y-auto"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">// পাইপলাইন রান করার জন্য অপেক্ষা করছে...</div>
        ) : (
          logs.map((entry, i) => (
            <div key={i} className="flex gap-1.5 mb-0.5">
              <span className="text-slate-600 shrink-0">
                {new Date(entry.ts).toLocaleTimeString('en-GB', { hour12: false })}
              </span>
              <span className={`shrink-0 font-bold ${levelColor[entry.level]}`}>
                [{levelTag[entry.level]}]
              </span>
              <span className="text-slate-300 break-all">{entry.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function NDVIScaleLegend() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Gauge size={11} className="text-slate-500" />
        <span className="text-[10px] font-bold text-slate-600">এনডিভিআই স্কেল</span>
      </div>
      <div className="space-y-1">
        {NDVI_SCALE_BANDS.map((band) => (
          <div key={band.labelBn} className="flex items-center gap-1.5 text-[10px]">
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0 border border-slate-300"
              style={{ background: band.color }}
            />
            <span className="text-slate-700 flex-1">{band.labelBn}</span>
            <span className="text-slate-500 font-mono">
              {band.min >= 0 ? '+' : ''}
              {band.min.toFixed(2)} থেকে +{band.max.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors"
      >
        <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-slate-700">
          <span className="text-emerald-600">{icon}</span>
          {title}
        </span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Main panel ----------

export default function NDVISimulatorPanel({
  open,
  onClose,
  pipelineState: externalPipelineState,
  onRunPipeline,
  liveNdvi,
}: NDVISimulatorPanelProps) {
  const [selectedYearIdx, setSelectedYearIdx] = useState(1); // default: 2026 (চারা) per spec
  const [bandCombo, setBandCombo] = useState<BandComboId>('true_color');
  const [cloudLimit, setCloudLimit] = useState(GEE_DATASET.defaultCloudLimit);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showCodeEditor, setShowCodeEditor] = useState(true);

  // ---- Realtime (free, no-auth) GIBS NDVI sampler state ----
  // The panel manages its OWN internal pipeline state so the GIBS fetch can
  // run independently of the legacy /api/gee-ndvi mock endpoint.
  const [internalPipeline, setInternalPipeline] = useState<PipelineState>('idle');
  const [realtimeResult, setRealtimeResult] = useState<RegionNDVIResult | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  const pipelineState: PipelineState =
    internalPipeline !== 'idle' ? internalPipeline : externalPipelineState;

  const selectedYear = PROJECTION_YEARS[selectedYearIdx];

  // Projection preview for the currently selected year (simulated)
  const projection = useMemo(() => {
    return {
      ndvi: predictNDVI(selectedYear.yearOffset),
      carbon: predictCarbon(selectedYear.yearOffset),
    };
  }, [selectedYearIdx]);

  // Realtime NDVI takes priority over the legacy mock endpoint, which itself
  // takes priority over the simulated projection.
  const realtimeNdvi = realtimeResult?.meanNdvi ?? null;
  const displayNdvi = realtimeNdvi != null
    ? realtimeNdvi
    : liveNdvi != null
      ? liveNdvi
      : projection.ndvi;
  const displayCarbon = projection.carbon;
  const offset = carbonOffsetEquivalence(displayCarbon);
  const stageLabel = ndviStageLabelBn(displayNdvi);
  const stageColor = ndviStageColor(displayNdvi);

  /**
   * Runs the FREE realtime NDVI pipeline — fetches NASA GIBS MODIS Terra NDVI
   * 8-day raster tiles at every seed plantation coordinate, samples pixel
   * greenness, and aggregates a region mean. No API key, no auth, no billing.
   *
   * While running, streams the GIBS_REALTIME_LOG_STEPS template into the
   * Platform Logs terminal so the user sees live progress.
   */
  const runRealtimePipeline = useCallback(async () => {
    setInternalPipeline('running');
    setRealtimeError(null);
    setLogs([]);

    // Stream the template log lines at a steady cadence regardless of fetch
    // speed, so the user always sees progressive activity in the terminal.
    let cancelled = false;
    const streamTemplate = (async () => {
      for (const step of GIBS_REALTIME_LOG_STEPS) {
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 220));
        if (cancelled) return;
        setLogs((prev) => [...prev, { ...step, ts: Date.now() }]);
      }
    })();
    streamTemplate.catch(() => { /* swallow */ });

    try {
      // Force-refresh so manual re-runs always fetch fresh satellite tiles
      clearRegionNDVICache();
      const result = await getOrFetchRegionNDVI(true);
      if (cancelled) return;
      setRealtimeResult(result);

      // Append a per-site summary line for transparency
      setLogs((prev) => [
        ...prev,
        {
          level: 'process',
          message: `Sampled ${result.sampledCount}/${result.sampledCount + result.failedCount} sites · ` +
                   `GIBS date: ${result.date} · elapsed: ${result.elapsedMs}ms`,
          ts: Date.now(),
        },
        {
          level: 'success',
          message: `Realtime mean NDVI = ${result.meanNdvi.toFixed(2)} (${ndviStageLabelBn(result.meanNdvi)})`,
          ts: Date.now(),
        },
      ]);

      setInternalPipeline('success');

      // Also call the external (legacy) handler so the existing FAB stays in sync
      if (onRunPipeline) {
        try { onRunPipeline(); } catch { /* ignore */ }
      }
    } catch (err: any) {
      if (cancelled) return;
      const msg = err?.message || 'Unknown error';
      setRealtimeError(msg);
      setLogs((prev) => [
        ...prev,
        { level: 'error', message: `Realtime pipeline failed: ${msg}`, ts: Date.now() },
      ]);
      setInternalPipeline('error');
    } finally {
      // Ensure the template streamer stops
      cancelled = true;
      // Auto-reset to idle after 8s so the user can re-run
      setTimeout(() => setInternalPipeline((s) => (s === 'running' ? 'error' : s)), 0);
      setTimeout(() => setInternalPipeline('idle'), 8000);
    }
  }, [onRunPipeline]);

  // Stream platform logs when the EXTERNAL (legacy mock) pipeline is running
  // and the internal one is idle — keeps backwards-compatible behaviour.
  useEffect(() => {
    if (externalPipelineState !== 'running' || internalPipeline !== 'idle') return;
    let cancelled = false;
    setLogs([]);

    const stream = async () => {
      for (const step of GIBS_REALTIME_LOG_STEPS) {
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 280));
        if (cancelled) return;
        setLogs((prev) => [...prev, { ...step, ts: Date.now() }]);
      }
    };
    stream();

    return () => {
      cancelled = true;
    };
  }, [externalPipelineState, internalPipeline]);

  // Append a final success/error line when the external pipeline settles
  useEffect(() => {
    if (internalPipeline !== 'idle') return; // only for external transitions
    if (externalPipelineState === 'success') {
      setLogs((prev) => [
        ...prev,
        {
          level: 'success',
          message: `Pipeline complete — mean NDVI = ${displayNdvi.toFixed(2)} (${stageLabel})`,
          ts: Date.now(),
        },
      ]);
    } else if (externalPipelineState === 'error') {
      setLogs((prev) => [
        ...prev,
        { level: 'error', message: 'Pipeline failed — gateway unreachable or timeout.', ts: Date.now() },
      ]);
    }
  }, [externalPipelineState, internalPipeline, displayNdvi, stageLabel]);

  const runBtnConfig: Record<
    PipelineState,
    { label: string; icon: JSX.Element; cls: string }
  > = {
    idle: {
      label: '🚀 GEE লাইভ অ্যানালিসিস রান করুন',
      icon: <Play size={14} />,
      cls: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    running: {
      label: 'রিয়েলটাইম স্যাম্পলিং চলছে...',
      icon: <Loader2 size={14} className="animate-spin" />,
      cls: 'bg-amber-500 text-white cursor-wait',
    },
    success: {
      label: 'সফল! আবার রান করুন',
      icon: <CheckCircle2 size={14} />,
      cls: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    error: {
      label: 'পুনরায় চেষ্টা করুন',
      icon: <AlertTriangle size={14} />,
      cls: 'bg-red-500 hover:bg-red-600 text-white',
    },
  };
  const runBtn = runBtnConfig[pipelineState];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop (mobile only — desktop keeps the map visible) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="md:hidden fixed inset-0 bg-slate-900/40 z-[1100]"
          />

          {/* Panel — bottom sheet on mobile, right-side drawer on md+ */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed md:absolute inset-x-0 bottom-0 md:inset-y-0 md:left-auto md:right-0 z-[1101] md:z-[1001]
                       h-[80vh] md:h-full w-full md:w-[400px] lg:w-[440px]
                       bg-white md:bg-white/95 md:backdrop-blur shadow-2xl md:shadow-xl
                       rounded-t-2xl md:rounded-none flex flex-col overflow-hidden
                       border-t md:border-l border-slate-200"
          >
            {/* Handle (mobile) */}
            <div className="md:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
              <span className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-3 sm:px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-emerald-800 to-teal-850 text-white">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="bg-emerald-700/60 rounded-lg p-1.5 flex-shrink-0 mt-0.5">
                    <Satellite size={16} className="text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold leading-tight truncate">
                      উপগ্রহ এনডিভিআই সিমুলেটর ও বৃদ্ধি ট্র্যাকিং
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-emerald-200/90 mt-0.5 leading-tight">
                      সবুজ চাদরের ঘনত্ব ও গাছ বৃদ্ধির ভবিষ্যৎ প্রক্ষেপণ সিমুলেশন
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-emerald-700/60 transition-colors flex-shrink-0"
                  aria-label="বন্ধ করুন"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 form-scroll-area">
              {/* ---- Projection year selector ---- */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Calendar size={11} className="text-emerald-600" />
                    বৃদ্ধির সময়কাল (Simulated Projection Year)
                  </label>
                  <span className="text-[10px] text-slate-400">
                    বর্তমান: {toBnNum(selectedYear.year)} ({selectedYear.stageBn})
                  </span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                  {PROJECTION_YEARS.map((py, i) => (
                    <YearChip
                      key={`${py.year}-${py.stageBn}`}
                      py={py}
                      active={i === selectedYearIdx}
                      onClick={() => setSelectedYearIdx(i)}
                    />
                  ))}
                </div>
              </div>

              {/* ---- Seed data summary (from workbook) ---- */}
              <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <MapPin size={13} className="text-sky-600" />
                  <span className="text-[11px] font-bold text-sky-800">
                    সিড ডেটা (Tree Plantation Workbook)
                  </span>
                  <span className="ml-auto text-[9px] text-sky-600 font-mono bg-sky-100 px-1.5 py-0.5 rounded">
                    process data
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="bg-white rounded px-2 py-1 border border-sky-100">
                    <div className="text-slate-500">মোট এন্ট্রি</div>
                    <div className="font-bold text-slate-700">{toBnNum(SEED_SUMMARY.totalEntries)} টি</div>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-sky-100">
                    <div className="text-slate-500">মোট চারা</div>
                    <div className="font-bold text-slate-700">{toBnNum(SEED_SUMMARY.totalSeedlings)} টি</div>
                  </div>
                </div>
                {realtimeResult && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 rounded px-2 py-1 border border-emerald-100">
                    <Wifi size={11} className="animate-pulse" />
                    <span>
                      রিয়েলটাইম স্যাম্পল: <b>{realtimeResult.sampledCount}</b>/{realtimeResult.sampledCount + realtimeResult.failedCount} সাইট · GIBS তারিখ: <b>{realtimeResult.date}</b>
                    </span>
                  </div>
                )}
              </div>

              {/* ---- Stat tiles: NDVI + Carbon + Offset ---- */}
              <div className="grid grid-cols-2 gap-2">
                <StatTile
                  icon={<Gauge size={12} />}
                  label="গড় এনডিভিআই সূচক"
                  value={displayNdvi.toFixed(2)}
                  sub={
                    realtimeNdvi != null
                      ? `${stageLabel} · লাইভ`
                      : liveNdvi != null
                        ? `${stageLabel} · GEE`
                        : stageLabel
                  }
                  accent="emerald"
                />
                <StatTile
                  icon={<Leaf size={12} />}
                  label="প্রাক্কলিত কার্বন শোষণ"
                  value={`${toBnNum(displayCarbon)} টন/বছর`}
                  accent="amber"
                />
              </div>

              {/* ---- Live/Simulated mode badge ---- */}
              {realtimeNdvi != null && (
                <div className="flex items-center justify-center gap-1.5 -mt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE · NASA GIBS · FREE
                  </span>
                </div>
              )}

              {/* ---- NDVI canopy stage indicator ---- */}
              <div
                className="rounded-xl border p-2.5 flex items-center gap-2.5"
                style={{ background: `${stageColor}15`, borderColor: `${stageColor}40` }}
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: stageColor }}
                >
                  <Trees size={16} className="text-white" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-500 font-medium">ক্যানোপি স্টেজ</div>
                  <div className="text-sm font-bold text-slate-800">{stageLabel}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[10px] text-slate-500 font-medium">NDVI ব্যাপ্তি</div>
                  <div className="text-[11px] font-mono font-bold text-slate-700">
                    {NDVI_SCALE_BANDS.find((b) => b.labelBn === stageLabel)
                      ? `+${NDVI_SCALE_BANDS.find((b) => b.labelBn === stageLabel)!.min.toFixed(2)} → +${NDVI_SCALE_BANDS.find((b) => b.labelBn === stageLabel)!.max.toFixed(2)}`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* ---- Carbon offset equivalence ---- */}
              <SectionCard
                icon={<Activity size={12} />}
                title="কার্বন অফসেট মাত্রা"
                defaultOpen={false}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-slate-700">
                    <Trees size={12} className="text-emerald-600 flex-shrink-0" />
                    <span>{offset.equivalentTreesBn}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-700">
                    <Car size={12} className="text-sky-600 flex-shrink-0" />
                    <span>{offset.carMilesBn}</span>
                  </div>
                  <p className="text-[9px] text-slate-400 leading-tight pt-1 border-t border-slate-100">
                    * প্রক্ষেপিত মান — প্রকৃত সংখ্যা গাছের প্রজাতি, বয়স ও অঞ্চলভেদে ভিন্ন হতে পারে।
                  </p>
                </div>
              </SectionCard>

              {/* ---- GEE cloud integration badge ---- */}
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Cloud size={13} className="text-violet-600" />
                  <span className="text-[11px] font-bold text-violet-800">
                    Google Earth Engine (GEE) ক্লাউড ইন্টিগ্রেশন
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="bg-white rounded px-2 py-1 border border-violet-100">
                    <div className="text-slate-500">এন্ডপয়েন্ট</div>
                    <div className="font-mono font-bold text-slate-700 truncate">{GEE_ENDPOINT}</div>
                  </div>
                  <div className="bg-white rounded px-2 py-1 border border-violet-100">
                    <div className="text-slate-500">API ভার্সন</div>
                    <div className="font-mono font-bold text-slate-700">{GEE_API_VERSION}</div>
                  </div>
                </div>
              </div>

              {/* ---- Supercomputer dataset + band combo + cloud filter ---- */}
              <SectionCard
                icon={<Layers size={12} />}
                title="সুপারকম্পিউটার ডেটাসেট ও ব্যান্ড কনফিগ"
                defaultOpen
              >
                <div className="space-y-2">
                  {/* Dataset */}
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                    <div className="text-[10px] text-slate-500 mb-0.5">EE Dataset</div>
                    <div className="font-mono text-[11px] font-bold text-slate-800 break-all">
                      {GEE_DATASET.id}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {GEE_DATASET.shortName} · {GEE_DATASET.resolution}
                    </div>
                  </div>

                  {/* Band combination selector */}
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">ব্যান্ড কম্বিনেশন (EO Band Rendering)</div>
                    <div className="flex flex-col gap-1.5">
                      {BAND_COMBOS.map((combo) => (
                        <BandComboOption
                          key={combo.id}
                          id={combo.id}
                          labelBn={combo.labelBn}
                          bands={combo.bands}
                          descriptionBn={combo.descriptionBn}
                          active={bandCombo === combo.id}
                          onClick={() => setBandCombo(combo.id)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Cloud filter */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-slate-500">ক্লাউড ফিল্টার (Cloud limit)</span>
                      <span className="text-[11px] font-mono font-bold text-amber-700">
                        &lt;{toBnNum(cloudLimit)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={50}
                      step={5}
                      value={cloudLimit}
                      onChange={(e) => setCloudLimit(parseInt(e.target.value))}
                      className="w-full accent-amber-500 h-1.5"
                    />
                    <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* ---- Run pipeline button (free realtime GIBS sampler) ---- */}
              <button
                onClick={runRealtimePipeline}
                disabled={pipelineState === 'running'}
                className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${runBtn.cls} disabled:cursor-wait`}
              >
                <span className="text-base leading-none">🚀</span>
                {runBtn.icon}
                <span>{runBtn.label}</span>
              </button>
              <p className="text-[9px] text-center text-slate-400 -mt-1.5 leading-tight">
                {realtimeResult
                  ? `✓ সর্বশেষ রিয়েলটাইম স্যাম্পল: ${realtimeResult.date} · ${realtimeResult.sampledCount} সাইট`
                  : 'ফ্রি · NASA GIBS · কোনো API কী বা অথ প্রয়োজন নেই'}
              </p>

              {/* ---- GEE Code Editor ---- */}
              <SectionCard
                icon={<Code2 size={12} />}
                title="GEE JavaScript (Code Editor)"
                defaultOpen={showCodeEditor}
              >
                <CodeEditorBlock script={GEE_SAMPLE_SCRIPT} />
              </SectionCard>

              {/* ---- Platform logs ---- */}
              <SectionCard
                icon={<Terminal size={12} />}
                title="Platform Logs"
                defaultOpen
              >
                <PlatformLogs logs={logs} connected={pipelineState === 'running' || logs.length > 0} />
              </SectionCard>

              {/* ---- NDVI scale legend ---- */}
              <NDVIScaleLegend />

              {/* ---- Footer attribution ---- */}
              <p className="text-[9px] text-slate-400 text-center pt-1 pb-2 leading-relaxed">
                প্রক্ষেপণ বছর: {toBnNum(selectedYear.year)} | সচল এনডিভিআই ক্যানোপি ওভারলে
                <br />
                Leaflet | © OpenStreetMap, Map data © Esri World Imagery / Google Earth Engine
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
