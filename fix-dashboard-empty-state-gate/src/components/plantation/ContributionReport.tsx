import { useState, useEffect, useMemo } from 'react';
import { getSubmissions } from '../../utils/submissionStore';
import { toBnNum } from '../../utils/mapHelper';
import { BarChart3, TrendingUp, FileDown, RotateCcw, Leaf } from 'lucide-react';
import type { PlantationSubmission } from '../../types/plantation';

interface ContributionReportProps {
  /** Current officer/citizen's mobile — used to scope "my" submissions. */
  mobile?: string;
}

// Simple, clearly-labeled averages for the "probable output" estimate —
// not precise agronomic modeling, just a directional indicator.
const SURVIVAL_RATE = 0.8;
const CO2_KG_PER_TREE_YEAR = 20;

function seedlingTotal(s: PlantationSubmission): number {
  return (s.seedlings || []).reduce((sum, e) => sum + (Number(e.count) || 0), 0);
}

function entryDate(s: PlantationSubmission): string {
  return s.plantationDate || (s.timestamp ? s.timestamp.slice(0, 10) : '');
}

export default function ContributionReport({ mobile }: ContributionReportProps) {
  const [allSubs, setAllSubs] = useState<PlantationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [source, setSource] = useState('');
  const [district, setDistrict] = useState('');
  const [upazila, setUpazila] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const subs = await getSubmissions();
        if (!cancelled) setAllSubs(subs);
      } catch (e) {
        console.error('Failed to load submissions for contribution report:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mySubs = useMemo(() => {
    if (!mobile) return [];
    return allSubs.filter(
      (s) => s.monitoringOfficerMobile === mobile || s.caretakerMobile === mobile
    );
  }, [allSubs, mobile]);

  const { sourceOptions, districtOptions, upazilaOptions } = useMemo(() => {
    const sources = new Set<string>();
    const districts = new Set<string>();
    const upazilas = new Set<string>();
    mySubs.forEach((s) => {
      if (s.nurserySourceName) sources.add(s.nurserySourceName);
      if (s.district) districts.add(s.district);
      if (!district || s.district === district) {
        if (s.upazila) upazilas.add(s.upazila);
      }
    });
    return {
      sourceOptions: Array.from(sources).sort(),
      districtOptions: Array.from(districts).sort(),
      upazilaOptions: Array.from(upazilas).sort(),
    };
  }, [mySubs, district]);

  const filtered = useMemo(() => {
    return mySubs.filter((s) => {
      const d = entryDate(s);
      if (from && d && d < from) return false;
      if (to && d && d > to) return false;
      if (source && s.nurserySourceName !== source) return false;
      if (district && s.district !== district) return false;
      if (upazila && s.upazila !== upazila) return false;
      return true;
    });
  }, [mySubs, from, to, source, district, upazila]);

  const stats = useMemo(() => {
    const totalTrees = filtered.reduce((sum, s) => sum + seedlingTotal(s), 0);
    const districts = new Set(filtered.map((s) => s.district).filter(Boolean));
    const upazilas = new Set(filtered.map((s) => s.upazila).filter(Boolean));
    const synced = filtered.filter((s) => s.synced).length;
    const survivalEst = Math.round(totalTrees * SURVIVAL_RATE);
    const co2Est = Math.round(survivalEst * CO2_KG_PER_TREE_YEAR);
    return {
      entries: filtered.length,
      totalTrees,
      districtCount: districts.size,
      upazilaCount: upazilas.size,
      synced,
      survivalEst,
      co2Est,
    };
  }, [filtered]);

  const resetFilters = () => {
    setFrom('');
    setTo('');
    setSource('');
    setDistrict('');
    setUpazila('');
  };

  const exportCsv = () => {
    if (!filtered.length) return;
    const rows: (string | number)[][] = [
      ['ক্রম', 'তারিখ', 'জেলা', 'উপজেলা', 'গ্রাম', 'চারার উৎস', 'প্রজাতি', 'সংখ্যা', 'সিঙ্ক অবস্থা'],
    ];
    let idx = 1;
    filtered.forEach((s) => {
      const date = entryDate(s);
      const seedlings = s.seedlings?.length ? s.seedlings : [{ speciesName: '', count: seedlingTotal(s) }];
      seedlings.forEach((e) => {
        rows.push([
          idx++,
          date,
          s.district || '',
          s.upazila || '',
          s.village || '',
          s.nurserySourceName || '',
          e.speciesName || '',
          Number(e.count) || 0,
          s.synced ? 'সিঙ্কড' : 'অফলাইন',
        ]);
      });
    });
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `আমার_প্রতিবেদন_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!mobile) return null;

  return (
    <section className="bg-white rounded-xl p-4 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-emerald-700" />
        <h3 className="font-semibold text-gray-800 text-sm">আপনার অবদান ও প্রতিবেদন</h3>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400 text-center py-3">লোড হচ্ছে...</p>
      ) : !mySubs.length ? (
        <p className="text-xs text-gray-400 text-center py-3">
          এখনো কোনো তথ্য জমা দেওয়া হয়নি। ফর্ম পূরণ করলে এখানে আপনার অবদান দেখা যাবে।
        </p>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
              <p className="font-bold text-emerald-700 text-sm">{toBnNum(stats.entries)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">মোট এন্ট্রি</p>
            </div>
            <div className="bg-orange-50 rounded-lg p-2.5 text-center">
              <p className="font-bold text-orange-700 text-sm">{toBnNum(stats.totalTrees)}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">মোট চারা</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
              <p className="font-bold text-blue-700 text-sm">
                {toBnNum(stats.districtCount)} জেলা, {toBnNum(stats.upazilaCount)} উপজেলা
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">এলাকা কভারেজ</p>
            </div>
            <div className="bg-violet-50 rounded-lg p-2.5 text-center">
              <p className="font-bold text-violet-700 text-sm">
                {toBnNum(stats.synced)}/{toBnNum(stats.entries)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">সিঙ্কড</p>
            </div>
          </div>

          {/* Probable output */}
          <div className="rounded-lg p-3 bg-emerald-50/60 border border-emerald-100 border-l-4 border-l-red-500">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-700" />
              <p className="font-bold text-xs text-emerald-800">সম্ভাব্য ফলাফল (আনুমানিক)</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="font-bold text-sm text-emerald-700">{toBnNum(stats.survivalEst)}</p>
                <p className="text-gray-500 text-[10px]">প্রত্যাশিত জীবিত বৃক্ষ (~৮০%)</p>
              </div>
              <div className="bg-white rounded-lg p-2 text-center">
                <p className="font-bold text-sm text-sky-700">{toBnNum(stats.co2Est)} কেজি</p>
                <p className="text-gray-500 text-[10px]">আনুমানিক বার্ষিক কার্বন শোষণ</p>
              </div>
            </div>
            <p className="text-[9px] text-gray-400 mt-2">
              * গড় হার অনুযায়ী আনুমানিক হিসাব; প্রকৃত ফলাফল স্থান ও পরিচর্যাভেদে ভিন্ন হতে পারে।
            </p>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">প্রতিবেদন ফিল্টার করুন</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-[11px]"
                aria-label="তারিখ থেকে"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-[11px]"
                aria-label="তারিখ পর্যন্ত"
              />
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-[11px] bg-white"
              >
                <option value="">সব উৎস</option>
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setUpazila('');
                }}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-[11px] bg-white"
              >
                <option value="">সব জেলা</option>
                {districtOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={upazila}
                onChange={(e) => setUpazila(e.target.value)}
                className="border border-gray-200 rounded-md px-2 py-1.5 text-[11px] bg-white col-span-2"
              >
                <option value="">সব উপজেলা</option>
                {upazilaOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                className="flex items-center justify-center gap-1 flex-1 py-1.5 bg-gray-50 text-gray-600 rounded-md text-[11px] font-semibold border border-gray-100"
              >
                <RotateCcw className="w-3 h-3" /> রিসেট
              </button>
              <button
                onClick={exportCsv}
                disabled={!filtered.length}
                className="flex items-center justify-center gap-1 flex-1 py-1.5 bg-emerald-700 text-white rounded-md text-[11px] font-semibold disabled:opacity-40"
              >
                <FileDown className="w-3 h-3" /> CSV রপ্তানি
              </button>
            </div>
          </div>

          {/* Filtered entries preview */}
          {filtered.length === 0 ? (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md p-2 text-center">
              নির্বাচিত ফিল্টারে কোনো তথ্য পাওয়া যায়নি।
            </p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {filtered.slice(0, 25).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-[11px] border-b border-gray-50 pb-1.5 last:border-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Leaf className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span className="truncate text-gray-700">
                      {s.district} › {s.upazila}
                    </span>
                  </div>
                  <span className="text-gray-400 flex-shrink-0 ml-2">
                    {toBnNum(seedlingTotal(s))} চারা · {entryDate(s)}
                  </span>
                </div>
              ))}
              {filtered.length > 25 && (
                <p className="text-[10px] text-gray-400 text-center pt-1">
                  আরও {toBnNum(filtered.length - 25)}টি এন্ট্রি — CSV রপ্তানি করে সম্পূর্ণ তালিকা দেখুন
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
