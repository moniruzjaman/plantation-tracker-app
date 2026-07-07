/**
 * App share helper — Web Share API with clipboard + WhatsApp fallbacks.
 *
 * The share payload includes the app name, a short Bengali description, and
 * the current origin (so dev/staging/prod all share the correct URL). On
 * browsers without `navigator.share` (desktop Chrome/Firefox), we copy the
 * text+URL to the clipboard and also offer a WhatsApp share link.
 */

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

/** Returns the app's canonical URL (origin only, no path/query). */
export function getAppUrl(): string {
  if (typeof window === 'undefined') return 'https://plantation-tracker.app';
  return window.location.origin;
}

/** Default share payload for the plantation tracker app. */
export function getDefaultSharePayload(): SharePayload {
  return {
    title: 'বৃক্ষরোপণ ট্র্যাকার',
    text: '৫ বছরে ২৫ কোটি বৃক্ষ রোপণ; জাতীয় মহা উদ্যোগে সম্পৃক্ত হতে প্রয়োজনীয় তথ্য। ইনস্টল করুন ও বৃক্ষরোপণ তথ্য জমা দিন।',
    url: getAppUrl(),
  };
}

/**
 * Shares via Web Share API if available, otherwise copies to clipboard.
 * Returns 'shared' | 'copied' | 'cancelled' | 'failed'.
 */
export async function shareApp(payload: SharePayload = getDefaultSharePayload()): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  // Web Share API (mobile + Chrome desktop 93+)
  if (navigator.share) {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.toLowerCase().includes('cancel')) {
        return 'cancelled';
      }
      // Fall through to clipboard fallback
    }
  }

  // Clipboard fallback
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
      return 'copied';
    } catch {
      // Fall through to legacy fallback
    }
  }

  // Legacy execCommand fallback (very old browsers)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = `${payload.text}\n${payload.url}`;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok ? 'copied' : 'failed';
  } catch {
    return 'failed';
  }
}

/** Opens a WhatsApp share URL with pre-filled text. */
export function shareViaWhatsApp(payload: SharePayload = getDefaultSharePayload()): void {
  const text = encodeURIComponent(`${payload.text}\n${payload.url}`);
  window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
}

/** Returns true if the device likely has WhatsApp installed (rough heuristic). */
export function canShareViaWhatsApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  // WhatsApp is primarily a mobile app; on desktop the wa.me link opens WhatsApp Web
  return /android|iphone|ipad|ipod/.test(ua) || true; // always allow — desktop falls back to WhatsApp Web
}
