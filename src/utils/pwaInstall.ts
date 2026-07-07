/**
 * Global PWA install prompt manager.
 *
 * The browser fires `beforeinstallprompt` at most once per page load and only
 * under specific engagement criteria. PWAInstaller.tsx captures it, but the
 * event is stored in local component state — unreachable from other parts of
 * the UI (e.g., the Profile page's "Install App" button).
 *
 * This module bridges that gap by:
 *   1. Listening for `beforeinstallprompt` and storing the event in a module-
 *      level variable + broadcasting a custom `pwa-install-available` event.
 *   2. Exposing `triggerPWAInstall()` so any component can call the native
 *      install prompt.
 *   3. Exposing `isPWAInstallable()` + `isPWAInstalled()` for button states.
 *
 * Usage:
 *   import { triggerPWAInstall, usePWAInstallState } from '../utils/pwaInstall';
 *   const { canInstall, isInstalled } = usePWAInstallState();
 *   <button onClick={triggerPWAInstall} disabled={!canInstall}>Install</button>
 */

import { useEffect, useState } from 'react';

let deferredPrompt: any = null;
let installed = false;

/** Initialize the global listener. Safe to call multiple times. */
let initialized = false;
export function initPWAInstallListener() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Detect already-installed state
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  ) {
    installed = true;
  }
  try {
    if (localStorage.getItem('pwa_installed_status') === 'true') {
      installed = true;
    }
  } catch {}

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    installed = false;
    window.dispatchEvent(new CustomEvent('pwa-install-available'));
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    try { localStorage.setItem('pwa_installed_status', 'true'); } catch {}
    window.dispatchEvent(new CustomEvent('pwa-install-state-change'));
  });
}

/**
 * Triggers the native PWA install prompt.
 * Returns the user's choice ('accepted' | 'dismissed' | 'unavailable').
 */
export async function triggerPWAInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  try {
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      installed = true;
      deferredPrompt = null;
      try { localStorage.setItem('pwa_installed_status', 'true'); } catch {}
      window.dispatchEvent(new CustomEvent('pwa-install-state-change'));
    }
    return outcome;
  } catch {
    return 'dismissed';
  }
}

/** Returns true if the browser has captured a `beforeinstallprompt` event. */
export function isPWAInstallable(): boolean {
  return !!deferredPrompt;
}

/** Returns true if the app is already running in standalone/installed mode. */
export function isPWAInstalled(): boolean {
  return installed;
}

/**
 * React hook that subscribes to install-state changes.
 * Returns `{ canInstall, isInstalled }` and re-renders on change.
 */
export function usePWAInstallState(): { canInstall: boolean; isInstalled: boolean } {
  const [state, setState] = useState({ canInstall: isPWAInstallable(), isInstalled: isPWAInstalled() });

  useEffect(() => {
    initPWAInstallListener();
    const update = () => setState({ canInstall: isPWAInstallable(), isInstalled: isPWAInstalled() });
    window.addEventListener('pwa-install-available', update);
    window.addEventListener('pwa-install-state-change', update);
    return () => {
      window.removeEventListener('pwa-install-available', update);
      window.removeEventListener('pwa-install-state-change', update);
    };
  }, []);

  return state;
}
