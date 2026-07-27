/**
 * Vercel serverless function: GET /api/submissions
 *
 * Paginated submissions list with seedling + photo counts.
 *
 * Query params:
 *   ?district=X
 *   ?upazila=X
 *   ?synced=true|false
 *   ?plantationDate=YYYY-MM-DD
 *   ?limit=50   (max 200)
 *   ?offset=0
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
}
