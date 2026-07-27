/**
 * Vercel serverless function: GET /api/auth/me?email=...
 *
 * Fetch a UserProfile by email, plus its allow-list entry (if any).
 */

import { prisma } from '../_lib/prisma';
import { findInAllowList } from '../_lib/auth';
import { setCorsHeaders } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const email = ((req.query?.email as string) || '').toString().toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: 'email query param is required' });
    }
    const profile = await prisma.userProfile.findUnique({ where: { email } });
    const allowed = findInAllowList(email);
    res.status(200).json({
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
    res.status(500).json({ error: err.message });
  }
}
