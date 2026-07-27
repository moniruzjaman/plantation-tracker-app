/**
 * Vercel serverless function: POST /api/ai/diagnose
 *
 * Gemini image diagnosis for plant pathology. Receives a base64 image,
 * asks Gemini to identify the species + any diseases/pests + suggest
 * fertilizer + care advice.
 *
 * Body: { image: string (base64 data URL), prompt?: string, language?: 'bn' | 'en' }
 */

import { getAI } from '../_lib/ai';
import { setCorsHeaders, parseBody } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const { image, prompt, language } = body;
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const promptText =
      language === 'bn'
        ? 'আপনি একজন অভিজ্ঞ কৃষি ও বনায়ন বিশেষজ্ঞ। এই উদ্ভিদের চারা বা পাতার ছবিটি বিশ্লেষণ করুন। কোনো রোগ থাকলে চিহ্নিত করুন, সলিউশন দিন, এবং কোন সার ও কীটনাশক দিতে হবে তা বাংলায় বিস্তারিত লিখুন। চারাটির বৃদ্ধির জন্য অতিরিক্ত টিপস দিন।'
        : 'You are an expert plant pathologist and nursery consultant. Examine this seedling or leaf image. Identify the species, analyze any visual diseases/pests, suggest exact organic/chemical solutions, fertilizer schedules, and general care advice for optimal growth.';

    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
          { text: prompt ? `${promptText}\n\nUser Question: ${prompt}` : promptText },
        ],
      },
    });

    res.status(200).json({ result: response.text, timestamp: Date.now() });
  } catch (err: any) {
    console.error('Gemini Diagnosis Error:', err);
    res.status(500).json({ error: err.message || 'Failed to analyze image' });
  }
}
