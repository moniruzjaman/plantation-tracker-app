/**
 * Vercel serverless function: GET /api/audit/carbon-stock
 *
 * VM0047 v1.1 carbon-stock report. Aggregates all synced submissions,
 * groups by district, includes health summary (healthy / stressed / dead).
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
      dc.totalSeedlings += seedCount;

      const health = sub.vm0047HealthStatus || 'healthy';
      if (health === 'healthy') dc.healthyCount++;
      else if (health === 'stressed') dc.stressedCount++;
      else if (health === 'dead') dc.deadCount++;
    }

    const totalSubmissions = submissions.length;
    const totalSeedlings = submissions.reduce(
      (sum, s: any) =>
        sum + (s.seedlings?.reduce((a: number, b: any) => a + (b.count || 0), 0) || 0),
      0
    );
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
}
