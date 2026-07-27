import { useState } from 'react';
import { Search, X, Palette } from 'lucide-react';
import { KURIGRAM_UPAZILAS, colorForUpazila } from '../../utils/upazilaColors';

const nfck = (s: string) => s.normalize('NFC');

interface MapFilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeUpazilas: string[]; // empty array = show all
  onToggleUpazila: (u: string) => void;
  onClearUpazilas: () => void;
  resultCount: number;
}

/**
 * Search input + upazila pill filters + collapsible color legend, all
 * operating over the same in-memory submissions array that feeds the map
 * markers — so filtering here and the marker layer always stay in sync.
 *
 * Pattern source: moniruzjaman/nursery-mapping's search+filter bar
 * (see docs/skills/offline-field-mapping.md).
 */
export default function MapFilterBar({
  query,
  onQueryChange,
  activeUpazilas,
  onToggleUpazila,
  onClearUpazilas,
  resultCount,
}: MapFilterBarProps) {
  const [legendOpen, setLegendOpen] = useState(false);
  const [pillsOpen, setPillsOpen] = useState(false);

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] w-[92%] sm:w-auto sm:min-w-[320px] max-w-md">
      <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg p-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="গ্রাম, প্রজাতি বা পরিচর্যাকারী খুঁজুন..."
              className="flex-1 bg-transparent text-xs focus:outline-none min-w-0"
            />
            {query && (
              <button onClick={() => onQueryChange('')} className="text-gray-400 hover:text-gray-600 shrink-0 cursor-pointer">
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => setPillsOpen((v) => !v)}
            className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeUpazilas.length > 0 ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            উপজেলা{activeUpazilas.length > 0 ? ` (${activeUpazilas.length})` : ''}
          </button>
          <button
            onClick={() => setLegendOpen((v) => !v)}
            className="shrink-0 w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center cursor-pointer"
            title="রঙের চিহ্ন"
          >
            <Palette size={13} />
          </button>
        </div>

        {pillsOpen && (
          <div className="flex flex-wrap gap-1 pt-1 border-t border-gray-100">
            {KURIGRAM_UPAZILAS.map((u) => {
              const active = activeUpazilas.includes(nfck(u));
              return (
                <button
                  key={u}
                  onClick={() => onToggleUpazila(u)}
                  className={`px-2 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    active ? 'text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                  style={active ? { background: colorForUpazila(u) } : undefined}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: colorForUpazila(u) }} />
                  {u}
                </button>
              );
            })}
            {activeUpazilas.length > 0 && (
              <button
                onClick={onClearUpazilas}
                className="px-2 py-1 rounded-full text-[10px] font-medium bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
              >
                সব মুছুন
              </button>
            )}
          </div>
        )}

        {legendOpen && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 border-t border-gray-100">
            {KURIGRAM_UPAZILAS.map((u) => (
              <div key={u} className="flex items-center gap-1.5 text-[9px] text-gray-600">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorForUpazila(u) }} />
                <span className="truncate">{u}</span>
              </div>
            ))}
          </div>
        )}

        <div className="text-[10px] text-gray-400 pt-0.5">{resultCount} টি এন্ট্রি দেখানো হচ্ছে</div>
      </div>
    </div>
  );
}
