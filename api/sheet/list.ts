/**
 * Vercel serverless function: GET /api/sheet/list
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM server.ts:
 * vercel.json builds this project as a static site (`buildCommand: vite
 * build`, `outputDirectory: dist`) -- it does NOT run server.ts. server.ts
 * is a persistent Express + Prisma/SQLite process meant for local dev
 * (`npm run dev`) or a non-Vercel host; SQLite's file-based storage isn't
 * compatible with Vercel's ephemeral serverless filesystem anyway. Because
 * of that, every /api/* route under server.ts -- including the sheet-sync
 * route added there -- 404s on the live Vercel deployment. That's the
 * actual reason the ম্যাপ tab was stuck on the old 36-row snapshot: the
 * live-sheet fetch never had anywhere to land, so useSheetPlantations()
 * silently fell back every time.
 *
 * This file is Vercel's zero-config way of picking up a serverless
 * function (any file under /api). It needs no database, so it works fine
 * standalone -- it just proxies the Apps Script /exec URL server-side
 * (browsers can't call GAS directly, CORS) with a short in-memory cache.
 *
 * Set GAS_WEBHOOK_URL in the Vercel project's Environment Variables to the
 * Apps Script deployment's /exec URL to enable this.
 */

const GAS_SHEET_CACHE_MS = 5 * 60 * 1000; // 5 minutes
let cache: { fetchedAt: number; payload: any } | null = null;

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");

  const GAS_WEBHOOK_URL = process.env.GAS_WEBHOOK_URL || "";
  if (!GAS_WEBHOOK_URL) {
    res.status(200).json({ status: "disabled", reason: "GAS_WEBHOOK_URL not configured", entries: [] });
    return;
  }

  try {
    const forceRefresh = req.query?.refresh === "1";

    if (!forceRefresh && cache && Date.now() - cache.fetchedAt < GAS_SHEET_CACHE_MS) {
      res.status(200).json({ ...cache.payload, cached: true });
      return;
    }

    const url = new URL(GAS_WEBHOOK_URL);
    url.searchParams.set("list", "1");
    const gasRes = await fetch(url.toString(), { method: "GET" });
    const data = await gasRes.json();

    cache = { fetchedAt: Date.now(), payload: data };
    res.status(200).json({ ...(data as object), cached: false });
  } catch (err: any) {
    if (cache) {
      res.status(200).json({ ...cache.payload, cached: true, stale: true, error: err.message });
      return;
    }
    res.status(502).json({ status: "error", error: err.message, entries: [] });
  }
}
