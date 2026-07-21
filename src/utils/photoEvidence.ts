/**
 * Photo evidence utilities — VM0047 Compliant
 *
 * Compresses every photo client-side before upload. Supports two modes:
 * - Standard (existing): 1280px long edge, JPEG q~0.68 (~80-150KB)
 * - VM0047 Revisit: 640×480, JPEG q~0.50 (~20-40KB) for low-bandwidth areas
 *
 * Also computes a SHA-256 hash of the compressed bytes so any later
 * swap/edit of a checkpoint photo is provable.
 *
 * VM0047 Photo Protocol: Each monitoring visit requires exactly 3 photos:
 * 1. QR Tag close-up — proves the specific tree's identity
 * 2. Full tree photo — shows overall health and growth
 * 3. Context photo — shows surrounding farm/landscape
 */

import type { PhotoType } from '../types/plantation';

// ---------- Compression Settings ----------

const STANDARD_MAX_DIMENSION = 1280;
const STANDARD_JPEG_QUALITY = 0.68;

/** VM0047 revisit compression: 640×480, 50% quality for low-bandwidth */
const VM0047_MAX_DIMENSION = 640;
const VM0047_JPEG_QUALITY = 0.50;

export interface CompressedPhoto {
  blob: Blob;
  url: string; // object URL for immediate preview; caller uploads `blob`
  sha256: string;
  sizeBytes: number;
  width: number;
  height: number;
}

export interface CompressOptions {
  /** Use VM0047 revisit compression (640×480, 50% quality) */
  vm0047Revisit?: boolean;
  /** Photo type for VM0047 evidence protocol */
  photoType?: PhotoType;
  /** Override max dimension (pixels) */
  maxDimension?: number;
  /** Override JPEG quality (0-1) */
  jpegQuality?: number;
}

/**
 * Compress a photo with optional VM0047 settings.
 */
export async function compressPhoto(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<CompressedPhoto> {
  const maxDim = options.maxDimension
    ?? (options.vm0047Revisit ? VM0047_MAX_DIMENSION : STANDARD_MAX_DIMENSION);
  const quality = options.jpegQuality
    ?? (options.vm0047Revisit ? VM0047_JPEG_QUALITY : STANDARD_JPEG_QUALITY);

  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > height && width > maxDim) {
    height = Math.round((height * maxDim) / width);
    width = maxDim;
  } else if (height > maxDim) {
    width = Math.round((width * maxDim) / height);
    height = maxDim;
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
      quality
    )
  );

  const sha256 = await hashBlob(blob);
  const url = URL.createObjectURL(blob);

  return { blob, url, sha256, sizeBytes: blob.size, width, height };
}

/** Backward-compatible alias — uses standard compression settings. */
export { compressPhoto as compressPhotoStandard };

/**
 * Compress a photo using VM0047 revisit settings (640×480, 50% quality).
 * Produces ~20-40KB files suitable for slow 2G/3G connections.
 */
export async function compressPhotoVM0047(file: File | Blob, photoType?: PhotoType): Promise<CompressedPhoto> {
  return compressPhoto(file, { vm0047Revisit: true, photoType });
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

// ---------- VM0047 Photo Type Helpers ----------

/** VM0047 required photo types for a monitoring revisit */
export const VM0047_REQUIRED_PHOTO_TYPES: PhotoType[] = [
  'qr_closeup',
  'full_tree',
  'context',
];

/** Bengali labels for photo types */
export const PHOTO_TYPE_LABELS: Record<PhotoType, { bn: string; en: string; desc: string }> = {
  qr_closeup: {
    bn: 'কিউআর কোড ক্লোজ-আপ',
    en: 'QR Tag Close-up',
    desc: 'গাছের গোড়ায় লাগানো QR ট্যাগের স্পষ্ট ছবি',
  },
  full_tree: {
    bn: 'পুরো গাছের ছবি',
    en: 'Full Tree Photo',
    desc: 'গাছের গোড়া থেকে মাথা পর্যন্ত সম্পূর্ণ ছবি',
  },
  context: {
    bn: 'পারিপার্শ্বিক ছবি',
    en: 'Context / Surroundings',
    desc: 'গাছের চারপাশের খামার/ল্যান্ডস্কেপের ছবি',
  },
  general: {
    bn: 'সাধারণ ছবি',
    en: 'General Photo',
    desc: 'মান নির্ধারণ পূর্বের সাধারণ ছবি (লেগাসি)',
  },
};

/**
 * Check if a set of photos satisfies VM0047 evidence requirements.
 * Returns missing photo types.
 */
export function getMissingVM0047Photos(existingTypes: PhotoType[]): PhotoType[] {
  const present = new Set(existingTypes);
  return VM0047_REQUIRED_PHOTO_TYPES.filter(t => !present.has(t));
}