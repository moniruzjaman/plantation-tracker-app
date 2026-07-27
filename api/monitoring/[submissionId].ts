/**
 * Vercel serverless function: GET /api/monitoring/[submissionId]
 *
 * Returns all monitoring checkpoints for a submission, ordered oldest → newest.
 *
 * Vercel route precedence: a literal segment like /api/monitoring/revisit
 * beats the dynamic [submissionId] segment, so the POST endpoint stays
 * distinct from this GET list endpoint.
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
    const submissionId = req.query?.submissionId as string;
    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId param is required' });
    }

    const monitorings = await prisma.monitoring.findMany({
      where: { submissionId },
      orderBy: { monitoredAt: 'asc' },
    });

    res.status(200).json({ status: 'success', data: monitorings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
