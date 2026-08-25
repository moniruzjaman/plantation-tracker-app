import { ReactNode } from 'react';
import { ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  /** Green check in the header once this section's required fields are filled. */
  complete?: boolean;
  /** Amber warning dot when the section still needs attention (only shown when closed). */
  needsAttention?: boolean;
  children: ReactNode;
}

/**
 * A single accordion section used to lay the whole plantation form out as
 * one scrollable page (Site / Geofence / Plant / Personnel / Review) rather
 * than a click-through step wizard. Any number of sections may be open at
 * once — the caller controls that via `open`/`onToggle` — so an officer can
 * jump straight to, say, "Geofence" without stepping through every screen
 * first, while still getting a collapsed, low-clutter view by default.
 */
export default function CollapsibleSection({
  title,
  subtitle,
  icon,
  open,
  onToggle,
  complete,
  needsAttention,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left cursor-pointer hover:bg-gray-50 transition"
      >
        {icon && <span className="text-emerald-600 shrink-0">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-gray-800 text-sm truncate">{title}</span>
            {complete && <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />}
            {!complete && needsAttention && !open && (
              <AlertCircle size={13} className="text-amber-500 shrink-0" />
            )}
          </div>
          {subtitle && <p className="text-[10px] text-gray-400 truncate mt-0.5">{subtitle}</p>}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="px-3.5 pb-4 pt-1 border-t border-gray-100">{children}</div>}
    </div>
  );
}
