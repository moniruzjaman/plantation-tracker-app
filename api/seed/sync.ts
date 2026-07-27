/**
 * Vercel serverless function: POST /api/seed/sync
 *
 * Admin-only bulk upsert from the workbook's "process data" sheet into
 * the Submission table. Idempotent — re-running the same sync is safe
 * because clientUid is `seed-${sl}`.
 *
 * Body: { records: SeedPlantationEntry[], syncedByEmail: string }
 *   Each SeedPlantationEntry: { sl, district?, upazila?, plantingDate?,
 *     latitude?, longitude?, caretaker?, saao?, monitoringOfficer?,
 *     speciesName?, count? }
 *
 * Requester must be admin (DB role OR allow-list role).
 */

import path from 'path';
import { prisma } from '../_lib/prisma';
import { findInAllowList } from '../_lib/auth';
import { setCorsHeaders, parseBody, sha256File } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const { records, syncedByEmail } = body || {};

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'records array is required' });
    }

    // Verify requester is admin (or allow-list admin)
    const email = (syncedByEmail || '').toString().toLowerCase().trim();
    const requester = email ? await prisma.userProfile.findUnique({ where: { email } }) : null;
    const allowed = findInAllowList(email);
    const isAdmin = requester?.role === 'admin' || allowed?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin role required to sync seed data' });
    }

    // Compute workbook hash for traceability
    const workbookPath = path.join(process.cwd(), 'seed', 'Tree_Plantation_Reporting_Workbook.xlsx');
    const fileHash = sha256File(workbookPath);

    let upsertedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const r of records) {
      try {
        const clientUid = `seed-${r.sl}`;
        // Idempotent: skip if already synced
        const existing = await prisma.submission.findUnique({ where: { clientUid } });
        if (existing) {
          skippedCount++;
          continue;
        }

        await prisma.submission.create({
          data: {
            clientUid,
            entryMode: 'dae_officer',
            region: 'Rangpur',
            district: r.district || '',
            upazila: r.upazila || '',
            union: '',
            village: '',
            plantationDate: r.plantingDate || new Date().toISOString().slice(0, 10),
            latitude: r.latitude || 0,
            longitude: r.longitude || 0,
            accuracy: 0,
            caretakerName: r.caretaker || '',
            caretakerMobile: '',
            saaoName: r.saao || '',
            saaoMobile: '',
            monitoringOfficerName: r.monitoringOfficer || '',
            monitoringOfficerMobile: '',
            remarks: `Seed import from workbook (SL ${r.sl})`,
            synced: true,
            syncedAt: new Date(),
            seedlings: {
              create:
                r.speciesName && r.count
                  ? [{ speciesName: r.speciesName, count: r.count }]
                  : [],
            },
            photos: { create: [] },
          },
        });
        upsertedCount++;
      } catch (err: any) {
        errors.push(`SL ${r.sl}: ${err.message}`);
      }
    }

    // Record the sync event
    const syncRecord = await prisma.seedSync.create({
      data: {
        recordCount: records.length,
        sourceFileName: 'Tree_Plantation_Reporting_Workbook.xlsx',
        sourceFileHash: fileHash,
        syncedByEmail: email || null,
        notes: `Upserted ${upsertedCount}, skipped ${skippedCount} (already synced), ${errors.length} errors`,
      },
    });

    res.status(200).json({
      status: 'success',
      syncId: syncRecord.id,
      upsertedCount,
      skippedCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      sourceFileHash: fileHash,
      syncedAt: syncRecord.syncedAt,
    });
  } catch (err: any) {
    console.error('[POST /api/seed/sync] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to sync seed data' });
  }
}
