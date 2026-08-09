import { useMemo, useState } from 'react';
import { Search, MapPin, Phone, Camera, X, ListFilter } from 'lucide-react';
import type { PlantationSubmission } from '../types/plantation';
import { toBnNum } from '../utils/mapHelper';
import { KURIGRAM_UPAZILAS, colorForUpazila } from '../utils/upazilaColors';
import RegistryDetailModal from './RegistryDetailModal';

interface RegistryTabProps {
  submissions: PlantationSubmission[];
  language: 'bn' | 'en';
}

type TriFilter = 'all' | 'with' | 'without';

/**
 * Searchable, filterable browse view over all local submissions — the
 * "oversight" counterpart to the map's data-entry-focused view. Ported
 * from the kurigram_nursery_registry dashboard pattern (see
 * docs/skills/registry-dashboard.md): global search + facet filters +
 * stat cards + Dialog-based per-record drill-down, all computed once
 * from the same in-memory array (no separate fetch per view).
 */
export default function RegistryTab({ submissions, language }: RegistryTabProps) {
  const [query, setQuery] = useState('');
  const [activeUpazilas, setActiveUpazilas] = useState<string[]>([]);
  const [gpsFilter, setGpsFilter] = useState<TriFilter>('all');
  const [mobileFilter, setMobileFilter] = useState<TriFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<PlantationSubmission | null>(null);

  const t = {
    searchPlaceholder: language === 'bn' ? 'গ্রাম, প্রজাতি বা পরিচর্যাকারী খুঁজুন...' : 'Search village, species, caretaker...',
    filters: language === 'bn' ? 'ফিল্টার' : 'Filters',
    upazila: language === 'bn' ? 'উপজেলা' : 'Upazila',
    gps: language === 'bn' ? 'GPS যাচাইকৃত' : 'GPS Verified',
    mobile: language === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number',
    withIt: language === 'bn' ? 'আছে' : 'With',
    withoutIt: language === 'bn' ? 'নেই' : 'Without',
    clear: language === 'bn' ? 'সব মুছুন' : 'Clear all',
    total: language === 'bn' ? 'মোট এন্ট্রি' : 'Total Entries',
    withGps: language === 'bn' ? 'GPS যাচাইকৃত' : 'GPS Verified',
    withMobile: language === 'bn' ? 'মোবাইল আছে' : 'Has Mobile',
    upazilas: language === 'bn' ? 'উপজেলা' : 'Upazilas',
    noResults: language === 'bn' ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No results found',
    seedlings: language === 'bn' ? 'চারা' : 'seedlings',
  };

  // ---- Facet filtering, all over the same in-memory array ----
  const filtered = useMemo(() => {
    return submissions
      .filter((s) => activeUpazilas.length === 0 || activeUpazilas.includes(s.upazila))
      .filter((s) => {
        if (gpsFilter === 'all') return true;
        const hasGps = !!s.verificationLatitude;
        return gpsFilter === 'with' ? hasGps : !hasGps;
      })
      .filter((s) => {
        if (mobileFilter === 'all') return true;
        const hasMobile = !!s.caretakerMobile;
        return mobileFilter === 'with' ? hasMobile : !hasMobile;
      })
      .filter((s) => {
        if (!query.trim()) return true;
        const q = query.trim().toLowerCase();
        return (
          s.village?.toLowerCase().includes(q) ||
          s.caretakerName?.toLowerCase().includes(q) ||
          s.upazila?.toLowerCase().includes(q) ||
          s.union?.toLowerCase().includes(q) ||
          s.seedlings.some((sd) => sd.speciesName?.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }, [submissions, activeUpazilas, gpsFilter, mobileFilter, query]);

  // ---- Cheap derived stat cards ----
  const stats = useMemo(() => {
    const total = submissions.length;
    const withGps = submissions.filter((s) => !!s.verificationLatitude).length;
    const withMobile = submissions.filter((s) => !!s.caretakerMobile).length;
    const upazilaCount = new Set(submissions.map((s) => s.upazila).filter(Boolean)).size;
    return { total, withGps, withMobile, upazilaCount };
  }, [submissions]);

  const toggleUpazila = (u: string) => {
    setActiveUpazilas((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]));
  };

  const clearFilters = () => {
    setActiveUpazilas([]);
    setGpsFilter('all');
    setMobileFilter('all');
    setQuery('');
  };

  const hasActiveFilters = activeUpazilas.length > 0 || gpsFilter !== 'all' || mobileFilter !== 'all' || !!query;

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black text-emerald-700">{toBnNum(stats.total)}</p>
          <p className="text-[8.5px] text-gray-500 mt-0.5 leading-tight">{t.total}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black text-blue-700">
            {stats.total > 0 ? toBnNum(Math.round((stats.withGps / stats.total) * 100)) : toBnNum(0)}%
          </p>
          <p className="text-[8.5px] text-gray-500 mt-0.5 leading-tight">{t.withGps}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black text-amber-700">
            {stats.total > 0 ? toBnNum(Math.round((stats.withMobile / stats.total) * 100)) : toBnNum(0)}%
          </p>
          <p className="text-[8.5px] text-gray-500 mt-0.5 leading-tight">{t.withMobile}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-black text-purple-700">{toBnNum(stats.upazilaCount)}</p>
          <p className="text-[8.5px] text-gray-500 mt-0.5 leading-tight">{t.upazilas}</p>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-2">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="flex-1 bg-transparent text-xs focus:outline-none min-w-0"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`shrink-0 px-2.5 py-2 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
            hasActiveFilters ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          <ListFilter size={12} />
          {t.filters}
        </button>
      </div>

      {/* Facet filters */}
      {filtersOpen && (
        <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">{t.upazila}</label>
            <div className="flex flex-wrap gap-1">
              {KURIGRAM_UPAZILAS.map((u) => {
                const active = activeUpazilas.includes(u);
                return (
                  <button
                    key={u}
                    onClick={() => toggleUpazila(u)}
                    className={`px-2 py-1 rounded-full text-[10px] font-medium flex items-center gap-1 cursor-pointer ${
                      active ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                    style={active ? { background: colorForUpazila(u) } : undefined}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorForUpazila(u) }} />
                    {u}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">{t.gps}</label>
              <div className="flex gap-1">
                {(['all', 'with', 'without'] as TriFilter[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setGpsFilter(v)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
                      gpsFilter === v ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {v === 'all' ? (language === 'bn' ? 'সব' : 'All') : v === 'with' ? t.withIt : t.withoutIt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">{t.mobile}</label>
              <div className="flex gap-1">
                {(['all', 'with', 'without'] as TriFilter[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setMobileFilter(v)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-medium cursor-pointer ${
                      mobileFilter === v ? 'bg-emerald-700 text-white' : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {v === 'all' ? (language === 'bn' ? 'সব' : 'All') : v === 'with' ? t.withIt : t.withoutIt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full py-1.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-semibold cursor-pointer"
            >
              {t.clear}
            </button>
          )}
        </div>
      )}

      {/* Result count */}
      <div className="text-[10px] text-gray-400">
        {toBnNum(filtered.length)} / {toBnNum(submissions.length)}
      </div>

      {/* List */}
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-xs">{t.noResults}</div>
        )}
        {filtered.map((s) => {
          const total = s.seedlings.reduce((sum, sd) => sum + (sd.count || 0), 0);
          const color = colorForUpazila(s.upazila);
          return (
            <button
              key={s.id}
              onClick={() => setDetail(s)}
              className="w-full text-left bg-white border border-gray-100 rounded-xl p-2.5 hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="font-bold text-gray-800 text-[12px] truncate">{s.village || s.union || s.upazila}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin size={9} /> {s.upazila} · {s.union}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-black text-emerald-700">{toBnNum(total)}</div>
                  <div className="text-[8.5px] text-gray-400">{t.seedlings}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[9.5px] text-gray-400">
                {s.caretakerName && <span className="truncate max-w-[100px]">{s.caretakerName}</span>}
                {s.caretakerMobile && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <Phone size={9} /> {s.caretakerMobile}
                  </span>
                )}
                {s.photos?.length > 0 && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <Camera size={9} /> {toBnNum(s.photos.length)}
                  </span>
                )}
                {!s.synced && <span className="ml-auto text-amber-600 shrink-0">⏳</span>}
              </div>
            </button>
          );
        })}
      </div>

      {detail && <RegistryDetailModal submission={detail} language={language} onClose={() => setDetail(null)} />}
    </div>
  );
}
