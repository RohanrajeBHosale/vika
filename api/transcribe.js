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

    const result = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "en",
    });

    console.log("Transcript:", result.text);
    res.json({ transcript: result.text });
  } catch (err) {
    console.error("Transcribe error:", err);
    res.status(500).json({ error: err.message });
  }
}
