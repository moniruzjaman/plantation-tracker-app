import type { TokenTransaction } from '../types';

const KEY = 'token_transaction_history';
const MAX_ENTRIES = 200; // keep it bounded; this is a UI convenience log, not the ledger of record

export function getTokenHistory(): TokenTransaction[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TokenTransaction[]) : [];
  } catch {
    return [];
  }
}

export function logTransaction(type: 'xp' | 'token', amount: number, reason: string): void {
  const history = getTokenHistory();
  const entry: TokenTransaction = {
    id: crypto.randomUUID(),
    type,
    amount,
    reason,
    timestamp: new Date().toISOString(),
  };
  const updated = [entry, ...history].slice(0, MAX_ENTRIES);
  localStorage.setItem(KEY, JSON.stringify(updated));
}
