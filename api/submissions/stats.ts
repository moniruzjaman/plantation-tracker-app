/**
 * Vercel serverless function: GET /api/submissions/stats
 *
 * Aggregate dashboard numbers: total submissions, synced count, pending
 * count, total seedlings across all submissions, and per-district stats
 * (count + summed area).
 *
 * NOTE: This file is named stats.ts so Vercel routes /api/submissions/stats
 * here BEFORE matching /api/submissions/[id].ts (Vercel prefers literal
 * segments over dynamic ones).
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
    const [total, syncedCount, districtStats] = await Promise.all([
      prisma.submission.count(),
      prisma.submission.count({ where: { synced: true } }),
      prisma.submission.groupBy({
        by: ['district'],
        _count: true,
        _sum: { areaSqMeters: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),
    ]);

    const seedlingAgg = await prisma.seedling.aggregate({
      _sum: { count: true },
    });

    res.status(200).json({
      status: 'success',
      stats: {
        totalSubmissions: total,
        syncedSubmissions: syncedCount,
        pendingSync: total - syncedCount,
        totalSeedlings: seedlingAgg._sum.count || 0,
        districts: districtStats.map((d: any) => ({
          name: d.district || 'অজানা',
          count: d._count,
          totalAreaSqm: d._sum.areaSqMeters || 0,
        })),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
