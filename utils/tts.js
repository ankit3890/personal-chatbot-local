// Optional server-side TTS helpers (example using ElevenLabs)
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

export async function elevenLabsTTSStream(text, voice = 'alloy') {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('Missing ELEVENLABS_API_KEY');
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text })
  });
  if (!r.ok) throw new Error('TTS request failed: ' + await r.text());
  return r.body; // stream
}