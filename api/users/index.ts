/**
 * Vercel serverless function: GET /api/users
 *
 * Admin-only user list. Query params:
 *   ?role=admin|cadre|officer|citizen
 *   ?district=...
 *   ?upazila=...   (cadre role only — admins can see all upazilas)
 *
 * Requester must be either:
 *   - in the DB UserProfile table with role=admin or role=cadre, OR
 *   - in the allow-list (seed/admins.json) with role=admin or role=cadre
 *
 * The requester email is taken from ?requester= or X-User-Email header.
 */

import { prisma } from '../_lib/prisma';
import { findInAllowList } from '../_lib/auth';
import { setCorsHeaders, getRequesterEmail } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requesterEmail = getRequesterEmail(req);
    const requester = requesterEmail
      ? await prisma.userProfile.findUnique({ where: { email: requesterEmail } })
      : null;
    const allowed = findInAllowList(requesterEmail);

    const requesterRole = requester?.role || allowed?.role;
    if (requesterRole !== 'admin' && requesterRole !== 'cadre') {
      return res.status(403).json({ error: 'Admin or cadre role required' });
    }

    const where: any = {};
    if (req.query.role) where.role = req.query.role;
    if (req.query.district) where.district = req.query.district;
    if (req.query.upazila && requesterRole === 'cadre') {
      where.upazila = req.query.upazila;
    }

    const users = await prisma.userProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        role: true,
        designation: true,
        district: true,
        upazila: true,
        jobId: true,
        xp: true,
        greenTokens: true,
        profileCompletionBonus: true,
        bootstrapSource: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({ status: 'success', count: users.length, users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
