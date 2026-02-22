// api/transcribe.js
import OpenAI from "openai";
import { toFile } from "openai/uploads";

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    if (buffer.length < 1000) {
      return res.json({ transcript: "" });
    }

    console.log(`Transcribing ${(buffer.length / 1024).toFixed(1)}KB audio`);

    const contentType = req.headers["content-type"] || "audio/webm";
    const ext = contentType.includes("ogg") ? "ogg" :
                contentType.includes("mp4") ? "mp4" : "webm";

    const file = await toFile(buffer, `audio.${ext}`, { type: contentType });

    // Keep each attempt short so the function never hits Vercel's 30s ceiling.
    async function transcribeWithTimeout(model, timeoutMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await openai.audio.transcriptions.create(
          {
            file,
            model,
            language: "en",
          },
          { signal: controller.signal }
        );
      } finally {
        clearTimeout(timer);
      }
    }

    let result;
    try {
      // Faster model first to reduce Vercel runtime timeouts.
      result = await transcribeWithTimeout("gpt-4o-mini-transcribe", 12000);
    } catch (firstErr) {
      console.warn("Fast transcribe attempt failed, falling back to whisper-1:", firstErr?.message || firstErr);
      result = await transcribeWithTimeout("whisper-1", 12000);
    }

    console.log("Transcript:", result.text);
    res.json({ transcript: result.text });
  } catch (err) {
    console.error("Transcribe error:", err);
    const msg = err?.name === "AbortError"
      ? "Transcription timed out. Please try a shorter clip."
      : (err?.message || "Transcription failed");
    res.status(504).json({ error: msg });
  }
}
