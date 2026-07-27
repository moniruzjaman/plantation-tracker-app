/**
 * Vercel serverless function: POST /api/auth/profile
 *
 * Upsert a UserProfile. Behavior:
 *   - If email is in the allow-list → allow-list fields take precedence
 *     (admins can't accidentally downgrade their own role by submitting a
 *     partial profile).
 *   - If email is NOT in the allow-list → name + mobile are MANDATORY
 *     (enforced server-side), role defaults to 'citizen'.
 *   - First time the user provides both NID + JobID, awards a one-time
 *     profileCompletionBonus (25 + 5/3/2 tokens for designation/district/
 *     upazila).
 *
 * Body: { email, name?, mobile?, nid?, jobId?, designation?, district?,
 *         upazila?, blockId?, photoUrl?, xp?, greenTokens?, streakCount? }
 */

import { prisma } from '../_lib/prisma';
import { findInAllowList } from '../_lib/auth';
import { setCorsHeaders, parseBody } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const email = (body.email || '').toString().toLowerCase().trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const allowed = findInAllowList(email);

    // For non-allow-list users, name + mobile are mandatory
    if (!allowed && (!body.name || !body.mobile)) {
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
      name: allowed?.name || body.name || existing?.name || '',
      mobile: allowed?.mobile || body.mobile || existing?.mobile || '',
      role: allowed?.role || body.role || existing?.role || 'citizen',
      nid: body.nid ?? existing?.nid ?? null,
      jobId: body.jobId ?? existing?.jobId ?? null,
      designation: allowed?.designation || body.designation || existing?.designation || null,
      district: allowed?.district || body.district || existing?.district || null,
      upazila: allowed?.upazila || body.upazila || existing?.upazila || null,
      blockId: allowed?.blockId || body.blockId || existing?.blockId || null,
      photoUrl: body.photoUrl ?? existing?.photoUrl ?? null,
      xp: body.xp ?? existing?.xp ?? 0,
      greenTokens: body.greenTokens ?? existing?.greenTokens ?? 0,
      streakCount: body.streakCount ?? existing?.streakCount ?? 0,
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

    res.status(200).json({
      status: 'success',
      profile,
      bonusAwarded,
      bonusTokens,
      fromAllowList: !!allowed,
    });
  } catch (err: any) {
    console.error('[POST /api/auth/profile] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to upsert profile' });
  }
}
