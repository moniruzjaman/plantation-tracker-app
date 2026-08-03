/**
 * VM0047 revisit scheduling — pure logic, no I/O. Computes which
 * checkpoint (month_6 / year_1 / year_2 / year_3) a submission is next
 * due for, and how urgent that is, from the planting date and whichever
 * checkpoints already have a recorded revisit.
 *
 * "Survival tracking" only works if officers actually get told when to
 * go back — a one-time planting photo proves nothing about whether the
 * tree lived. This is what powers the revisit-due list on the dashboard.
 */

import type { CheckpointStage } from '../types/plantation';

export const CHECKPOINT_ORDER: Exclude<CheckpointStage, 'planting'>[] = ['month_6', 'year_1', 'year_2', 'year_3'];

/** Days after planting each checkpoint falls due. */
export const CHECKPOINT_OFFSET_DAYS: Record<Exclude<CheckpointStage, 'planting'>, number> = {
  month_6: 182,
  year_1: 365,
  year_2: 730,
  year_3: 1095,
};

export const CHECKPOINT_LABEL: Record<CheckpointStage, { bn: string; en: string }> = {
  planting: { bn: 'রোপণ', en: 'Planting' },
  month_6: { bn: '৬ মাস', en: '6-Month' },
  year_1: { bn: '১ বছর', en: 'Year 1' },
  year_2: { bn: '২ বছর', en: 'Year 2' },
  year_3: { bn: '৩ বছর', en: 'Year 3' },
};

export type RevisitUrgency = 'overdue' | 'due_soon' | 'upcoming' | 'all_complete' | 'invalid_date';

export interface RevisitStatus {
  /** The next checkpoint that doesn't have a recorded revisit yet, or
   *  null if all 4 are complete. */
  nextStage: Exclude<CheckpointStage, 'planting'> | null;
  dueDate: string | null; // ISO date
  daysUntilDue: number | null; // negative = overdue by that many days
  urgency: RevisitUrgency;
}

const DUE_SOON_WINDOW_DAYS = 30;

/**
 * @param plantingDateIso  the submission's plantationDate
 * @param completedStages  stages that already have at least one revisit
 *                         recorded (from getRevisitsForSubmission)
 */
export function getRevisitStatus(plantingDateIso: string, completedStages: CheckpointStage[]): RevisitStatus {
  const plantingDate = new Date(plantingDateIso);
  if (Number.isNaN(plantingDate.getTime())) {
    return { nextStage: null, dueDate: null, daysUntilDue: null, urgency: 'invalid_date' };
  }

  const completed = new Set(completedStages);
  const nextStage = CHECKPOINT_ORDER.find((s) => !completed.has(s)) ?? null;

  if (!nextStage) {
    return { nextStage: null, dueDate: null, daysUntilDue: null, urgency: 'all_complete' };
  }

  const dueDate = new Date(plantingDate.getTime() + CHECKPOINT_OFFSET_DAYS[nextStage] * 86400000);
  const daysUntilDue = Math.round((dueDate.getTime() - Date.now()) / 86400000);

  const urgency: RevisitUrgency =
    daysUntilDue < 0 ? 'overdue' : daysUntilDue <= DUE_SOON_WINDOW_DAYS ? 'due_soon' : 'upcoming';

  return {
    nextStage,
    dueDate: dueDate.toISOString().slice(0, 10),
    daysUntilDue,
    urgency,
  };
}

/** Sort key so overdue-longest sorts first, then due-soon-soonest, then
 *  upcoming-soonest, with all_complete/invalid_date last. */
export function revisitUrgencySortKey(status: RevisitStatus): number {
  if (status.urgency === 'all_complete' || status.urgency === 'invalid_date') return Number.POSITIVE_INFINITY;
  return status.daysUntilDue ?? Number.POSITIVE_INFINITY;
}
