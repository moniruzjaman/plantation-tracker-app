import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OfflinePlantationDashboard from '../OfflinePlantationDashboard';

/**
 * A real render, not just a logic test -- this is the class of bug
 * (component crashes on mount, blank page) that pure-function unit
 * tests can never catch. Every dependency the component touches on
 * mount (IndexedDB via lib/db.ts, /api/sheet/list via
 * useSheetPlantations) is mocked so this runs deterministically without
 * a real backend, but nothing about the component itself is mocked --
 * if it throws during render, this test fails exactly the way the real
 * app would show a blank page.
 */

beforeEach(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/sheet/list')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'disabled' }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
});

describe('OfflinePlantationDashboard', () => {
  it('renders without throwing when there is no local data and the sheet sync is disabled', async () => {
    render(<OfflinePlantationDashboard />);
    // Wait for the async submissions-fetch + sheet-fetch effects to settle.
    await waitFor(() => {
      expect(document.body.textContent).not.toBe('');
    });
    // If the component crashed during render, nothing below this line
    // would ever run -- React Testing Library throws on an uncaught
    // render error rather than silently producing a blank tree.
    expect(document.querySelector('[class]')).not.toBeNull();
  });
});
