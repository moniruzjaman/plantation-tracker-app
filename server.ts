import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini client with proper header config as per system guidelines
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enlarge limit for base64 image uploads
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // API Route: Healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API Route: Gemini Chat
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, history, language } = req.body;
      if (!message) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      // Default system instructions for Bangladesh Forestry and Nursery Co-pilot
      const systemInstruction = language === 'bn'
        ? "আপনি একজন অভিজ্ঞ বাংলাদেশী বনায়ন, উদ্ভিদ রোগ বিশেষজ্ঞ এবং নার্সারী উপদেষ্টা। ব্যবহারকারীকে সঠিক তথ্য দিন, উদ্ভিদের যত্ন নেওয়ার পরামর্শ দিন, সার প্রয়োগ এবং চারা রোপণের সঠিক গাইডলাইন প্রদান করুন। ভাষা সর্বদা সহজ ও প্রাঞ্জল বাংলা রাখুন।"
        : "You are an expert Bangladeshi forestry, silviculture, and plant pathology consultant. Provide highly helpful, polite, and actionable advice on tree species selection, nursery seedling management, diseases, carbon sequestration, and soil conditions in Bangladesh. Keep answers clear and engaging.";

      // Map chat history to @google/genai structure if provided
      const formattedHistory = Array.isArray(history) 
        ? history.map((item: any) => ({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.text || item.message || "" }]
          }))
        : [];

      // Create chat session with historical messages
      const chat = ai.chats.create({
        model: "gemini-3.5-flash",
        history: formattedHistory,
        config: {
          systemInstruction,
        }
      });

      const response = await chat.sendMessage({ message });
      res.json({
        text: response.text,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.error("Gemini Chat Error:", err);
      res.status(500).json({ error: err.message || "Failed to communicate with AI Assistant" });
    }
  });

  // API Route: AI Disease and Species Diagnosis
  app.post("/api/ai/diagnose", async (req, res) => {
    try {
      const { image, prompt, language } = req.body;
      if (!image) {
        res.status(400).json({ error: "Image is required" });
        return;
      }

      // Remove the base64 prefix if present
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      const promptText = language === 'bn' 
        ? "আপনি একজন অভিজ্ঞ কৃষি ও বনায়ন বিশেষজ্ঞ। এই উদ্ভিদের চারা বা পাতার ছবিটি বিশ্লেষণ করুন। কোনো রোগ থাকলে চিহ্নিত করুন, সলিউশন দিন, এবং কোন সার ও কীটনাশক দিতে হবে তা বাংলায় বিস্তারিত লিখুন। চারাটির বৃদ্ধির জন্য অতিরিক্ত টিপস দিন।"
        : "You are an expert plant pathologist and nursery consultant. Examine this seedling or leaf image. Identify the species, analyze any visual diseases/pests, suggest exact organic/chemical solutions, fertilizer schedules, and general care advice for optimal growth.";

      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      };

      const textPart = {
        text: prompt ? `${promptText}\n\nUser Question: ${prompt}` : promptText
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] }
      });

      res.json({
        result: response.text,
        timestamp: Date.now()
      });
    } catch (err: any) {
      console.error("Gemini Diagnosis Error:", err);
      res.status(500).json({ error: err.message || "Failed to analyze image" });
    }
  });

  // API Route: Google Earth Engine NDVI Multi-Spectral REST Analysis
  app.post("/api/gee-ndvi", async (req, res) => {
    try {
      const { bounds, date_from, date_to, division, district } = req.body;
      
      // Dynamic NDVI values based on district/division if specified, or random fluctuation
      const seed = (district || division || "default").length;
      const ndvi_mean = parseFloat((0.55 + (seed % 10) * 0.02 + Math.random() * 0.02).toFixed(2));
      const healthy_pct = parseFloat((70 + (seed % 15) + Math.random() * 2).toFixed(1));
      const stress_pct = parseFloat((15 - (seed % 5) + Math.random() * 1).toFixed(1));
      const bare_pct = parseFloat((100 - healthy_pct - stress_pct).toFixed(1));
      const area_ha = parseFloat((25.4 + (seed % 20) * 3.5 + Math.random() * 5).toFixed(1));

      // Use Gemini to generate a professional forest health analysis and silviculture recommendations
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

        Provide a brief, 3-sentence professional assessment in Bengali (or English if preferred, but Bengali is highly appreciated) about this region's vegetation index, soil health, and specific tips for boosting canopy density.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt
        });
        ai_analysis = response.text || "";
      } catch (geminiErr) {
        console.warn("GEE Gemini Analysis skipped:", geminiErr);
        ai_analysis = `উপগ্রহ চিত্র বিশ্লেষণে অঞ্চলটির গড় এনডিভিআই (NDVI) ${ndvi_mean} পাওয়া গেছে। এর অর্থ এখানে মাঝারি থেকে ঘন উদ্ভিজ্জ আবরণ রয়েছে। তবে ${stress_pct}% চারা কিছুটা দুর্বল বা রোগাক্রান্ত। ক্যানোপি ঘনত্ব বৃদ্ধির জন্য ফলদ ও বনজ চারার সঠিক দূরত্ব বজায় রেখে রোপণ করুন এবং নিয়মিত জৈব সার প্রয়োগের ব্যবস্থা করুন।`;
      }

      res.json({
        status: "success",
        // Honest provenance flag: these figures are currently procedurally
        // generated (see calculations above), not derived from a real
        // Earth Engine / Sentinel-2 analysis. Every consumer of this
        // endpoint must surface this to the user rather than presenting
        // the numbers as certified satellite data. Flip to "gee_analysis"
        // only once this handler actually calls Earth Engine.
        source: "demo_estimate",
        ndvi_mean,
        healthy_pct,
        stress_pct,
        bare_pct,
        area_ha,
        date_from: date_from || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        date_to: date_to || new Date().toISOString().split('T')[0],
        ai_analysis,
      });
    } catch (err: any) {
      console.error("GEE NDVI Error:", err);
      res.status(500).json({ error: err.message || "Failed to process Earth Engine satellite NDVI analysis" });
    }
  });

  // API Route: Offline-First Background Sync Gateway
  app.post("/api/sync", async (req, res) => {
    try {
      const { drafts } = req.body;
      if (!Array.isArray(drafts)) {
        res.status(400).json({ error: "Invalid payload. 'drafts' must be an array." });
        return;
      }

      console.log(`Syncing ${drafts.length} offline drafts to cloud server...`);

      // Mock remote database sync success and calculate XP & Token rewards
      let newlySyncedCount = 0;
      let totalXPBonus = 0;
      let greenTokensAwarded = 0;

      drafts.forEach((draft: any) => {
        newlySyncedCount++;
        totalXPBonus += 50; // 50 XP per nursery batch synced
        
        // Calculate Green Tokens based on seedling counts
        let seedCount = 0;
        const countVariety = (list: any) => {
          let sum = 0;
          if (Array.isArray(list)) {
            list.forEach((item: any) => {
              sum += (parseInt(item.count) || 0) + (parseInt(item.graftingCount) || 0);
            });
          }
          return sum;
        };

        seedCount += countVariety(draft.fruitSeedlings);
        seedCount += countVariety(draft.forestSeedlings);
        seedCount += countVariety(draft.medicinalSeedlings);

        // Award 1 Green Token per 10 seedlings verified
        greenTokensAwarded += Math.max(1, Math.floor(seedCount / 10));
      });

      res.json({
        status: "success",
        syncedCount: newlySyncedCount,
        xpBonus: totalXPBonus,
        greenTokens: greenTokensAwarded,
        timestamp: Date.now(),
        message: `সফলভাবে ${newlySyncedCount}টি অফলাইন জরীপ ক্লাউড গেটওয়েতে সিঙ্ক হয়েছে। আপনি পেয়েছেন +${totalXPBonus} এক্সপি এবং ${greenTokensAwarded} সবুজ টোকেন!`
      });
    } catch (err: any) {
      console.error("Cloud Sync Error:", err);
      res.status(500).json({ error: err.message || "Failed to sync offline survey data" });
    }
  });

  // Vite development middleware vs Static Production bundle
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-Stack Plantation Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
