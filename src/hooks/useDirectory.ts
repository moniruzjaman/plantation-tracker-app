import { useMemo, useState } from 'react';
import {
  searchSaao,
  resolveSaaoLocation,
  getMonitoringOfficersByUpazila,
  isDirectoryReady,
} from '../data/administrativeDirectory';
import type { SaaoDirectoryEntry, MonitoringOfficerDirectoryEntry } from '../types/plantation';

export interface ResolvedSaaoSelection {
  saao: SaaoDirectoryEntry;
  blockId?: string;
  blockName?: string;
  union?: string;
}

/** Search-as-you-type SAAO lookup. Selecting a result gives the caller
 *  everything needed to auto-fill Block/Union alongside name+mobile. */
export function useSaaoDirectory() {
  const [query, setQuery] = useState('');

  const results = useMemo<SaaoDirectoryEntry[]>(() => searchSaao(query), [query]);

  const resolve = (saao: SaaoDirectoryEntry): ResolvedSaaoSelection => {
    const { block, parentUnit } = resolveSaaoLocation(saao);
    return {
      saao,
      blockId: block?.id,
      blockName: block?.name,
      union: parentUnit?.name,
    };
  };

  return { query, setQuery, results, resolve, ready: isDirectoryReady() };
}

/** Monitoring Officer candidates for a given upazila — up to 4
 *  (1 UAO + 2 AEO + 1 AAO). Not an autofill; the field officer picks
 *  whichever one actually supervised the entry. */
export function useMonitoringOfficerDirectory(upazila: string) {
  const candidates = useMemo<MonitoringOfficerDirectoryEntry[]>(
    () => (upazila ? getMonitoringOfficersByUpazila(upazila) : []),
    [upazila]
  );
  return { candidates, ready: isDirectoryReady() };
}
