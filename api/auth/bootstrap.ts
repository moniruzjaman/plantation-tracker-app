/**
 * Vercel serverless function: GET /api/auth/bootstrap
 *
 * Returns the public allow-list (emails + pre-assigned roles, no secrets).
 * Used by the client on first install to figure out which device email
 * (if any) is pre-authorized as admin/cadre/officer.
 *
 * Public endpoint — no auth required. Reads from seed/admins.json.
 */

import { getAllowList } from '../_lib/auth';
import { setCorsHeaders } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const allowList = getAllowList();
  res.status(200).json({
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
