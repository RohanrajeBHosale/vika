// api/transcribe.js
// Receives a raw audio blob (webm/ogg), sends to OpenAI Whisper, returns transcript

import OpenAI from "openai";
import { toFile } from "openai/uploads";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Read raw body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers["content-type"] || "audio/webm";
    const ext = contentType.includes("ogg") ? "ogg" : "webm";

    const file = await toFile(buffer, `audio.${ext}`, { type: contentType });

    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "en",
    });

    res.json({ transcript: result.text });
  } catch (err) {
    console.error("Transcribe error:", err);
    res.status(500).json({ error: err.message });
  }
}
