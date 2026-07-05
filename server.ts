import "dotenv/config";
import express from "express";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// ─── Prisma Client ─────────────────────────────────────────────────────────
const prisma = new PrismaClient();
prisma.$connect().then(() => console.log("[DB] Connected to database"));

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
              seedlings: {
                create: (draft.seedlings || []).map((s: any) => ({
                  plantTypeId: s.plantTypeId || null,
                  speciesId: s.speciesId || null,
                  speciesName: s.speciesName || '',
                  count: parseInt(s.count) || 0,
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