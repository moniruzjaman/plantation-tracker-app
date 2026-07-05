import { useState, useEffect } from 'react';
import { PlantationSubmission } from '../types';

export function useOfflineQueue() {
  const [queue, setQueue] = useState<PlantationSubmission[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    syncedCount: number;
    xpBonus: number;
    greenTokens: number;
    message: string;
  } | null>(null);

  // Load initial queue from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('offline_plantation_drafts');
      if (stored) {
        setQueue(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load offline drafts queue', e);
    }
  }, []);

  // Save queue helper
  const saveQueue = (updated: PlantationSubmission[]) => {
    setQueue(updated);
    try {
      localStorage.setItem('offline_plantation_drafts', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to persist offline drafts queue', e);
    }
  };

  // Add draft to queue
  const addDraft = (draft: PlantationSubmission) => {
    const updated = [...queue, { ...draft, synced: false }];
    saveQueue(updated);
  };

  // Remove draft from queue
  const removeDraft = (id: string) => {
    const updated = queue.filter((d) => d.id !== id);
    saveQueue(updated);
  };

  // Sync entire queue with Cloud /api/sync endpoint
  const syncQueue = async (): Promise<boolean> => {
    const unsynced = queue.filter((d) => !d.synced);
    if (unsynced.length === 0 || isSyncing) return false;

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ drafts: unsynced }),
      });

      if (!response.ok) {
        throw new Error('Sync gateway request failed');
      }

      const data = await response.json();

      // Update local storage items status to synced
      const updatedQueue = queue.map((item) => {
        if (!item.synced) {
          return { ...item, synced: true };
        }
        return item;
      });
      saveQueue(updatedQueue);

      // Save rewards to local state storage
      const currentXp = parseInt(localStorage.getItem('ai_consultation_score') || '0', 10);
      localStorage.setItem('ai_consultation_score', (currentXp + data.xpBonus).toString());

      setSyncResult({
        success: true,
        syncedCount: data.syncedCount,
        xpBonus: data.xpBonus,
        greenTokens: data.greenTokens,
        message: data.message,
      });

      // Clear synced items after success
      setTimeout(() => {
        const remainingUnsynced = updatedQueue.filter((d) => !d.synced);
        saveQueue(remainingUnsynced);
      }, 5000);

      return true;
    } catch (err: any) {
      console.error('Sync failure:', err);
      setSyncResult({
        success: false,
        syncedCount: 0,
        xpBonus: 0,
        greenTokens: 0,
        message: 'কানেকশন এরর: ক্লাউড সার্ভারের সাথে সিঙ্ক ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।',
      });
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-trigger sync when transitioning to online
  useEffect(() => {
    const handleOnline = () => {
      syncQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [queue]);

  return {
    queue,
    isSyncing,
    syncResult,
    addDraft,
    removeDraft,
    syncQueue,
    unsyncedCount: queue.filter((d) => !d.synced).length,
  };
}
