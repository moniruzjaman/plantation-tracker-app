/**
 * Polygon geometry helpers for orchard-mode geofencing. No equivalent
 * utility existed elsewhere in the repo to reuse, so this is new —
 * kept small and dependency-free rather than pulling in a full geo
 * library for three formulas.
 */

import { distanceMeters } from '../../../utils/photoEvidence';

export type LatLng = [number, number]; // [lat, lng]

/**
 * Area of a lat/lng polygon in square meters, via the shoelace formula
 * on an equirectangular projection (longitude scaled by cos(latitude)).
 * Accurate enough for plantation-sized parcels (a few hectares); would
 * need a proper geodesic area formula for anything continent-scale,
 * which is well outside what this module needs.
 */
export function polygonAreaSqMeters(points: LatLng[]): number {
  if (points.length < 3) return 0;

  const R = 6371000; // meters
  const avgLat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const latRad = (avgLat * Math.PI) / 180;

  // Project to a local planar approximation (meters from the first vertex).
  const toXY = ([lat, lng]: LatLng): [number, number] => {
    const x = ((lng - points[0][1]) * Math.PI * R * Math.cos(latRad)) / 180;
    const y = ((lat - points[0][0]) * Math.PI * R) / 180;
    return [x, y];
  };

  const xy = points.map(toXY);
  let area = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

/** Perimeter as the sum of haversine distances between consecutive
 *  vertices (closed ring — last vertex connects back to the first). */
export function polygonPerimeterMeters(points: LatLng[]): number {
  if (points.length < 2) return 0;
  let perimeter = 0;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    perimeter += distanceMeters(lat1, lng1, lat2, lng2);
  }
  return perimeter;
}

/** Simple vertex-average centroid — adequate for a compact plantation
 *  parcel; not the area-weighted centroid a very irregular shape would
 *  technically need. */
export function polygonCentroid(points: LatLng[]): { latitude: number; longitude: number } {
  if (points.length === 0) return { latitude: 0, longitude: 0 };
  const lat = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  return { latitude: lat, longitude: lng };
}
