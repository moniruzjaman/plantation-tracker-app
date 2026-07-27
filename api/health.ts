/**
 * Vercel serverless function: GET /api/health
 *
 * Database ping. Returns "ok" if Prisma can reach Neon, "degraded" if not.
 * Vercel uptime monitors + cold-start smoke tests hit this.
 */

import { prisma } from './_lib/prisma';
import { setCorsHeaders } from './_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      database: 'connected',
      time: new Date().toISOString(),
    });
  } catch {
    res.status(200).json({
      status: 'degraded',
      database: 'disconnected',
      time: new Date().toISOString(),
    });
  }
}
