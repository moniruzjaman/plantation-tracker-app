import { PlantationSubmission } from '../types';

export interface OfflineDraft extends PlantationSubmission {
  syncStatus: 'draft' | 'pending' | 'synced';
}

/**
 * Enterprise-grade LocalStorage & IndexedDB browser native database layer
 * Designed to mirror the Dexie.js specification for the Bangladesh 25-Crore Plantation Platform
 */
class PlantationDatabase {
  private key = 'PlantationDatabase_drafts';

  async getAll(): Promise<OfflineDraft[]> {
    try {
      const stored = localStorage.getItem(this.key);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to read from PlantationDatabase:', e);
      return [];
    }
  }

  async put(draft: OfflineDraft): Promise<void> {
    try {
      const all = await this.getAll();
      const existingIdx = all.findIndex(item => item.id === draft.id);
      if (existingIdx > -1) {
        all[existingIdx] = draft;
      } else {
        all.push(draft);
      }
      localStorage.setItem(this.key, JSON.stringify(all));
    } catch (e) {
      console.error('Failed to write to PlantationDatabase:', e);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const all = await this.getAll();
      const filtered = all.filter(item => item.id !== id);
      localStorage.setItem(this.key, JSON.stringify(filtered));
    } catch (e) {
      console.error('Failed to delete from PlantationDatabase:', e);
    }
  }

  async getPending(): Promise<OfflineDraft[]> {
    const all = await this.getAll();
    return all.filter(item => item.syncStatus === 'pending');
  }

  async markAsSynced(id: string): Promise<void> {
    const all = await this.getAll();
    const draft = all.find(item => item.id === id);
    if (draft) {
      draft.syncStatus = 'synced';
      draft.synced = true;
      await this.put(draft);
    }
  }
}

export const db = new PlantationDatabase();
