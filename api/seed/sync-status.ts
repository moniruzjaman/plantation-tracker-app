/**
 * Vercel serverless function: GET /api/seed/sync-status
 *
 * Returns the last SeedSync record + count of seed-imported submissions
 * (clientUid starting with `seed-`). Also reports whether the workbook
 * file is bundled with the deployment.
 */

import path from 'path';
import fs from 'fs';
import { prisma } from '../_lib/prisma';
import { setCorsHeaders } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const lastSync = await prisma.seedSync.findFirst({
      orderBy: { syncedAt: 'desc' },
    });
    const seedSubmissionCount = await prisma.submission.count({
      where: { clientUid: { startsWith: 'seed-' } },
    });

    // On Vercel, the bundled workbook sits at process.cwd()/seed/.
    const workbookPath = path.join(process.cwd(), 'seed', 'Tree_Plantation_Reporting_Workbook.xlsx');

    res.status(200).json({
      status: 'success',
      lastSync,
      seedSubmissionsInDb: seedSubmissionCount,
      workbookPath,
      workbookExists: fs.existsSync(workbookPath),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
