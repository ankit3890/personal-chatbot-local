// server.js
import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(bodyParser.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function activeMode() {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "none";
}

app.get("/health", (req, res) => {
  const mode = activeMode();
  res.json({
    ok: true,
    mode,
    model: mode === "openai" ? process.env.OPENAI_MODEL || null : process.env.GEMINI_MODEL || null,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const promptRaw = req.body?.prompt;
    const prompt = typeof promptRaw === "string" ? promptRaw.trim() : "";
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const mode = activeMode();
    if (mode === "none") {
      return res.status(500).json({ error: "No API key found. Set OPENAI_API_KEY or GEMINI_API_KEY." });
    }

    // OPENAI path
    if (mode === "openai") {
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

      if (!OPENAI_API_KEY) return res.status(500).json({ error: "OPENAI_API_KEY is not set" });

      console.log(`[API] Using OpenAI model=${model}`);

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
          temperature: 0.2,
        }),
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        console.error("[OpenAI] error", data || await resp.text());
        return res.status(resp.status).json({ error: "OpenAI error", details: data || "No JSON body" });
      }

      const answer = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";
      return res.json({ answer: (answer || "").toString().trim(), raw: data });
    }

    // GEMINI path
    if (mode === "gemini") {
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
      const GEMINI_MODEL = process.env.GEMINI_MODEL || "models/gemini-2.5-flash";

      if (!GEMINI_API_KEY) return res.status(500).json({ error: "GEMINI_API_KEY is not set" });

      console.log(`[API] Using Gemini model=${GEMINI_MODEL}`);

      const endpoint = `https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

      const body = {
        contents: [{ parts: [{ text: prompt }] }],
      };

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const text = await resp.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // not JSON
      }

      if (!resp.ok) {
        console.error("[Gemini] error", data || text);
        return res.status(resp.status || 500).json({ error: "Gemini API error", details: data || text });
      }

      const answer =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        data?.output_text ??
        data?.candidates?.[0]?.output ??
        "";

      return res.json({ answer: (answer || "").toString().trim(), raw: data ?? text });
    }

    return res.status(500).json({ error: "Unsupported mode" });
  } catch (err) {
    console.error("[Server] unexpected error:", err);
    return res.status(500).json({ error: "Internal Server Error", details: err?.message ?? String(err) });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  const mode = activeMode();
  if (mode === "openai") {
    console.log("🔹 Mode: OpenAI");
    console.log("🔹 Model:", process.env.OPENAI_MODEL || "gpt-4o-mini");
  } else if (mode === "gemini") {
    console.log("🔹 Mode: Gemini");
    console.log("🔹 Model:", process.env.GEMINI_MODEL || "models/gemini-2.5-flash");
  } else {
    console.log("⚠️  No API key found (OPENAI_API_KEY or GEMINI_API_KEY).");
  }
});
