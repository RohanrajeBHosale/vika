// api/transcribe.js
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

    async function transcribeWithFetch(timeoutMs) {
      const form = new FormData();
      const audioFile = await toFile(buffer, `audio.${ext}`, { type: contentType });
      form.append("file", audioFile);
      form.append("model", "gpt-4o-mini-transcribe");
      form.append("language", "en");

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: form,
          signal: controller.signal,
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const msg = data?.error?.message || `OpenAI HTTP ${resp.status}`;
          throw new Error(msg);
        }
        return data;
      } finally {
        clearTimeout(timer);
      }
    }

    // Single short attempt only; fallback retries increase timeout risk on Vercel.
    const data = await transcribeWithFetch(9000);

    console.log("Transcript:", data.text || "");
    res.json({ transcript: data.text || "" });
  } catch (err) {
    console.error("Transcribe error:", err);
    const msg = err?.name === "AbortError"
      ? "Transcription timed out. Please try a shorter clip."
      : (err?.message || "Transcription failed");
    res.status(504).json({ error: msg });
  }
}
