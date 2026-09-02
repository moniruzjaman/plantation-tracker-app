/**
 * VM0047 QR Code Tag Generation
 *
 * Generates waterproof- QR code data URLs for individual tree tracking.
 * Each QR code encodes the tree serial, species, GPS coordinates, and
 * submitter reference — scannable in the field by monitoring officers.
 *
 * Uses the `qrcode` library (client-side, no external API needed).
 */

import QRCode from 'qrcode';

export interface QRTagPayload {
  /** Tree serial ID, e.g. "BD-TREE-100024" */
  treeSerial: string;
  /** Species name in Bengali */
  species: string;
  /** ISO date of planting */
  plantingDate: string;
  /** Planting GPS latitude */
  lat: number;
  /** Planting GPS longitude */
  lon: number;
  /** Submitter reference (mobile or job ID) */
  submitterRef: string;
  /** App version for compatibility tracking */
  version: string;
}

export interface QRTagResult {
  /** Base64 data URL (data:image/png;base64,...) — embeddable in <img> */
  dataURL: string;
  /** The encoded payload for verification */
  payload: QRTagPayload;
  /** Serial number for reference */
  treeSerial: string;
}

/**
 * Generate a QR code data URL for a tree tag.
 *
 * @param data - The payload to encode in the QR code
 * @param width - Image width in pixels (default 300, good for print at ~3cm)
 * @returns Object with dataURL, payload, and treeSerial
 */
export async function generateQRTag(
  data: QRTagPayload,
  width: number = 300
): Promise<QRTagResult> {
  const payload: QRTagPayload = {
    ...data,
    version: '2.0-vm0047',
  };

  const jsonStr = JSON.stringify(payload);

  const dataURL = await QRCode.toDataURL(jsonStr, {
    width,
    margin: 2,
    errorCorrectionLevel: 'M', // Medium — survives ~15% damage (waterproof tag wear)
    color: {
      dark: '#1a3a2a',  // Dark green (forestry branding)
      light: '#ffffff',
    },
  });

  return {
    dataURL,
    payload,
    treeSerial: data.treeSerial,
  };
}

/**
 * Generate a compact QR code for field use (smaller, faster to scan).
 * Uses lower error correction and smaller size for quick scans.
 */
export async function generateCompactQRTag(
  data: QRTagPayload,
  width: number = 200
): Promise<QRCodeResult> {
  const payload: QRTagPayload = {
    treeSerial: data.treeSerial,
    species: data.species,
    lat: data.lat,
    lon: data.lon,
    submitterRef: data.submitterRef,
    version: '2.0-vm0047',
    plantingDate: data.plantingDate,
  };

  return QRCode.toDataURL(JSON.stringify(payload), {
    width,
    margin: 1,
    errorCorrectionLevel: 'L', // Low — smaller code, faster scan
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// Re-export the type for convenience
type QRCodeResult = string;