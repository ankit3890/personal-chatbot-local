// server.js
import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// 🧠 Health check route
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    mode: "openai",
    model: OPENAI_MODEL,
    timestamp: new Date().toISOString(),
  });
});

// 🧩 Chat route
app.post("/api/chat", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });
    if (!OPENAI_KEY)
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("[OpenAI error]", data.error);
      return res.status(500).json({ error: "OpenAI error", details: data.error });
    }

    const text = data.choices?.[0]?.message?.content?.trim() || "No response.";
    res.json({ answer: text });
  } catch (err) {
    console.error("[server] /api/chat failed:", err);
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// 🌍 Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔹 Mode: OpenAI`);
  console.log(`🔹 Model: ${OPENAI_MODEL}`);
});
