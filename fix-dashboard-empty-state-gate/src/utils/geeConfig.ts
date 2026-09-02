/**
 * Google Earth Engine (GEE) — Sentinel-2 NDVI configuration constants.
 *
 * Single source of truth for the "Satellite NDVI & Canopy Growth Tracker"
 * panel on the Map page. Consumed by NDVISimulatorPanel.tsx and any future
 * GEE integration code.
 *
 * Aligned with the project spec:
 *   - Endpoint:  earthengine.googleapis.com v1alpha
 *   - Dataset:   COPERNICUS/S2_SR_HARMONIZED (Sentinel-2 10m MSI)
 *   - Bands:     B4, B3, B2 (Red, Green, Blue) — True Color Composite
 *   - Cloud:     CLOUDY_PIXEL_PERCENTAGE < 10%
 *   - Reference region: Kurigram bounding box (Bangladesh)
 */

// ---------- Cloud / API endpoint ----------

/** GEE REST endpoint host shown in the UI badge. Real requests are proxied via /api/gee-ndvi. */
export const GEE_ENDPOINT = 'earthengine.googleapis.com';
export const GEE_API_VERSION = 'v1alpha';

// ---------- Sentinel-2 dataset ----------

export const GEE_DATASET = {
  id: 'COPERNICUS/S2_SR_HARMONIZED',
  shortName: 'Sentinel-2',
  resolution: '10m MSI',
  /** Default cloud-cover threshold for the CLOUDY_PIXEL_PERCENTAGE filter. */
  defaultCloudLimit: 10,
};

// ---------- Band rendering ----------

export type BandComboId = 'true_color' | 'false_color' | 'ndvi';

export interface BandCombo {
  id: BandComboId;
  labelBn: string;
  labelEn: string;
  bands: string[]; // GEE band ids in display order
  descriptionBn: string;
}

export const BAND_COMBOS: BandCombo[] = [
  {
    id: 'true_color',
    labelBn: 'প্রকৃত রঙ (True Color)',
    labelEn: 'True Color Composite',
    bands: ['B4', 'B3', 'B2'], // Red-Green-Blue
    descriptionBn: 'মানুষের চোখে দেখার মতো প্রাকৃতিক রঙ — B4, B3, B2 (RGB)',
  },
  {
    id: 'false_color',
    labelBn: 'কৃত্রিম রঙ (False Color)',
    labelEn: 'False Color Composite',
    bands: ['B8', 'B4', 'B3'], // NIR-Red-Green — vegetation pops in red
    descriptionBn: 'উদ্ভিদ সবুজকে লাল রঙে দেখায় — B8, B4, B3 (NIR-Red-Green)',
  },
  {
    id: 'ndvi',
    labelBn: 'NDVI কম্পোজিট',
    labelEn: 'NDVI Composite',
    bands: ['B8', 'B4'], // (NIR - Red) / (NIR + Red)
    descriptionBn: 'স্বাভাবিক পার্থক্য উদ্ভিদ সূচক — (B8 - B4) / (B8 + B4)',
  },
];

// ---------- NDVI canopy scale (4 bands per spec) ----------

export interface NDVIScaleBand {
  min: number;
  max: number;
  labelBn: string;
  color: string;
}

/**
 * NDVI canopy classification used by the simulator panel legend.
 * Matches the project spec exactly:
 *   +0.65 → +0.85 : নিবিড় বনাঞ্চল (Dense forest)
 *   +0.40 → +0.65 : মাঝারি চারা (Moderate canopy)
 *   +0.15 → +0.40 : নবজাতক (Newborn / young seedling)
 *   -0.10 → +0.15 : শুষ্ক / অনাবাদী (Bare / non-cultivated)
 */
export const NDVI_SCALE_BANDS: NDVIScaleBand[] = [
  { min: 0.65, max: 0.85, labelBn: 'নিবিড় বনাঞ্চল', color: '#14532d' },
  { min: 0.40, max: 0.65, labelBn: 'মাঝারি চারা', color: '#16a34a' },
  { min: 0.15, max: 0.40, labelBn: 'নবজাতক', color: '#a3e635' },
  { min: -0.10, max: 0.15, labelBn: 'শুষ্ক / অনাবাদী', color: '#ca8a04' },
];

/** Returns the canopy stage label (Bengali) for a given NDVI value. */
export function ndviStageLabelBn(ndvi: number): string {
  for (const band of NDVI_SCALE_BANDS) {
    if (ndvi >= band.min && ndvi <= band.max) return band.labelBn;
  }
  if (ndvi > 0.85) return NDVI_SCALE_BANDS[0].labelBn;
  return NDVI_SCALE_BANDS[NDVI_SCALE_BANDS.length - 1].labelBn;
}

