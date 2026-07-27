/**
 * Vercel serverless function: Handle AI routes
 *   POST /api/ai/chat
 *   POST /api/ai/diagnose
 */

import { getAI } from '../_lib/ai';
import { setCorsHeaders, parseBody } from '../_lib/helpers';

export default async function handler(req: any, res: any) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const slug = Array.isArray(req.query.slug) ? req.query.slug : [req.query.slug].filter(Boolean);
  const pathSlug = slug.join('/'); // e.g., 'chat' or 'diagnose'

  // POST /api/ai/chat
  if (req.method === 'POST' && pathSlug === 'chat') {
    try {
      const body = await parseBody(req);
      const { message, history, language } = body;
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const systemInstruction =
        language === 'bn'
          ? 'আপনি একজন অভিজ্ঞ বাংলাদেশী বনায়ন, উদ্ভিদ রोग বিশেষজ্ঞ এবং নার্সারী উপদেষ্টা। ব্যবহারকারীকে সঠিক তথ্য দিন, উদ্ভিদের যত্ন নেওয়ার পরামর্শ দিন, সার প্রয়োগ এবং চারা রোপণের সঠিক গাইডলাইন প্রদান করুন। ভাষা সর্বদা সহজ ও প্রাঞ্জল বাংলা রাখুন。'
          : 'You are an expert Bangladeshi forestry, silviculture, and plant pathology consultant. Provide highly helpful, polite, and actionable advice on tree species selection, nursery seedling management, diseases, carbon sequestration, and soil conditions in Bangladesh. Keep answers clear and engaging.';

      const formattedHistory = Array.isArray(history)
        ? history.map((item: any) => ({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.text || item.message || '' }],
          }))
        : [];

      const ai = getAI();
      const chat = ai.chats.create({
        model: 'gemini-3.5-flash',
        history: formattedHistory,
        config: { systemInstruction },
      });

      const response = await chat.sendMessage({ message });
      res.status(200).json({ text: response.text, timestamp: Date.now() });
    } catch (err: any) {
      console.error('Gemini Chat Error:', err);
      res.status(500).json({ error: err.message || 'Failed to communicate with AI Assistant' });
    }
    return;
  }

  // POST /api/ai/diagnose
  if (req.method === 'POST' && pathSlug === 'diagnose') {
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
    return;
  }

  // If none of the above matched
  return res.status(404).json({ error: 'Not found' });
}