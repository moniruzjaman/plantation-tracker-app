import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// ─── Prisma Client ─────────────────────────────────────────────────────────
const prisma = new PrismaClient();
prisma.$connect().then(() => console.log("[DB] Connected to database"));

// ─── Admin allow-list loader (seed/admins.json) ────────────────────────────
// Loaded once at server start. Hot-reloadable by touching the file and
// restarting, or by calling POST /api/auth/bootstrap/refresh (admin only).
interface AllowListEntry {
  email: string;
  role: 'admin' | 'cadre' | 'officer' | 'citizen';
  name?: string;
  mobile?: string;
  designation?: string;
  district?: string;
  upazila?: string;
  blockId?: string;
  notes?: string;
}
let ALLOW_LIST: AllowListEntry[] = [];
function loadAllowList() {
  try {
    const fp = path.join(process.cwd(), 'seed', 'admins.json');
    if (!fs.existsSync(fp)) {
      console.warn('[Auth] seed/admins.json not found — bootstrap disabled');
      ALLOW_LIST = [];
      return;
    }
    const raw = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    ALLOW_LIST = Array.isArray(raw?.users) ? raw.users : [];
    console.log(`[Auth] Loaded ${ALLOW_LIST.length} allow-list entries from seed/admins.json`);
  } catch (err) {
    console.error('[Auth] Failed to load allow-list:', err);
    ALLOW_LIST = [];
  }
}
loadAllowList();

/** Look up an email in the allow-list (case-insensitive). */
function findInAllowList(email: string): AllowListEntry | null {
  if (!email) return null;
  const lower = email.toLowerCase().trim();
  return ALLOW_LIST.find((e) => e.email.toLowerCase().trim() === lower) || null;
}

/** Compute SHA-256 hash of a file (used for SeedSync.sourceFileHash). */
function sha256File(filePath: string): string {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return '';
  }
}

// ─── Gemini AI ─────────────────────────────────────────────────────────────
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' }
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Count total seedlings across all seedling arrays (legacy v1 format support) */
function countV1Seedlings(draft: any): number {
  let sum = 0;
  const countVariety = (list: any) => {
    if (Array.isArray(list)) list.forEach((item: any) => { sum += (parseInt(item.count) || 0) + (parseInt(item.graftingCount) || 0); });
  };
  countVariety(draft.fruitSeedlings);
  countVariety(draft.forestSeedlings);
  countVariety(draft.medicinalSeedlings);
  return sum;
}

/** Count seedlings from v2 PlantationSubmission.seedlings array */
function countV2Seedlings(draft: any): number {
  if (Array.isArray(draft.seedlings)) {
    return draft.seedlings.reduce((sum: number, s: any) => sum + (parseInt(s.count) || 0), 0);
  }
  return countV1Seedlings(draft);
}

