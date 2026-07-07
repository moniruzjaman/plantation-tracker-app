/**
 * Free realtime NDVI sampler — no API key, no auth, no billing.
 *
 * Source: NASA GIBS (Global Imagery Browse Services) — MODIS Terra NDVI 8-Day
 * raster tiles, public, CORS-enabled, updated every 8 days.
 *
 * URL pattern (already used by the map layer in mapHelper.ts):
 *   https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/
 *     MODIS_Terra_NDVI_8Day/default/{DATE}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png
 *
 * Strategy:
 *   1. Convert each (lat, lng) to Web Mercator tile coordinates at zoom 9.
 *   2. Fetch the corresponding 512×512 GIBS PNG via fetch() + canvas.
 *   3. Read pixel RGB. GIBS NDVI tiles use a yellow→green palette where:
 *        - bare soil (low NDVI) ≈ tan/brown (R high, G low, B low)
 *        - dense canopy (high NDVI) ≈ dark green (R low, G high, B low)
 *      We approximate NDVI from green dominance:
 *        ndvi ≈ clamp((G - R) / (G + R + 1), -0.1, 0.9)
 *      This is a "greenness index" — it is NOT a true NDVI from spectral bands,
 *      but for a free no-auth solution it tracks canopy density closely enough
 *      for the simulator panel's projection model. The exact value is less
 *      important than the trend across years and across plantations.
 *   4. Average across all sampled plantation coordinates → region mean NDVI.
 *
 * Note: GIBS also offers a WMTS REST endpoint and a tiled WMS — we use the
 * simple XYZ PNG endpoint because it's the easiest to consume from a browser.
 */

import { SEED_PLANTATIONS } from '../data/seedPlantations';
import { gibsDate } from './mapHelper';

// ---------- Tile math ----------

/** Web Mercator projection constants. */
const TILE_SIZE = 256; // GIBS GoogleMapsCompatible_Level9 uses standard 256×256 tiles
const EARTH_RADIUS_M = 6378137;
const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS_M; // ≈ 40,075,016 m
const INITIAL_RESOLUTION = EARTH_CIRCUMFERENCE / TILE_SIZE; // m/px at zoom 0 (= 156543.03 m/px)
const ORIGIN_SHIFT = EARTH_CIRCUMFERENCE / 2; // meters

interface TileCoord {
  z: number;
  x: number;
  y: number;
  pixelX: number; // 0..TILE_SIZE-1
  pixelY: number;
}

/** Projects (lat, lng) → Web Mercator tile + pixel coords at the given zoom. */
function latLngToTile(lat: number, lng: number, zoom: number): TileCoord {
  // To Web Mercator meters
  const mx = (lng * ORIGIN_SHIFT) / 180;
  const my = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180);
  const myMeters = (my * ORIGIN_SHIFT) / 180;

  const res = INITIAL_RESOLUTION / Math.pow(2, zoom);
  const px = (mx + ORIGIN_SHIFT) / res;
  const py = (ORIGIN_SHIFT - myMeters) / res;

  const tileX = Math.floor(px / TILE_SIZE);
  const tileY = Math.floor(py / TILE_SIZE);
  const pixelX = Math.floor(px - tileX * TILE_SIZE);
  const pixelY = Math.floor(py - tileY * TILE_SIZE);

  return { z: zoom, x: tileX, y: tileY, pixelX, pixelY };
}

// ---------- GIBS NDVI fetch + pixel sample ----------

interface SampledNDVI {
  ndvi: number;
  rgb: [number, number, number];
  tileUrl: string;
}

/**
 * Fetches the GIBS NDVI tile that contains (lat, lng), reads the pixel at the
 * coordinate, and returns a greenness-derived NDVI estimate.
 *
 * Uses zoom 9 (≈ 305 m/px) which matches the NASA GIBS MODIS Terra NDVI 8-Day
 * product's native resolution (~250 m at the equator, served as 256×256 tiles).
 *
 * @param date ISO date string (YYYY-MM-DD). Defaults to current GIBS date.
 */
