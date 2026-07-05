/**
 * Photo evidence utilities.
 *
 * Compresses every photo client-side to ~80–150KB before it ever leaves
 * the device (1280px long edge, JPEG q~0.68) — regardless of source
 * camera resolution, so storage cost stays predictable at scale
 * (~30GB/year at 100k entries/year x 2 photos x 150KB). Also computes a
 * SHA-256 hash of the compressed bytes so any later swap/edit of a
 * checkpoint photo is provable — the hash simply won't match anymore.
 *
 * The compressed copy is what gets stored centrally (system of record).
 * Keeping the original on-device as a cache is fine for offline viewing,
 * but the server copy is the one anything long-term (e.g. a carbon-credit
 * claim years later) should rely on — device storage can't be trusted to
 * survive lost phones, factory resets, or officer transfers over a
 * 3–5 year horizon.
 */

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.68;

export interface CompressedPhoto {
  blob: Blob;
  url: string; // object URL for immediate preview; caller uploads `blob`
  sha256: string;
  sizeBytes: number;
}

export async function compressPhoto(file: File | Blob): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > height && width > MAX_DIMENSION) {
    height = Math.round((height * MAX_DIMENSION) / width);
    width = MAX_DIMENSION;
  } else if (height > MAX_DIMENSION) {
    width = Math.round((width * MAX_DIMENSION) / height);
    height = MAX_DIMENSION;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Photo compression failed'))),
      'image/jpeg',
      JPEG_QUALITY
    )
  );

  const sha256 = await hashBlob(blob);
  const url = URL.createObjectURL(blob);

  return { blob, url, sha256, sizeBytes: blob.size };
}

export async function hashBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Haversine distance in meters — used to flag a checkpoint photo taken
 *  too far (~>15m) from the original planting-day GPS point, so a later
 *  revisit can't be substituted from an unrelated site. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const CHECKPOINT_GEOFENCE_METERS = 15;
