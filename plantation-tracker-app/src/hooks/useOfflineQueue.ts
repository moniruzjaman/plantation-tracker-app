import { useState, useEffect, useCallback } from 'react';
import type { PlantationSubmission } from '../types/plantation';
import {
  getUnsyncedSubmissions,
  markAsSynced,
  bulkSaveSubmissions,
  migrateFromLocalStorage,
  countUnsynced,
} from '../lib/db';

export function useOfflineQueue() {
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    syncedCount: number;
    xpBonus: number;
    greenTokens: number;
    message: string;
  } | null>(null);

  // Load unsynced count from IndexedDB
  const refreshCount = useCallback(async () => {
    try {
      await migrateFromLocalStorage();
      const count = await countUnsynced();
      setUnsyncedCount(count);
    } catch (e) {
      console.error('Failed to load unsynced count', e);
    }
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Sync unsynced submissions with server
  const syncQueue = async (): Promise<boolean> => {
    if (isSyncing) return false;

    // Get fresh list of unsynced items
    let unsynced: PlantationSubmission[];
    try {
      unsynced = await getUnsyncedSubmissions();
    } catch {
      unsynced = [];
    }

    if (unsynced.length === 0) return false;

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

      // Mark all as synced in IndexedDB
      for (const item of unsynced) {
        await markAsSynced(item.id);
      }

      // Save rewards to local state storage (kept in localStorage as it's a simple counter)
      const currentXp = parseInt(localStorage.getItem('ai_consultation_score') || '0', 10);
      localStorage.setItem('ai_consultation_score', (currentXp + data.xpBonus).toString());

      setSyncResult({
        success: true,
        syncedCount: data.syncedCount,
        xpBonus: data.xpBonus,
        greenTokens: data.greenTokens,
        message: data.message,
      });

      // Refresh count
      await refreshCount();

      return true;
    } catch (err: any) {
      console.error('Sync failure:', err);
      setSyncResult({
        success: false,
        syncedCount: 0,
        xpBonus: 0,
        greenTokens: 0,
        message: 'কানেকশন এরর: ক্লাউড সার্ভারের সাথে সিঙ্ক ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।',
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
  }, [unsyncedCount, isSyncing]);

  return {
    unsyncedCount,
    isSyncing,
    syncResult,
    syncQueue,
    refreshCount,
  };
}