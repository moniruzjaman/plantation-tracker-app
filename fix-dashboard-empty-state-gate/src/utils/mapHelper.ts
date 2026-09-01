/**
 * Shared GIS / map layer configuration.
 * Single source of truth for tile URLs, NDVI band definitions,
 * division center coordinates, and distance calculations.
 * Consumed by MapTab.tsx (native) and legacy-nursery.html (via global).
 */

// ---------- Tile layer definitions ----------

export type LayerId = 'ndvi' | 'evi' | 'satellite' | 'osm';

export interface TileConfig {
  url: string | ((date: string) => string);
  attribution: string;
}

/** Returns the NASA GIBS date string for tile URLs (current date minus 5 days). */
export function gibsDate(): string {
  return new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().split('T')[0];
}

/** Division-center fallback coordinates (lat, lng) for the map. */
export const DIVISION_CENTERS: Record<string, [number, number]> = {
  Dhaka: [23.8103, 90.4125],
  Chattogram: [22.3569, 91.7832],
  Rajshahi: [24.3745, 88.6042],
  Khulna: [22.8456, 89.5403],
  Barishal: [22.7010, 90.3535],
  Sylhet: [24.8949, 91.8687],
  Rangpur: [25.7508, 89.2467],
  Mymensingh: [24.7471, 90.4203],
};

/** NDVI legend bands for the overlay panel. */
export const NDVI_BANDS = [
  { label: 'নগ্ন ভূমি', color: '#c2410c', range: '< 0.1' },
  { label: 'বিরল', color: '#eab308', range: '0.1 – 0.3' },
  { label: 'মধ্যম', color: '#84cc16', range: '0.3 – 0.5' },
  { label: 'ঘন সবুজ', color: '#16a34a', range: '0.5 – 0.7' },
  { label: 'অতি ঘন', color: '#14532d', range: '> 0.7' },
];

/**
 * Returns tile config for a given layer. NDVI/EVI URLs are date-dependent
 * (NASA GIBS lags a few days), so they use a function.
 */
export function getLayerTiles(id: LayerId, date?: string): { url: string; attribution: string } {
  const d = date || gibsDate();
  switch (id) {
    case 'ndvi':
      return {
        url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
        attribution: 'NASA GIBS / MODIS Terra NDVI (250m, 8-day)',
      };
    case 'evi':
      return {
        url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_EVI_8Day/default/${d}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
        attribution: 'NASA GIBS / MODIS Terra EVI (250m, 8-day)',
      };
    case 'satellite':
      return {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Esri World Imagery',
      };
    case 'osm':
      return {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '\u00a9 OpenStreetMap contributors',
      };
  }
}

// ---------- Haversine distance ----------

/**
 * Calculates high-precision distance between two geographic coordinates (Haversine formula).
 * Returns distance in meters.
 */
export function calculateHaversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- Bengali number helper ----------

/** Converts a number to Bengali numeral string. Falls back to English on unsupported locales. */
export function toBnNum(num: number): string {
  const bnDigits = ['\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'];
  return num.toString().replace(/\d/g, (d) => bnDigits[parseInt(d)]);
}