/** Returns the canopy stage color for a given NDVI value. */
export function ndviStageColor(ndvi: number): string {
  for (const band of NDVI_SCALE_BANDS) {
    if (ndvi >= band.min && ndvi <= band.max) return band.color;
  }
  if (ndvi > 0.85) return NDVI_SCALE_BANDS[0].color;
  return NDVI_SCALE_BANDS[NDVI_SCALE_BANDS.length - 1].color;
}

// ---------- Reference region (Kurigram bounding box, Bangladesh) ----------

/** Kurigram bounding box polygon used by the GEE sample script and the panel. */
export const KURIGRAM_REGION: [number, number][] = [
  [89.50, 25.40],
  [89.90, 25.40],
  [89.90, 26.20],
  [89.50, 26.20],
];

/** Center coordinate of the Kurigram reference region. */
export const KURIGRAM_CENTER: { lng: number; lat: number } = {
  lng: 89.6582,
  lat: 25.8113,
};

// ---------- Sample GEE JavaScript (Code Editor preview) ----------

/**
 * Read-only GEE JavaScript sample shown in the panel's "Code Editor" section.
 * Mirrors the spec exactly: Sentinel-2 True Color (RGB 4-3-2) Composite over
 * the Kurigram region with a cloud filter < 10%.
 */
export const GEE_SAMPLE_SCRIPT = `// GEE Sentinel-2 True Color (RGB 4-3-2) Composite
var region = ee.Geometry.Polygon([[
  [89.50, 25.40], [89.90, 25.40],
  [89.90, 26.20], [89.50, 26.20]
]]);

var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
  .filterBounds(region)
  .filterDate('2026-01-01', '2026-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10));

var rgbComp = s2.median().clip(region);
var vis = {bands: ['B4', 'B3', 'B2'], min: 0, max: 3000};
Map.centerObject(region, 9);
Map.addLayer(rgbComp, vis, 'Sentinel-2 True Color');`;

// ---------- Platform log message templates ----------

/**
 * Sequential log lines emitted by the simulator panel when a GEE pipeline run is
 * triggered. They are streamed into the "Platform Logs" section to give the
 * user the feel of a real cloud-pipeline execution.
 *
 * Two variants are provided:
 *   - GEE_PIPELINE_LOG_STEPS: the original GEE (Sentinel-2) cloud-pipeline
 *     sequence — used as a fallback / display-only template when the user
 *     explicitly triggers the (mock) GEE cloud endpoint.
 *   - GIBS_REALTIME_LOG_STEPS: the actual free realtime pipeline used by
 *     default — NASA GIBS MODIS Terra NDVI 8-Day tile sampling at each
 *     seed plantation coordinate. No API key, no auth, no billing.
 */
export const GEE_PIPELINE_LOG_STEPS: { level: 'info' | 'auth' | 'success' | 'process' | 'render'; message: string }[] = [
  { level: 'info', message: 'Connecting to Google Earth Engine gateway...' },
  { level: 'auth', message: 'Requesting authorization with Service Account...' },
  { level: 'success', message: 'OAuth authentication successful!' },
  { level: 'info', message: 'ee.Serializer.serialize() pushed to endpoint.' },
  { level: 'process', message: 'Running server-side reducers on Copernicus S2' },
  { level: 'process', message: `Geometry: Kurigram bounding box center: [${KURIGRAM_CENTER.lng}, ${KURIGRAM_CENTER.lat}]` },
  { level: 'process', message: 'Applied filter: Clouds < 10% / median composite selected.' },
  { level: 'process', message: 'MapID generated: projects/earthengine-public/maps/kurigram-raster-truecolor' },
  { level: 'render', message: 'Rendering GEE TileLayers on map canvas...' },
];

/**
 * Free realtime NDVI pipeline log template — uses NASA GIBS public raster
 * tiles (no API key, no auth). The `${...}` placeholders are interpolated by
 * the panel at runtime so the log reflects the actual sampled coordinates,
 * the GIBS date, the number of plantation sites, and the computed mean NDVI.
 */
export const GIBS_REALTIME_LOG_STEPS: { level: 'info' | 'auth' | 'success' | 'process' | 'render'; message: string }[] = [
  { level: 'info', message: 'Initializing free NASA GIBS realtime pipeline...' },
  { level: 'success', message: 'No auth required — public WMTS endpoint' },
  { level: 'info', message: 'Source: MODIS_Terra_NDVI_8Day / GoogleMapsCompatible_Level9' },
  { level: 'process', message: 'Loading seed plantation coordinates from workbook...' },
  { level: 'process', message: 'Projecting (lat, lng) → Web Mercator tile coords @ z=9' },
  { level: 'process', message: 'Fetching 256×256 GIBS raster tiles (chunked, CORS-enabled)' },
  { level: 'process', message: 'Sampling pixel greenness ratio (G − R) / (G + R) per site' },
  { level: 'process', message: 'Aggregating mean NDVI across all plantation sites' },
  { level: 'render', message: 'Rendering live NDVI markers on map canvas...' },
];
