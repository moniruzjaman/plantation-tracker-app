/**
 * Vercel serverless function: Handle audit routes
 *   GET    /api/audit/carbon-stock
 *   GET    /api/audit/export-geojson
 */

import { prisma } from '../_lib/prisma';
import { setCorsHeaders } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = Array.isArray(req.query.slug) ? req.query.slug : [req.query.slug].filter(Boolean);
  const pathSlug = slug.join('/'); // e.g., 'carbon-stock' or 'export-geojson'

  // GET /api/audit/carbon-stock
  if (pathSlug === 'carbon-stock') {
    try {
      const submissions = await prisma.submission.findMany({
        where: { synced: true },
        include: {
          seedlings: true,
          monitorings: { orderBy: { monitoredAt: 'desc' }, take: 1 },
        },
      });

      const districtCarbon: Record<
        string,
        {
          totalSeedlings: number;
          submissionsCount: number;
          healthyCount: number;
          stressedCount: number;
          deadCount: number;
        }
      > = {};

      for (const sub of submissions) {
        const district = sub.district || 'অজানা';
        if (!districtCarbon[district]) {
          districtCarbon[district] = {
            totalSeedlings: 0,
            submissionsCount: 0,
            healthyCount: 0,
            stressedCount: 0,
            deadCount: 0,
          };
        }
        const dc = districtCarbon[district];
        dc.submissionsCount++;
        const seedCount =
          sub.seedlings?.reduce((sum: number, s: any) => sum + (s.count || 0), 0) || 0;
        totalSeedlings += seedCount;
        dc.totalSeedlings += seedCount;

        const health = sub.vm0047HealthStatus || 'healthy';
        if (health === 'healthy') dc.healthyCount++;
        else if (health === 'stressed') dc.stressedCount++;
        else if (health === 'dead') dc.deadCount++;
      }

      const totalSubmissions = submissions.length;
      const healthSummary = {
        healthy: submissions.filter(
          (s: any) => (s.vm0047HealthStatus || 'healthy') === 'healthy'
        ).length,
        stressed: submissions.filter((s: any) => s.vm0047HealthStatus === 'stressed').length,
        dead: submissions.filter((s: any) => s.vm0047HealthStatus === 'dead').length,
      };

      res.status(200).json({
        status: 'success',
        methodology: 'VM0047_v1.1',
        report: {
          totalSubmissions,
          totalSeedlings,
          healthSummary,
          districts: Object.entries(districtCarbon).map(([name, data]) => ({ name, ...data })),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // GET /api/audit/export-geojson
  if (pathSlug === 'export-geojson') {
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
    return;
  }

  // If none of the above matched
  res.status(404).json({ error: 'Not found' });
}