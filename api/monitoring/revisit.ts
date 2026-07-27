/**
 * Vercel serverless function: POST /api/monitoring/revisit
 *
 * Records a VM0047 monitoring checkpoint (DBH, height, canopy, survival,
 * health status) for a submission. Also updates the parent submission's
 * `vm0047HealthStatus` to reflect the most recent visit.
 *
 * Body: { submissionId, stage, avgHeightM?, avgDbhCm?, avgCanopyRadiusM?,
 *         vm0047HealthStatus?, survivalCount?, deadCount?, latitude?,
 *         longitude?, accuracy?, sdgIncomeChange?, sdgSoilHealth?,
 *         biodiversityNote?, remarks? }
 */

import { prisma } from '../_lib/prisma';
import { setCorsHeaders, parseBody } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    res.status(200).json({ status: 'success', data: monitoring });
  } catch (err: any) {
    console.error('[Monitoring Revisit] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to record monitoring revisit' });
  }
}
