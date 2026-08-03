import { useEffect, useState, useMemo } from 'react';
import { CalendarClock, AlertTriangle, Clock, CheckCircle2, ChevronRight } from 'lucide-react';
import { getSubmissions, getAllMonitoringRevisits } from '../../lib/db';
import type { PlantationSubmission, CheckpointStage } from '../../types/plantation';
import { getRevisitStatus, revisitUrgencySortKey, CHECKPOINT_LABEL, type RevisitStatus } from '../../services/revisitSchedule';
import { toBnNum } from '../../utils/mapHelper';

interface RevisitDueListProps {
  onOpenRevisit: (submissionId: string) => void;
  language?: 'bn' | 'en';
}

interface DueRow {
  submission: PlantationSubmission;
  status: RevisitStatus;
}

const URGENCY_STYLE: Record<string, { border: string; bg: string; text: string; icon: typeof AlertTriangle }> = {
  overdue: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', icon: AlertTriangle },
  due_soon: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', icon: Clock },
  upcoming: { border: 'border-gray-200', bg: 'bg-white', text: 'text-gray-500', icon: CalendarClock },
};

/**
 * Lists plantation sites that are due (or overdue) for their next VM0047
 * checkpoint revisit, sorted most-urgent first. Reads submissions + local
 * revisit history entirely from IndexedDB, so it works fully offline and
 * doesn't need every submission's revisit trail to have synced first.
 */
export default function RevisitDueList({ onOpenRevisit, language = 'bn' }: RevisitDueListProps) {
  const [submissions, setSubmissions] = useState<PlantationSubmission[]>([]);
  const [completedBySubmission, setCompletedBySubmission] = useState<Record<string, CheckpointStage[]>>({});
  const [loading, setLoading] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [subs, revisits] = await Promise.all([getSubmissions(), getAllMonitoringRevisits()]);
      if (cancelled) return;
      const map: Record<string, CheckpointStage[]> = {};
      for (const r of revisits) {
        if (!map[r.submissionId]) map[r.submissionId] = [];
        map[r.submissionId].push(r.stage);
      }
      setSubmissions(subs);
      setCompletedBySubmission(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const t = {
    heading: language === 'bn' ? 'পুনর্পরিদর্শন প্রয়োজন' : 'Revisits Due',
    empty: language === 'bn' ? 'আপাতত কোনো পরিদর্শন বকেয়া নেই' : 'Nothing due for revisit right now',
    loading: language === 'bn' ? 'লোড হচ্ছে...' : 'Loading...',
    overdue: (d: number) => language === 'bn' ? `${toBnNum(d)} দিন বিলম্বিত` : `${d} days overdue`,
    dueSoon: (d: number) => language === 'bn' ? `${toBnNum(d)} দিনের মধ্যে বকেয়া` : `due in ${d} days`,
    upcoming: (d: number) => language === 'bn' ? `${toBnNum(d)} দিন পর` : `in ${d} days`,
    showUpcoming: language === 'bn' ? 'ভবিষ্যতের সবগুলো দেখুন' : 'Show all upcoming',
    hideUpcoming: language === 'bn' ? 'শুধু জরুরিগুলো দেখান' : 'Show urgent only',
    revisit: language === 'bn' ? 'পরিদর্শন করুন' : 'Revisit',
    allComplete: language === 'bn' ? '✓ সব চেকপয়েন্ট সম্পন্ন' : '✓ All checkpoints complete',
  };

  const rows = useMemo<DueRow[]>(() => {
    const computed = submissions
      .filter((s) => s.plantationDate)
      .map((s) => ({
        submission: s,
        status: getRevisitStatus(s.plantationDate, completedBySubmission[s.id] || []),
      }))
      .filter((r) => r.status.urgency !== 'invalid_date' && r.status.urgency !== 'all_complete');

    computed.sort((a, b) => revisitUrgencySortKey(a.status) - revisitUrgencySortKey(b.status));

    if (showUpcoming) return computed;
    return computed.filter((r) => r.status.urgency !== 'upcoming');
  }, [submissions, completedBySubmission, showUpcoming]);

  if (loading) {
    return <p className="text-xs text-gray-400 text-center py-4">{t.loading}</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
          <CalendarClock size={14} className="text-emerald-600" /> {t.heading}
        </p>
        <button
          type="button"
          onClick={() => setShowUpcoming((v) => !v)}
          className="text-[10px] font-semibold text-emerald-700 hover:underline cursor-pointer"
        >
          {showUpcoming ? t.hideUpcoming : t.showUpcoming}
        </button>
      </div>

      {rows.length === 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-2">
          <CheckCircle2 size={13} /> {t.empty}
        </div>
      )}

      <div className="space-y-1.5">
        {rows.map(({ submission, status }) => {
          const style = URGENCY_STYLE[status.urgency] ?? URGENCY_STYLE.upcoming;
          const Icon = style.icon;
          const stageLabel = status.nextStage ? CHECKPOINT_LABEL[status.nextStage][language] : '';
          const daysText =
            status.daysUntilDue === null
              ? ''
              : status.urgency === 'overdue'
                ? t.overdue(Math.abs(status.daysUntilDue))
                : status.urgency === 'due_soon'
                  ? t.dueSoon(status.daysUntilDue)
                  : t.upcoming(status.daysUntilDue);

          return (
            <button
              key={submission.id}
              type="button"
              onClick={() => onOpenRevisit(submission.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left cursor-pointer hover:opacity-90 transition ${style.border} ${style.bg}`}
            >
              <Icon size={14} className={`shrink-0 ${style.text}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-gray-800 truncate">
                  {submission.village || submission.union || submission.upazila}
                </p>
                <p className={`text-[10px] font-semibold ${style.text}`}>
                  {stageLabel} — {daysText}
                </p>
              </div>
              <ChevronRight size={14} className="text-gray-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
