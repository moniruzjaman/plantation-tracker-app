/**
 * Vercel serverless function: GET /api/audit/export-geojson
 *
 * Exports all synced submissions with valid coordinates as a GeoJSON
 * FeatureCollection. Used by external tools (QGIS, kepler.gl, Mapbox
 * Studio, etc.) for offline analysis.
 */

import { prisma } from '../_lib/prisma';
import { setCorsHeaders } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const submissions = await prisma.submission.findMany({
      where: { latitude: { not: 0 }, longitude: { not: 0 }, synced: true },
      select: {
        id: true,
        clientUid: true,
        district: true,
        upazila: true,
        latitude: true,
        longitude: true,
        plantationDate: true,
        vm0047HealthStatus: true,
        trackingMethod: true,
        treeSerial: true,
        seedlings: { select: { speciesName: true, count: true } },
      },
    });

    const features = submissions.map((s: any) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [s.longitude, s.latitude],
      },
      properties: {
        id: s.clientUid,
        district: s.district,
        upazila: s.upazila,
        plantationDate: s.plantationDate,
        healthStatus: s.vm0047HealthStatus,
        trackingMethod: s.trackingMethod,
        treeSerial: s.treeSerial,
        seedlings: s.seedlings,
      },
    }));

    const geojson = {
      type: 'FeatureCollection' as const,
      features,
      metadata: {
        source: 'Plantation Tracker VM0047',
        generatedAt: new Date().toISOString(),
        featureCount: features.length,
      },
    };

    res.status(200).json(geojson);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
