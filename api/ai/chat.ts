/**
 * Vercel serverless function: POST /api/ai/chat
 *
 * Gemini chat for the KrishiAI assistant. Supports bn / en system prompts.
 *
 * Body: { message: string, history?: {role, text}[], language?: 'bn' | 'en' }
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
    const { message, history, language } = body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const systemInstruction =
      language === 'bn'
        ? 'আপনি একজন অভিজ্ঞ বাংলাদেশী বনায়ন, উদ্ভিদ রোগ বিশেষজ্ঞ এবং নার্সারী উপদেষ্টা। ব্যবহারকারীকে সঠিক তথ্য দিন, উদ্ভিদের যত্ন নেওয়ার পরামর্শ দিন, সার প্রয়োগ এবং চারা রোপণের সঠিক গাইডলাইন প্রদান করুন। ভাষা সর্বদা সহজ ও প্রাঞ্জল বাংলা রাখুন।'
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
}