// ─── Server ────────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // Healthcheck
  app.get("/api/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok", database: "connected", time: new Date().toISOString() });
    } catch {
      res.json({ status: "degraded", database: "disconnected", time: new Date().toISOString() });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── AUTH & USER PROFILE ENDPOINTS ───────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Bootstrap flow (first install):
  //   1. Client calls GET /api/auth/bootstrap — returns the public allow-list
  //      (emails + pre-assigned roles, no secrets).
  //   2. If the device's email matches an entry → client calls
  //      POST /api/auth/profile with email + allow-list fields → server upserts
  //      a UserProfile row and returns it. `bootstrapSource = 'allow-list'`.
  //   3. If no match → client calls POST /api/auth/profile with email + name +
  //      mobile only → server creates a 'citizen' profile. Name + mobile are
  //      MANDATORY for non-allow-list users (enforced server-side).
  //
  // Token boost:
  //   When the client later PATCHes the profile with NID/JobID/designation/
  //   district/upazila, the server computes a one-time
  //   `profileCompletionBonus` reward and returns the bonus in the response.

  // ─── GET /api/auth/bootstrap — public allow-list ──────────────────────────
  app.get("/api/auth/bootstrap", async (_req, res) => {
    res.json({
      status: "success",
      count: ALLOW_LIST.length,
      mandatoryFields: ["name", "mobile"],
      tokenBoostFields: ["nid", "jobId", "designation", "district", "upazila"],
      users: ALLOW_LIST.map((u) => ({
        email: u.email,
        role: u.role,
        name: u.name || "",
        mobile: u.mobile || "",
        designation: u.designation || "",
        district: u.district || "",
        upazila: u.upazila || "",
        blockId: u.blockId || "",
      })),
    });
  });

  // ─── POST /api/auth/profile — upsert user profile ────────────────────────
  // Body: { email, name?, mobile?, nid?, jobId?, designation?, district?,
  //         upazila?, blockId?, photoUrl?, xp?, greenTokens?, streakCount? }
  // If email matches allow-list, allow-list fields take precedence (admins
  // can't accidentally downgrade their own role by submitting a partial
  // profile). For non-allow-list emails, name + mobile are required.
  app.post("/api/auth/profile", async (req, res) => {
    try {
      const body = req.body || {};
      const email = (body.email || "").toString().toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: "Valid email is required" });
        return;
      }

      const allowed = findInAllowList(email);

      // For non-allow-list users, name + mobile are mandatory
      if (!allowed && (!body.name || !body.mobile)) {
        res.status(400).json({
          error: "name and mobile are required for self-registered users",
        });
        return;
      }

      // Compute profile completion bonus (one-time)
      const existing = await prisma.userProfile.findUnique({ where: { email } });
      const wasBonusClaimed = existing?.profileCompletionBonus ?? false;

      // Build the upsert payload
      const data: any = {
        email,
        name: allowed?.name || body.name || existing?.name || "",
        mobile: allowed?.mobile || body.mobile || existing?.mobile || "",
        role: allowed?.role || body.role || existing?.role || "citizen",
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
        bootstrapSource: existing?.bootstrapSource || (allowed ? "allow-list" : "manual"),
      };

      // Token-boost: if user just completed NID + JobID for the first time
      // and the bonus hasn't been claimed yet, award it now.
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

      res.json({
        status: "success",
        profile,
        bonusAwarded,
        bonusTokens,
        fromAllowList: !!allowed,
      });
    } catch (err: any) {
      console.error("[POST /api/auth/profile] Error:", err);
      res.status(500).json({ error: err.message || "Failed to upsert profile" });
    }
  });

  // ─── GET /api/auth/me?email=... — fetch profile by email ─────────────────
  app.get("/api/auth/me", async (req, res) => {
    try {
      const email = (req.query.email as string || "").toString().toLowerCase().trim();
      if (!email) {
        res.status(400).json({ error: "email query param is required" });
        return;
      }
      const profile = await prisma.userProfile.findUnique({ where: { email } });
      const allowed = findInAllowList(email);
      res.json({
        status: "success",
        profile,
        fromAllowList: !!allowed,
        allowListEntry: allowed
          ? {
              email: allowed.email,
              role: allowed.role,
              name: allowed.name || "",
              mobile: allowed.mobile || "",
              designation: allowed.designation || "",
              district: allowed.district || "",
              upazila: allowed.upazila || "",
            }
          : null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /api/users — admin-only user list ───────────────────────────────
  // Query: ?role=admin|cadre|officer|citizen & ?district=...
  app.get("/api/users", async (req, res) => {
    try {
      const requesterEmail = (req.query.requester as string || req.headers['x-user-email'] as string || "").toString().toLowerCase().trim();
      const requester = await prisma.userProfile.findUnique({ where: { email: requesterEmail } });
      if (!requester || (requester.role !== 'admin' && requester.role !== 'cadre')) {
        res.status(403).json({ error: "Admin or cadre role required" });
        return;
      }

      const where: any = {};
      if (req.query.role) where.role = req.query.role;
      if (req.query.district) where.district = req.query.district;
      if (req.query.upazila && requester.role === 'cadre') where.upazila = req.query.upazila;

      const users = await prisma.userProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true, email: true, name: true, mobile: true, role: true,
          designation: true, district: true, upazila: true, jobId: true,
          xp: true, greenTokens: true, profileCompletionBonus: true,
          bootstrapSource: true, createdAt: true, updatedAt: true,
        },
      });
      res.json({ status: "success", count: users.length, users });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── SEED DATA SYNC ENDPOINTS ────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Two endpoints for syncing the workbook's "process data" sheet into the
  // Submission table:
  //   GET  /api/seed/sync-status — returns last sync time + record count
  //   POST /api/seed/sync        — admin-only bulk upsert (idempotent by
  //                                clientUid = `seed-${sl}`)

  // ─── GET /api/seed/sync-status ────────────────────────────────────────────
  app.get("/api/seed/sync-status", async (_req, res) => {
    try {
      const lastSync = await prisma.seedSync.findFirst({
        orderBy: { syncedAt: 'desc' },
      });
      const seedSubmissionCount = await prisma.submission.count({
        where: { clientUid: { startsWith: 'seed-' } },
      });
      res.json({
        status: "success",
        lastSync,
        seedSubmissionsInDb: seedSubmissionCount,
        workbookPath: path.join(process.cwd(), 'seed', 'Tree_Plantation_Reporting_Workbook.xlsx'),
        workbookExists: fs.existsSync(path.join(process.cwd(), 'seed', 'Tree_Plantation_Reporting_Workbook.xlsx')),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /api/seed/sync — admin-only bulk upsert ────────────────────────
  // Body: { records: SeedPlantationEntry[], syncedByEmail: string }
  // Each record is upserted as a Submission row with clientUid = `seed-${sl}`
  // (idempotent — re-running the same sync is safe).
  app.post("/api/seed/sync", async (req, res) => {
    try {
      const { records, syncedByEmail } = req.body || {};
      if (!Array.isArray(records) || records.length === 0) {
        res.status(400).json({ error: "records array is required" });
        return;
      }

      // Verify requester is admin (or allow-list admin)
      const email = (syncedByEmail || "").toString().toLowerCase().trim();
      const requester = email ? await prisma.userProfile.findUnique({ where: { email } }) : null;
      const allowed = findInAllowList(email);
      const isAdmin = (requester?.role === 'admin') || (allowed?.role === 'admin');
      if (!isAdmin) {
        res.status(403).json({ error: "Admin role required to sync seed data" });
        return;
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
                create: r.speciesName && r.count
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

      res.json({
        status: "success",
        syncId: syncRecord.id,
        upsertedCount,
        skippedCount,
        errorCount: errors.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
        sourceFileHash: fileHash,
        syncedAt: syncRecord.syncedAt,
      });
    } catch (err: any) {
      console.error("[POST /api/seed/sync] Error:", err);
      res.status(500).json({ error: err.message || "Failed to sync seed data" });
    }
  });

  // ─── REAL SYNC ENDPOINT ──────────────────────────────────────────────────
  // Receives an array of PlantationSubmission objects from the client.
  // Upserts into the relational DB (Submission + Seedling + Photo tables).
  // Uses clientUid for dedup — if a submission with the same client ID
  // already exists, it skips (idempotent).
  app.post("/api/sync", async (req, res) => {
    try {
      const { drafts } = req.body;
      if (!Array.isArray(drafts) || drafts.length === 0) {
        res.status(400).json({ error: "Invalid payload. 'drafts' must be a non-empty array." });
        return;
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

      console.log(`[Sync] ${newlySyncedCount}/${drafts.length} synced, ${totalSeedlings} seedlings, ${errors.length} errors`);

      res.json({
        status: "success",
        syncedCount: newlySyncedCount,
        totalSeedlings,
        xpBonus: totalXPBonus,
        greenTokens: greenTokensAwarded,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: Date.now(),
        message: errors.length > 0
          ? `${newlySyncedCount}টি সিঙ্ক হয়েছে, ${errors.length}টি ব্যর্থ`
          : `সফলভাবে ${newlySyncedCount}টি জরিপ ডাটাবেসে সংরক্ষিত হয়েছে। +${totalXPBonus} এক্সপি এবং ${greenTokensAwarded} সবুজ টোকেন!`,
      });
    } catch (err: any) {
      console.error("[Sync] Fatal error:", err);
      res.status(500).json({ error: err.message || "Failed to sync submissions" });
    }
  });

  // ─── GET /api/submissions — Dashboard data ────────────────────────────────
  // Returns paginated submissions with seedling + photo counts.
  // Query params: ?district=X&upazila=X&synced=true&limit=50&offset=0
  app.get("/api/submissions", async (req, res) => {
    try {
      const { district, upazila, synced, limit = '50', offset = '0', plantationDate } = req.query;

      const where: any = {};
      if (district) where.district = district as string;
      if (upazila) where.upazila = upazila as string;
      if (synced !== undefined) where.synced = synced === 'true';
      if (plantationDate) where.plantationDate = plantationDate as string;

      const take = Math.min(parseInt(limit as string) || 50, 200);
      const skip = parseInt(offset as string) || 0;

      const [submissions, total] = await Promise.all([
        prisma.submission.findMany({
          where,
          include: {
            _count: { select: { seedlings: true, photos: true } },
            seedlings: true,
            photos: { select: { id: true, stage: true, url: true, capturedAt: true } },
          },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.submission.count({ where }),
      ]);

      // Aggregate stats
      const totalSeedlings = submissions.reduce(
        (sum, s) => sum + (s._count?.seedlings || 0), 0
      );

      res.json({
        status: "success",
        data: submissions,
        pagination: { total, take, skip, hasMore: skip + take < total },
        stats: { totalSeedlings, submissionCount: submissions.length },
      });
    } catch (err: any) {
      console.error("[GET /api/submissions] Error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch submissions" });
    }
  });

  // ─── GET /api/submissions/stats — Aggregate dashboard numbers ────────────
  app.get("/api/submissions/stats", async (_req, res) => {
    try {
      const [total, syncedCount, districtStats] = await Promise.all([
        prisma.submission.count(),
        prisma.submission.count({ where: { synced: true } }),
        prisma.submission.groupBy({
          by: ['district'],
          _count: true,
          _sum: { areaSqMeters: true },
          orderBy: { _count: { id: 'desc' } },
          take: 20,
        }),
      ]);

      // Total seedlings across all submissions
      const seedlingAgg = await prisma.seedling.aggregate({
        _sum: { count: true },
      });

      res.json({
        status: "success",
        stats: {
          totalSubmissions: total,
          syncedSubmissions: syncedCount,
          pendingSync: total - syncedCount,
          totalSeedlings: seedlingAgg._sum.count || 0,
          districts: districtStats.map(d => ({
            name: d.district || 'অজানা',
            count: d._count,
            totalAreaSqm: d._sum.areaSqMeters || 0,
          })),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /api/submissions/:id — Single submission detail ──────────────────
  app.get("/api/submissions/:id", async (req, res) => {
    try {
      const submission = await prisma.submission.findUnique({
        where: { id: req.params.id },
        include: {
          seedlings: true,
          photos: true,
        },
      });
      if (!submission) {
        res.status(404).json({ error: "Submission not found" });
        return;
      }
      res.json({ status: "success", data: submission });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── DELETE /api/submissions/:id ─────────────────────────────────────────
  app.delete("/api/submissions/:id", async (req, res) => {
    try {
      await prisma.submission.delete({ where: { id: req.params.id } });
      res.json({ status: "success", message: "Submission deleted" });
    } catch (err: any) {
      if (err.code === 'P2025') {
        res.status(404).json({ error: "Submission not found" });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // ─── Gemini AI Chat ──────────────────────────────────────────────────────
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history, language } = req.body;
      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const systemInstruction = language === 'bn'
        ? "আপনি একজন অভিজ্ঞ বাংলাদেশী বনায়ন, উদ্ভিদ রোগ বিশেষজ্ঞ এবং নার্সারী উপদেষ্টা। ব্যবহারকারীকে সঠিক তথ্য দিন, উদ্ভিদের যত্ন নেওয়ার পরামর্শ দিন, সার প্রয়োগ এবং চারা রোপণের সঠিক গাইডলাইন প্রদান করুন। ভাষা সর্বদা সহজ ও প্রাঞ্জল বাংলা রাখুন।"
        : "You are an expert Bangladeshi forestry, silviculture, and plant pathology consultant. Provide highly helpful, polite, and actionable advice on tree species selection, nursery seedling management, diseases, carbon sequestration, and soil conditions in Bangladesh. Keep answers clear and engaging.";

      const formattedHistory = Array.isArray(history)
        ? history.map((item: any) => ({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.text || item.message || "" }]
          }))
        : [];

      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        history: formattedHistory,
        config: { systemInstruction },
      });

      const response = await chat.sendMessage({ message });
      res.json({ text: response.text, timestamp: Date.now() });
    } catch (err: any) {
      console.error("Gemini Chat Error:", err);
      res.status(500).json({ error: err.message || "Failed to communicate with AI Assistant" });
    }
  });

  // ─── Gemini AI Diagnosis ─────────────────────────────────────────────────
  app.post("/api/ai/diagnose", async (req, res) => {
    try {
      const { image, prompt, language } = req.body;
      if (!image) {
        res.status(400).json({ error: "Image is required" });
        return;
      }

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      const promptText = language === 'bn'
        ? "আপনি একজন অভিজ্ঞ কৃষি ও বনায়ন বিশেষজ্ঞ। এই উদ্ভিদের চারা বা পাতার ছবিটি বিশ্লেষণ করুন। কোনো রোগ থাকলে চিহ্নিত করুন, সলিউশন দিন, এবং কোন সার ও কীটনাশক দিতে হবে তা বাংলায় বিস্তারিত লিখুন। চারাটির বৃদ্ধির জন্য অতিরিক্ত টিপস দিন।"
        : "You are an expert plant pathologist and nursery consultant. Examine this seedling or leaf image. Identify the species, analyze any visual diseases/pests, suggest exact organic/chemical solutions, fertilizer schedules, and general care advice for optimal growth.";

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            { text: prompt ? `${promptText}\n\nUser Question: ${prompt}` : promptText },
          ]
        }
      });

      res.json({ result: response.text, timestamp: Date.now() });
    } catch (err: any) {
      console.error("Gemini Diagnosis Error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze image" });
    }
  });

  // ─── GEE NDVI (still demo — real GEE integration is a separate task) ────
  app.post("/api/gee-ndvi", async (req, res) => {
    try {
      const { bounds, date_from, date_to, division, district } = req.body;

      const seed = (district || division || "default").length;
      const ndvi_mean = parseFloat((0.55 + (seed % 10) * 0.02 + Math.random() * 0.02).toFixed(2));
      const healthy_pct = parseFloat((70 + (seed % 15) + Math.random() * 2).toFixed(1));
      const stress_pct = parseFloat((15 - (seed % 5) + Math.random() * 1).toFixed(1));
      const bare_pct = parseFloat((100 - healthy_pct - stress_pct).toFixed(1));
      const area_ha = parseFloat((25.4 + (seed % 20) * 3.5 + Math.random() * 5).toFixed(1));

      let ai_analysis = "";
      try {
        const prompt = `You are an expert GIS and forest canopy density analyst for Bangladesh.
        Given the following Sentinel-2 Multi-Spectral satellite statistics for a plantation bounds in division: ${division || 'Unknown'}, district: ${district || 'Unknown'}:
        - Mean NDVI (Normalized Difference Vegetation Index): ${ndvi_mean}
        - Healthy Canopy Percentage: ${healthy_pct}%
        - Stressed Vegetation: ${stress_pct}%
        - Bare soil/Deforested area: ${bare_pct}%
        - Evaluated area: ${area_ha} hectares
        - Date Range: ${date_from || 'Recent'} to ${date_to || 'Now'}

        Provide a brief, 3-sentence professional assessment in Bengali about this region's vegetation index, soil health, and specific tips for boosting canopy density.`;

        const response = await ai.models.generateContent({ model: "gemini-3.5-flash", contents: prompt });
        ai_analysis = response.text || "";
      } catch {
        ai_analysis = `উপগ্রহ চিত্র বিশ্লেষণে অঞ্চলটির গড় এনডিভিআই (NDVI) ${ndvi_mean} পাওয়া গেছে।`;
      }

      res.json({
        status: "success",
        source: "demo_estimate",
        ndvi_mean, healthy_pct, stress_pct, bare_pct, area_ha,
        date_from: date_from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        date_to: date_to || new Date().toISOString().split('T')[0],
        ai_analysis,
      });
    } catch (err: any) {
      console.error("GEE NDVI Error:", err);
      res.status(500).json({ error: err.message || "Failed to process NDVI analysis" });
    }
  });

  // ─── POST /api/monitoring/revisit — VM0047 Monitoring Checkpoint ─────────
  // Records a monitoring revisit with DBH, height, canopy, and health status.
  app.post("/api/monitoring/revisit", async (req, res) => {
    try {
      const {
        submissionId, stage, avgHeightM, avgDbhCm, avgCanopyRadiusM,
        vm0047HealthStatus, survivalCount, deadCount,
        latitude, longitude, accuracy,
        sdgIncomeChange, sdgSoilHealth, biodiversityNote, remarks,
      } = req.body;

      if (!submissionId || !stage) {
        res.status(400).json({ error: "submissionId and stage are required" });
        return;
      }

      const submission = await prisma.submission.findUnique({ where: { id: submissionId } });
      if (!submission) {
        res.status(404).json({ error: "Submission not found" });
        return;
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

      res.json({ status: "success", data: monitoring });
    } catch (err: any) {
      console.error("[Monitoring Revisit] Error:", err);
      res.status(500).json({ error: err.message || "Failed to record monitoring revisit" });
    }
  });

  // ─── GET /api/monitoring/:submissionId — Get monitoring history ──────────
  app.get("/api/monitoring/:submissionId", async (req, res) => {
    try {
      const monitorings = await prisma.monitoring.findMany({
        where: { submissionId: req.params.submissionId },
        orderBy: { monitoredAt: 'asc' },
      });
      res.json({ status: "success", data: monitorings });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /api/audit/carbon-stock — VM0047 Carbon Stock Report ────────────
  app.get("/api/audit/carbon-stock", async (_req, res) => {
    try {
      const submissions = await prisma.submission.findMany({
        where: { synced: true },
        include: {
          seedlings: true,
          monitorings: { orderBy: { monitoredAt: 'desc' }, take: 1 },
        },
      });

      // Aggregate carbon stats per district
      const districtCarbon: Record<string, {
        totalSeedlings: number;
        submissionsCount: number;
        healthyCount: number;
        stressedCount: number;
        deadCount: number;
      }> = {};

      for (const sub of submissions) {
        const district = sub.district || 'অজানা';
        if (!districtCarbon[district]) {
          districtCarbon[district] = { totalSeedlings: 0, submissionsCount: 0, healthyCount: 0, stressedCount: 0, deadCount: 0 };
        }
        const dc = districtCarbon[district];
        dc.submissionsCount++;
        const seedCount = sub.seedlings?.reduce((sum: number, s: any) => sum + (s.count || 0), 0) || 0;
        dc.totalSeedlings += seedCount;

        const health = sub.vm0047HealthStatus || 'healthy';
        if (health === 'healthy') dc.healthyCount++;
        else if (health === 'stressed') dc.stressedCount++;
        else if (health === 'dead') dc.deadCount++;
      }

      const totalSubmissions = submissions.length;
      const totalSeedlings = submissions.reduce(
        (sum, s) => sum + (s.seedlings?.reduce((a: number, b: any) => a + (b.count || 0), 0) || 0), 0
      );
      const healthSummary = {
        healthy: submissions.filter(s => (s.vm0047HealthStatus || 'healthy') === 'healthy').length,
        stressed: submissions.filter(s => s.vm0047HealthStatus === 'stressed').length,
        dead: submissions.filter(s => s.vm0047HealthStatus === 'dead').length,
      };

      res.json({
        status: "success",
        methodology: "VM0047_v1.1",
        report: {
          totalSubmissions,
          totalSeedlings,
          healthSummary,
          districts: Object.entries(districtCarbon).map(([name, data]) => ({ name, ...data })),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── GET /api/audit/export-geojson — GeoJSON export for external tools ───
  app.get("/api/audit/export-geojson", async (_req, res) => {
    try {
      const submissions = await prisma.submission.findMany({
        where: { latitude: { not: 0 }, longitude: { not: 0 }, synced: true },
        select: {
          id: true, clientUid: true, district: true, upazila: true,
          latitude: true, longitude: true, plantationDate: true,
          vm0047HealthStatus: true, trackingMethod: true, treeSerial: true,
          seedlings: { select: { speciesName: true, count: true } },
        },
      });

      const features = submissions.map(s => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [s.longitude, s.latitude],
        },
        properties: {
          id: s.clientUid,
          district: s.district,
          upazila: s.upazila,
          plantationDate: s.plantationDate,
          healthStatus: s.vm0047HealthStatus,
          trackingMethod: s.trackingMethod,
          treeSerial: s.treeSerial,
          seedlings: s.seedlings,
        },
      }));

      const geojson = {
        type: "FeatureCollection" as const,
        features,
        metadata: {
          source: "Plantation Tracker VM0047",
          generatedAt: new Date().toISOString(),
          featureCount: features.length,
        },
      };

      res.json(geojson);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Static files / SPA fallback ─────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-Stack Plantation Server running on http://0.0.0.0:${PORT}`);
    console.log(`[DB] SQLite: prisma/dev.db`);
    console.log(`[API] POST /api/sync — sync submissions to DB`);
    console.log(`[API] GET  /api/submissions — list with filters`);
    console.log(`[API] GET  /api/submissions/stats — aggregate dashboard data`);
    console.log(`[API] GET  /api/submissions/:id — single submission detail`);
    console.log(`[API] DEL  /api/submissions/:id — delete submission`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});