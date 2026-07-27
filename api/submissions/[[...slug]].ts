/**
 * Vercel serverless function: /api/submissions/[[...slug]]
 * Handles:
 *   GET    /api/submissions                 -> list
 *   GET    /api/submissions/stats           -> stats
 *   GET    /api/submissions/:id             -> get one
 *   DELETE /api/submissions/:id             -> delete one
 */

import { prisma } from '../_lib/prisma';
import { setCorsHeaders } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const slug = req.query.slug as string[] | undefined;

  // Helper to normalize slug to an array
  const segments = slug ?? [];

  // CASE 1: GET /api/submissions (list)
  if (req.method === 'GET' && segments.length === 0) {
    try {
      const { district, upazila, synced, limit = '50', offset = '0', plantationDate } = req.query;

      const where: any = {};
      if (district) where.district = district as string;
      if (upazila) where.upazila = upazila as string;
      if (synced !== undefined) where.synced = synced === 'true';
      if (plantationDate) where.plantationDate = plantationDate as string;

      const take = Math.min(parseInt(limit as string) || 50, 200);
      const skip = parseInt(offset as string) || 0;

      const [submissions, total] = await Promise.all([
        prisma.submission.findMany({
          where,
          include: {
            _count: { select: { seedlings: true, photos: true } },
            seedlings: true,
            photos: { select: { id: true, stage: true, url: true, capturedAt: true } },
          },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.submission.count({ where }),
      ]);

      const totalSeedlings = submissions.reduce(
        (sum, s: any) => sum + (s._count?.seedlings || 0),
        0
      );

      res.status(200).json({
        status: 'success',
        data: submissions,
        pagination: { total, take, skip, hasMore: skip + take < total },
        stats: { totalSeedlings, submissionCount: submissions.length },
      });
    } catch (err: any) {
      console.error('[GET /api/submissions] Error:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch submissions' });
    }
    return;
  }

  // CASE 2: GET /api/submissions/stats
  if (req.method === 'GET' && segments.length === 1 && segments[0] === 'stats') {
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
    return;
  }

  // CASE 3: GET/DELETE /api/submissions/:id
  if (['GET', 'DELETE'].includes(req.method) && segments.length === 1) {
    const id = segments[0];
    if (!id) {
      return res.status(400).json({ error: 'id param is required' });
    }

    // GET — fetch with relations
    if (req.method === 'GET') {
      try {
        const submission = await prisma.submission.findUnique({
          where: { id },
          include: { seedlings: true, photos: true },
        });
        if (!submission) {
          return res.status(404).json({ error: 'Submission not found' });
        }
        return res.status(200).json({ status: 'success', data: submission });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    // DELETE
    if (req.method === 'DELETE') {
      try {
        await prisma.submission.delete({ where: { id } });
        return res.status(200).json({ status: 'success', message: 'Submission deleted' });
      } catch (err: any) {
        if (err.code === 'P2025') {
          return res.status(404).json({ error: 'Submission not found' });
        }
        return res.status(500).json({ error: err.message });
      }
    }
    return;
  }

  // If none of the above matched
  res.status(404).json({ error: 'Not found' });
}