export async function sampleNDVIAt(
  lat: number,
  lng: number,
  zoom = 9,
  date?: string,
): Promise<SampledNDVI> {
  const d = date || gibsDate();
  const tc = latLngToTile(lat, lng, zoom);
  const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${d}/GoogleMapsCompatible_Level9/${tc.z}/${tc.y}/${tc.x}.png`;

  // Fetch → blob → ImageBitmap → canvas → ImageData
  const resp = await fetch(url, { mode: 'cors', cache: 'force-cache' });
  if (!resp.ok) {
    throw new Error(`GIBS tile fetch failed: HTTP ${resp.status}`);
  }
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);

  // Draw to a 256×256 canvas (matches GIBS GoogleMapsCompatible_Level9 tile size).
  // Prefer OffscreenCanvas when available (workers / no DOM overhead), fall back
  // to a regular HTMLCanvasElement otherwise. We type the context loosely as
  // `any` because the OffscreenCanvasRenderingContext2D and CanvasRenderingContext2D
  // have the same drawImage/getImageData signatures but TS treats them as
  // incompatible union members.
  let ctx: any = null;
  if (typeof OffscreenCanvas !== 'undefined') {
    const oc = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    ctx = oc.getContext('2d', { willReadFrequently: true });
  } else {
    const c = document.createElement('canvas');
    c.width = TILE_SIZE;
    c.height = TILE_SIZE;
    ctx = c.getContext('2d', { willReadFrequently: true });
  }
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, TILE_SIZE, TILE_SIZE);

  const data = ctx.getImageData(tc.pixelX, tc.pixelY, 1, 1).data;
  const r = data[0];
  const g = data[1];
  const b = data[2];
  const rgb: [number, number, number] = [r, g, b];

  // Greenness-derived NDVI estimate.
  // GIBS NDVI palette: deep blue (water / -0.1) → tan (bare / 0.0) → yellow
  // (grass / 0.3) → green (forest / 0.6) → dark green (dense forest / 0.9).
  // A simple (G − R) / (G + R) greenness ratio maps this palette closely.
  const denom = g + r + 1;
  const greenness = (g - r) / denom;
  const ndvi = Math.max(-0.1, Math.min(0.9, greenness));

  return { ndvi: parseFloat(ndvi.toFixed(2)), rgb, tileUrl: url };
}

// ---------- Region aggregation ----------

export interface RegionNDVIResult {
  meanNdvi: number;
  sampledCount: number;
  failedCount: number;
  /** Per-record sample results, useful for map markers + log lines. */
  samples: { sl: number; district: string; speciesName: string; latitude: number; longitude: number; ndvi: number | null; tileUrl?: string }[];
  /** GIBS date string used for the fetch. */
  date: string;
  /** Average sample took this many ms (for the platform logs). */
  elapsedMs: number;
}

/**
 * Samples realtime NDVI at every seed plantation coordinate and returns the
 * mean + per-site breakdown. Network calls are batched in chunks of 6 to be
 * polite to the GIBS endpoint (it's free but shared).
 *
 * @param date Optional ISO date override. Defaults to current GIBS date.
 * @param maxSites Optional cap on the number of sites to sample (for low-end
 *                  mobile devices or data-saver mode). Defaults to all seed sites.
 */
export async function sampleRegionNDVI(
  date?: string,
  maxSites?: number,
): Promise<RegionNDVIResult> {
  const d = date || gibsDate();
  const t0 = performance.now();

  const sites = (maxSites && maxSites > 0
    ? SEED_PLANTATIONS.slice(0, maxSites)
    : SEED_PLANTATIONS
  ).filter((p) => p.latitude !== 0 && p.longitude !== 0);

  const CHUNK = 6;
  const samples: RegionNDVIResult['samples'] = [];
  let failed = 0;

  for (let i = 0; i < sites.length; i += CHUNK) {
    const chunk = sites.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map((p) => sampleNDVIAt(p.latitude, p.longitude, 9, d)),
    );
    results.forEach((r, idx) => {
      const p = chunk[idx];
      if (r.status === 'fulfilled') {
        samples.push({
          sl: p.sl,
          district: p.district,
          speciesName: p.speciesName,
          latitude: p.latitude,
          longitude: p.longitude,
          ndvi: r.value.ndvi,
          tileUrl: r.value.tileUrl,
        });
      } else {
        samples.push({
          sl: p.sl,
          district: p.district,
          speciesName: p.speciesName,
          latitude: p.latitude,
          longitude: p.longitude,
          ndvi: null,
        });
        failed++;
      }
    });
  }

  const validSamples = samples.filter((s) => s.ndvi !== null) as { ndvi: number }[];
  const meanNdvi = validSamples.length > 0
    ? parseFloat((validSamples.reduce((sum, s) => sum + s.ndvi, 0) / validSamples.length).toFixed(2))
    : 0;

  return {
    meanNdvi,
    sampledCount: validSamples.length,
    failedCount: failed,
    samples,
    date: d,
    elapsedMs: Math.round(performance.now() - t0),
  };
}

// ---------- Cache (in-memory, session-scoped) ----------

let cachedResult: RegionNDVIResult | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — GIBS updates every 8 days so this is conservative

/**
 * Returns the cached region NDVI result if it's less than CACHE_TTL_MS old,
 * otherwise triggers a fresh fetch. Used by the simulator panel so switching
 * projection years doesn't refetch the satellite raster repeatedly.
 */
export async function getOrFetchRegionNDVI(forceRefresh = false): Promise<RegionNDVIResult> {
  if (!forceRefresh && cachedResult && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedResult;
  }
  const result = await sampleRegionNDVI();
  cachedResult = result;
  cacheTimestamp = Date.now();
  return result;
}

/** Clears the in-memory cache. Call this when the user manually re-runs the pipeline. */
export function clearRegionNDVICache(): void {
  cachedResult = null;
  cacheTimestamp = 0;
}
