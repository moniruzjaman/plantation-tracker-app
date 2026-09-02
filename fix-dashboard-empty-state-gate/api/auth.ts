/**
 * Vercel serverless function: Handle auth routes
 *   GET    /api/auth/bootstrap
 *   POST   /api/auth/profile
 *   GET    /api/auth/me?email=...
 */

import { prisma } from '../_lib/prisma';
import { getAllowList, findInAllowList } from '../_lib/auth';
import { setCorsHeaders, parseBody } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { method, query, body } = req;
  const email = (query?.email || body?.email || '').toString().toLowerCase().trim();

  // GET /api/auth/bootstrap
  if (method === 'GET' && !email) {
    // This is the bootstrap endpoint (no email query param)
    const allowList = getAllowList();
    return res.status(200).json({
      status: 'success',
      count: allowList.length,
      mandatoryFields: ['name', 'mobile'],
      tokenBoostFields: ['nid', 'jobId', 'designation', 'district', 'upazila'],
      users: allowList.map((u) => ({
        email: u.email,
        role: u.role,
        name: u.name || '',
        mobile: u.mobile || '',
        designation: u.designation || '',
        district: u.district || '',
        upazila: u.upazila || '',
        blockId: u.blockId || '',
      })),
    });
  }

  // GET /api/auth/me?email=...
  if (method === 'GET' && email) {
    try {
      if (!email) {
        return res.status(400).json({ error: 'email query param is required' });
      }
      const profile = await prisma.userProfile.findUnique({ where: { email } });
      const allowed = findInAllowList(email);
      return res.status(200).json({
        status: 'success',
        profile,
        fromAllowList: !!allowed,
        allowListEntry: allowed
          ? {
              email: allowed.email,
              role: allowed.role,
              name: allowed.name || '',
              mobile: allowed.mobile || '',
              designation: allowed.designation || '',
              district: allowed.district || '',
              upazila: allowed.upazila || '',
            }
          : null,
      });
    } catch (err: any) {
      console.error('[GET /api/auth/me] Error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST /api/auth/profile
  if (method === 'POST') {
    try {
      const parsedBody = await parseBody(req);
      const email = (parsedBody.email || '').toString().toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      const allowed = findInAllowList(email);

      // For non-allow-list users, name + mobile are mandatory
      if (!allowed && (!parsedBody.name || !parsedBody.mobile)) {
        return res.status(400).json({
          error: 'name and mobile are required for self-registered users',
        });
      }

      // Compute profile completion bonus (one-time)
      const existing = await prisma.userProfile.findUnique({ where: { email } });
      const wasBonusClaimed = existing?.profileCompletionBonus ?? false;

      // Build the upsert payload
      const data: any = {
        email,
        name: allowed?.name || parsedBody.name || existing?.name || '',
        mobile: allowed?.mobile || parsedBody.mobile || existing?.mobile || '',
        role: allowed?.role || parsedBody.role || existing?.role || 'citizen',
        nid: parsedBody.nid ?? existing?.nid ?? null,
        jobId: parsedBody.jobId ?? existing?.jobId ?? null,
        designation: allowed?.designation || parsedBody.designation || existing?.designation || null,
        district: allowed?.district || parsedBody.district || existing?.district || null,
        upazila: allowed?.upazila || parsedBody.upazila || existing?.upazila || null,
        blockId: allowed?.blockId || parsedBody.blockId || existing?.blockId || null,
        photoUrl: parsedBody.photoUrl ?? existing?.photoUrl ?? null,
        xp: parsedBody.xp ?? existing?.xp ?? 0,
        greenTokens: parsedBody.greenTokens ?? existing?.greenTokens ?? 0,
        streakCount: parsedBody.streakCount ?? existing?.streakCount ?? 0,
        bootstrapSource: existing?.bootstrapSource || (allowed ? 'allow-list' : 'manual'),
      };

      // Token-boost: if user just completed NID + JobID for the first time
      let bonusAwarded = false;
      let bonusTokens = 0;
      if (!wasBonusClaimed && data.nid && data.jobId) {
        bonusTokens = 25; // NID +10, JobID +10, designation +5 = 25
        if (data.designation) bonusTokens += 5;
        if (data.district) bonusTokens += 3;
        if (data.upazila) bonusTokens += 2;
        data.greenTokens = (data.greenTokens || 0) + bonusTokens;
        data.profileCompletionBonus = true;
        bonusAwarded = true;
      } else if (wasBonusClaimed) {
        data.profileCompletionBonus = true;
      }

      const profile = await prisma.userProfile.upsert({
        where: { email },
        create: data,
        update: data,
      });

      return res.status(200).json({
        status: 'success',
        profile,
        bonusAwarded,
        bonusTokens,
        fromAllowList: !!allowed,
      });
    } catch (err: any) {
      console.error('[POST /api/auth/profile] Error:', err);
      return res.status(500).json({ error: err.message || 'Failed to upsert profile' });
    }
  }

  // If none of the above matched
  return res.status(404).json({ error: 'Not found' });
}