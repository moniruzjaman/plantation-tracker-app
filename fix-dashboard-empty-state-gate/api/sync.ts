/**
 * Vercel serverless function: POST /api/sync
 *
 * Receives an array of PlantationSubmission objects from the client and
 * upserts them into the relational DB (Submission + Seedling + Photo).
 * Idempotent by clientUid — duplicates are silently skipped.
 *
 * Body: { drafts: PlantationSubmission[] }
 *
 * Returns:
 *   - syncedCount: how many were newly inserted
 *   - totalSeedlings: aggregate seedling count across synced drafts
 *   - xpBonus: 50 XP per synced submission
 *   - greenTokens: max(1, floor(seedlingCount / 10)) per submission
 *   - errors: per-draft error messages (if any)
 */

import { prisma } from './_lib/prisma';
import { setCorsHeaders, parseBody, countV2Seedlings } from './_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const { drafts } = body;
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return res
        .status(400)
        .json({ error: "Invalid payload. 'drafts' must be a non-empty array." });
    }

    let newlySyncedCount = 0;
    let totalSeedlings = 0;
    let totalXPBonus = 0;
    let greenTokensAwarded = 0;
    const errors: string[] = [];

    for (const draft of drafts) {
      try {
        // Check for duplicate (idempotent sync)
        const existing = await prisma.submission.findUnique({
          where: { clientUid: draft.id },
        });
        if (existing) {
          console.log(`[Sync] Skipping duplicate: ${draft.id}`);
          continue;
        }

        // Create submission with nested seedlings + photos
        await prisma.submission.create({
          data: {
            clientUid: draft.id,
            entryMode: draft.entryMode || 'dae_officer',
            region: draft.region || '',
            district: draft.district || '',
            upazila: draft.upazila || '',
            union: draft.union || '',
            blockId: draft.blockId || null,
            blockName: draft.blockName || null,
            village: draft.village || '',
            plantationDate: draft.plantationDate || new Date().toISOString().slice(0, 10),
            latitude: draft.latitude || 0,
            longitude: draft.longitude || 0,
            accuracy: draft.accuracy || 0,
            caretakerName: draft.caretakerName || '',
            caretakerMobile: draft.caretakerMobile || '',
            saaoId: draft.saaoId || null,
            saaoName: draft.saaoName || '',
            saaoMobile: draft.saaoMobile || '',
            monitoringOfficerId: draft.monitoringOfficerId || null,
            monitoringOfficerName: draft.monitoringOfficerName || '',
            monitoringOfficerMobile: draft.monitoringOfficerMobile || '',
            remarks: draft.remarks || null,
            areaSqMeters: draft.areaSqMeters ?? null,
            spacingFlag: draft.spacingFlag ?? false,
            nurserySourceId: draft.nurserySourceId || null,
            nurserySourceName: draft.nurserySourceName || null,
            nurserySourceLatitude: draft.nurserySourceLatitude ?? null,
            nurserySourceLongitude: draft.nurserySourceLongitude ?? null,
            synced: true,
            syncedAt: new Date(),
            // VM0047 fields
            trackingMethod: draft.trackingMethod || 'census',
            treeSerial: draft.treeSerial || null,
            vm0047HealthStatus: draft.vm0047HealthStatus || 'healthy',
            geoPolygon: draft.geoPolygon || null,
            modellingUnitId: draft.modellingUnitId || null,
            sdgIncomeChange: draft.sdgIncomeChange || null,
            sdgSoilHealth: draft.sdgSoilHealth || null,
            biodiversityNote: draft.biodiversityNote || null,
            seedlings: {
              create: (draft.seedlings || []).map((s: any) => ({
                plantTypeId: s.plantTypeId || null,
                speciesId: s.speciesId || null,
                speciesName: s.speciesName || '',
                count: parseInt(s.count) || 0,
                carbonFactor: s.carbonFactor ?? null,
              })),
            },
            photos: {
              create: (draft.photos || []).map((p: any) => ({
                stage: p.stage || 'planting',
                url: p.url || '',
                sha256: p.sha256 || '',
                capturedAt: p.capturedAt || new Date().toISOString(),
                latitude: p.latitude || 0,
                longitude: p.longitude || 0,
                distanceFromOriginMeters: p.distanceFromOriginMeters ?? null,
                photoType: p.photoType || null,
              })),
            },
          },
        });

        newlySyncedCount++;
        const seedCount = countV2Seedlings(draft);
        totalSeedlings += seedCount;
        totalXPBonus += 50;
        greenTokensAwarded += Math.max(1, Math.floor(seedCount / 10));
      } catch (draftErr: any) {
        const msg = draftErr?.message || 'Unknown error';
        errors.push(`${draft.id}: ${msg}`);
        console.error(`[Sync] Failed for ${draft.id}:`, msg);
      }
    }

    console.log(
      `[Sync] ${newlySyncedCount}/${drafts.length} synced, ${totalSeedlings} seedlings, ${errors.length} errors`
    );

    res.status(200).json({
      status: 'success',
      syncedCount: newlySyncedCount,
      totalSeedlings,
      xpBonus: totalXPBonus,
      greenTokens: greenTokensAwarded,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: Date.now(),
      message:
        errors.length > 0
          ? `${newlySyncedCount}টি সিঙ্ক হয়েছে, ${errors.length}টি ব্যর্থ`
          : `সফলভাবে ${newlySyncedCount}টি জরিপ ডাটাবেসে সংরক্ষিত হয়েছে। +${totalXPBonus} এক্সপি এবং ${greenTokensAwarded} সবুজ টোকেন!`,
    });
  } catch (err: any) {
    console.error('[Sync] Fatal error:', err);
    res.status(500).json({ error: err.message || 'Failed to sync submissions' });
  }
}
