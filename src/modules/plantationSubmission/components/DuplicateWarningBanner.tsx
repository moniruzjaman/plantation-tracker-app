import { ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import type { FraudCheck } from '../types/submission';

interface DuplicateWarningBannerProps {
  fraudCheck: FraudCheck;
  onAcknowledge: () => void;
  language?: 'bn' | 'en';
}

/**
 * Surfaces services/duplicateDetection.ts results. Never blocks data
 * entry by itself — it's a review flag, not a hard rule, since the
 * browser can't actually prove two plantings are the same tree — but the
 * officer must tick the acknowledgement before the whole draft can be
 * submitted (see PlantationSubmission.tsx's outstanding-checklist).
 */
export default function DuplicateWarningBanner({ fraudCheck, onAcknowledge, language = 'bn' }: DuplicateWarningBannerProps) {
  const t = {
    checking: language === 'bn' ? 'পুনরাবৃত্তি এন্ট্রি পরীক্ষা করা হচ্ছে...' : 'Checking for duplicate entries...',
    heading: language === 'bn' ? 'সম্ভাব্য পুনরাবৃত্তি এন্ট্রি সনাক্ত হয়েছে' : 'Possible duplicate entries detected',
    desc: language === 'bn'
      ? 'কাছাকাছি অবস্থানে একই প্রজাতির চারা ইতিমধ্যে রেকর্ড করা আছে। যদি এটি ভিন্ন গাছ হয় তবে নিচে নিশ্চিত করুন।'
      : 'A very similar entry (same species, nearby location, close date) already exists. If this is genuinely a different planting, confirm below.',
    match: (m: { officerName: string; distanceMeters: number; plantingDate: string; speciesName: string }) =>
      language === 'bn'
        ? `${m.speciesName} — ${m.distanceMeters} মিটার দূরে, ${m.plantingDate}${m.officerName ? ` (${m.officerName})` : ''}`
        : `${m.speciesName} — ${m.distanceMeters}m away, ${m.plantingDate}${m.officerName ? ` (${m.officerName})` : ''}`,
    acknowledge: language === 'bn' ? 'এটি ভিন্ন/নতুন গাছ — নিশ্চিত করছি' : 'This is a different/new planting — I confirm',
    acknowledged: language === 'bn' ? '✓ নিশ্চিত করা হয়েছে' : '✓ Confirmed',
  };

  if (fraudCheck.checking) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 px-1">
        <Loader2 size={12} className="animate-spin" /> {t.checking}
      </div>
    );
  }

  if (fraudCheck.matches.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
        <ShieldAlert size={14} /> {t.heading}
      </p>
      <p className="text-[11px] text-red-600 leading-relaxed">{t.desc}</p>
      <ul className="space-y-1">
        {fraudCheck.matches.map((m, i) => (
          <li key={`${m.submissionId}-${i}`} className="text-[11px] text-red-700 bg-white/60 rounded-lg px-2 py-1.5 border border-red-100">
            {t.match(m)}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAcknowledge}
        disabled={fraudCheck.acknowledged}
        className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold cursor-pointer transition ${
          fraudCheck.acknowledged
            ? 'bg-emerald-100 text-emerald-700 cursor-default'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
      >
        <CheckCircle2 size={13} /> {fraudCheck.acknowledged ? t.acknowledged : t.acknowledge}
      </button>
    </div>
  );
}
