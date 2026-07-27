/**
 * Vercel serverless function: POST /api/gee-ndvi
 *
 * DEMO endpoint — generates plausible NDVI statistics seeded by district
 * name + asks Gemini for a brief Bengali assessment.
 *
 * Real Google Earth Engine integration is a separate task (needs a GCP
 * service account + earthengine-api). For now this returns the same shape
 * of data the real endpoint will return, so the client doesn't break.
 *
 * Body: { bounds?, date_from?, date_to?, division?, district? }
 */

import { getAI } from './_lib/ai';
import { setCorsHeaders, parseBody } from './_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const { date_from, date_to, division, district } = body;

    const seed = (district || division || 'default').length;
    const ndvi_mean = parseFloat(
      (0.55 + (seed % 10) * 0.02 + Math.random() * 0.02).toFixed(2)
    );
    const healthy_pct = parseFloat((70 + (seed % 15) + Math.random() * 2).toFixed(1));
    const stress_pct = parseFloat((15 - (seed % 5) + Math.random() * 1).toFixed(1));
    const bare_pct = parseFloat((100 - healthy_pct - stress_pct).toFixed(1));
    const area_ha = parseFloat((25.4 + (seed % 20) * 3.5 + Math.random() * 5).toFixed(1));

    let ai_analysis = '';
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

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });
      ai_analysis = response.text || '';
    } catch {
      ai_analysis = `উপগ্রহ চিত্র বিশ্লেষণে অঞ্চলটির গড় এনডিভিআই (NDVI) ${ndvi_mean} পাওয়া গেছে।`;
    }

    res.status(200).json({
      status: 'success',
      source: 'demo_estimate',
      ndvi_mean,
      healthy_pct,
      stress_pct,
      bare_pct,
      area_ha,
      date_from:
        date_from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      date_to: date_to || new Date().toISOString().split('T')[0],
      ai_analysis,
    });
  } catch (err: any) {
    console.error('GEE NDVI Error:', err);
    res.status(500).json({ error: err.message || 'Failed to process NDVI analysis' });
  }
}
