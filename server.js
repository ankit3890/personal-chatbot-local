// server.js - debug-friendly Gemini/OpenAI router (ESM)
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
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

function activeMode() {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "none";
}

// print env at startup
console.log("--- startup: reading env ----");
console.log("GEMINI_API_KEY present?", !!process.env.GEMINI_API_KEY);
console.log("GEMINI_MODEL =", process.env.GEMINI_MODEL);
console.log("OPENAI_API_KEY present?", !!process.env.OPENAI_API_KEY);
console.log("--- end env ----");

app.get("/health", (req, res) =>
  res.json({ ok: true, mode: activeMode(), env_model: process.env.GEMINI_MODEL || null })
);

app.post("/api/chat", async (req, res) => {
  try {
    const prompt = (req.body?.prompt || "").toString().trim();
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const mode = activeMode();
    if (mode === "openai") {
      return res.status(500).json({ error: "OpenAI path disabled for debug" });
    }
    if (mode !== "gemini") {
      return res.status(500).json({ error: "No GEMINI_API_KEY set" });
    }

    const GEMINI_MODEL = process.env.GEMINI_MODEL || "models/gemini-2.5-flash";
    console.log("[API] Using GEMINI_MODEL from env:", GEMINI_MODEL);

    const endpoint = `https://generativelanguage.googleapis.com/v1/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    console.log("[API] POST to:", endpoint);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const bodyText = await resp.text();
    console.log("[API] raw response status=", resp.status);
    console.log("[API] raw response body (first 2000 chars):\n", bodyText.substring(0, 2000));

    let data = null;
    try {
      data = JSON.parse(bodyText);
    } catch (e) {
      /* ignore JSON parse errors */
    }

    if (!resp.ok) return res.status(resp.status).json({ error: "Gemini API error", details: data || bodyText });

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? data?.output_text ?? null;
    return res.json({ answer: answer || "No text in response", raw: data ?? bodyText });
  } catch (err) {
    console.error("[Server] unexpected", err);
    return res.status(500).json({ error: "Internal Server Error", details: err?.message || String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log("Active mode =", activeMode());
});
