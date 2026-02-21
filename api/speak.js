// api/speak.js
// Sends text to ElevenLabs, streams MP3 audio back to the browser

export const config = { api: { responseLimit: "10mb" } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });

  const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "RBJ2S1JklYXJtRTqaggc";
  const API_KEY = process.env.ELEVENLABS_API_KEY;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("ElevenLabs error:", err);
      return res.status(500).json({ error: err });
    }

    const audioBuffer = await response.arrayBuffer();

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-cache");
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error("Speak error:", err);
    res.status(500).json({ error: err.message });
  }
}
