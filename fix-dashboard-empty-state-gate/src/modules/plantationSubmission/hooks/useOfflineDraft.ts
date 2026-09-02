import { useCallback, useEffect, useRef, useState } from 'react';
import { db } from '../../../lib/db';
import { createEmptyDraft, type SubmissionDraft, type DraftStatus } from '../types/submission';

const AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * Local-first draft persistence for the new submission wizard, backed by
 * the `newSubmissionDrafts` IndexedDB table (see lib/db.ts v3).
 *
 * Status lifecycle:
 *   DRAFT -> READY_FOR_SUBMISSION -> SYNC_PENDING -> SUBMITTED
 *
 * - DRAFT: officer is still filling the wizard out. Autosaves on every
 *   change (debounced) so nothing is lost if the app is closed mid-entry.
 * - READY_FOR_SUBMISSION: officer completed the Review step and tapped
 *   submit, but a network write hasn't been attempted/confirmed yet.
 * - SYNC_PENDING: a submit attempt is in flight or queued for retry.
 * - SUBMITTED: confirmed written to the server (or, offline-first,
 *   confirmed flattened into the local `submissions` table — see
 *   services/flattenToLegacySubmission.ts in a later phase — so it shows
 *   up in Map/Dashboard/Registry immediately even before a network sync).
 */
export function useOfflineDraft(existingDraftId?: string) {
  const [draft, setDraft] = useState<SubmissionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load existing draft, or create a new one ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (existingDraftId) {
          const found = await db.newSubmissionDrafts.get(existingDraftId);
          if (found && !cancelled) {
            setDraft(found);
            setLoading(false);
            return;
          }
        }
        const fresh = createEmptyDraft();
        if (!cancelled) {
          await db.newSubmissionDrafts.put(fresh);
          setDraft(fresh);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDraftId]);

  // ---- Debounced autosave whenever `draft` changes ----
  const persist = useCallback((next: SubmissionDraft) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await db.newSubmissionDrafts.put({ ...next, updatedAt: new Date().toISOString() });
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  const updateDraft = useCallback(
    (updater: (prev: SubmissionDraft) => SubmissionDraft) => {
      setDraft((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setStatus = useCallback(
    (status: DraftStatus) => {
      updateDraft((prev) => ({ ...prev, status }));
    },
    [updateDraft]
  );

  // Flush any pending debounced save immediately (e.g. before navigating
  // away or finalizing submission) — avoids losing the last edit if the
  // debounce window hasn't elapsed yet.
  const flush = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (draft) {
      await db.newSubmissionDrafts.put({ ...draft, updatedAt: new Date().toISOString() });
    }
  }, [draft]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { draft, loading, saving, updateDraft, setStatus, flush };
}

/** List all local drafts that haven't reached SUBMITTED yet — useful for
 *  a future "resume draft" picker. Not wired into the UI in Phase 1. */
export async function listInProgressDrafts(): Promise<SubmissionDraft[]> {
  const all = await db.newSubmissionDrafts.toArray();
  return all.filter((d) => d.status !== 'SUBMITTED').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
