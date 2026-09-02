/**
 * Vercel serverless function: Handle monitoring routes
 *   POST /api/monitoring/revisit
 *   GET  /api/monitoring/:submissionId
 */

import { prisma } from '../_lib/prisma';
import { setCorsHeaders, parseBody } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const slug = Array.isArray(req.query.slug) ? req.query.slug : [req.query.slug].filter(Boolean);
  const pathSlug = slug.join('/'); // e.g., 'revisit' or 'abc123'

  // POST /api/monitoring/revisit
  if (req.method === 'POST' && pathSlug === 'revisit') {
    try {
      const body = await parseBody(req);
      const {
        submissionId,
        stage,
        avgHeightM,
        avgDbhCm,
        avgCanopyRadiusM,
        vm0047HealthStatus,
        survivalCount,
        deadCount,
        latitude,
        longitude,
        accuracy,
        sdgIncomeChange,
        sdgSoilHealth,
        biodiversityNote,
        remarks,
      } = body;

      if (!submissionId || !stage) {
        return res.status(400).json({ error: 'submissionId and stage are required' });
      }

      const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      const monitoring = await prisma.monitoring.create({
        data: {
          submissionId,
          stage: stage || 'month_6',
          avgHeightM: avgHeightM ?? null,
          avgDbhCm: avgDbhCm ?? null,
          avgCanopyRadiusM: avgCanopyRadiusM ?? null,
          vm0047HealthStatus: vm0047HealthStatus || 'healthy',
          survivalCount: survivalCount ?? null,
          deadCount: deadCount ?? null,
          latitude: latitude || 0,
          longitude: longitude || 0,
          accuracy: accuracy || 0,
          sdgIncomeChange: sdgIncomeChange || null,
          sdgSoilHealth: sdgSoilHealth || null,
          biodiversityNote: biodiversityNote || null,
          remarks: remarks || null,
        },
      });

      // Update the parent submission's health status
      await prisma.submission.update({
        where: { id: submissionId },
        data: { vm0047HealthStatus: vm0047HealthStatus || 'healthy' },
      });

      return res.status(200).json({ status: 'success', data: monitoring });
    } catch (err: any) {
      console.error('[Monitoring Revisit] Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to record monitoring revisit' });
    }
  }

  // GET /api/monitoring/:submissionId
  if (req.method === 'GET' && slug.length === 1) {
    const submissionId = slug[0];
    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId param is required' });
    }

    try {
      const monitorings = await prisma.monitoring.findMany({
        where: { submissionId },
        orderBy: { monitoredAt: 'asc' },
      });
      return res.status(200).json({ status: 'success', data: monitorings });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // If none of the above matched
  return res.status(404).json({ error: 'Not found' });
}