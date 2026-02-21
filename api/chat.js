// api/chat.js
// Receives conversation history + user message → GPT-4o → returns reply + extracted booking data

import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are Aria, a warm and efficient voice scheduling assistant.
Your ONLY job is to collect the details needed to create a calendar event, then confirm and book it.

CONVERSATION FLOW — follow this exactly:
1. Greet the user and ask for their name.
2. Ask what date they'd like (accept natural language like "next Tuesday", "March 5th").
   Always echo back the full date for confirmation: "That's Tuesday, March 4th, 2025 — correct?"
3. Ask what time works. Always clarify AM/PM if not stated.
4. Ask if they have a title or topic for the meeting. If they hesitate or say no, say "No problem, I'll use 'Meeting with [name]'".
5. Read back ALL details clearly: name, date, time, and title.
6. Ask: "Shall I go ahead and book this?" 
7. If YES → respond with exactly this JSON block on its own line (nothing else after it):
   BOOKING:{"name":"...","date":"YYYY-MM-DD","time":"HH:MM","title":"...","duration":60}
8. If NO → ask what they'd like to change.

RULES:
- Be conversational and concise. One question at a time.
- Never ask two questions in one message.
- If the user says something off-topic, gently redirect: "I can help with that after we get your meeting booked!"
- For dates, always convert to YYYY-MM-DD (today is ${new Date().toISOString().split("T")[0]}).
- For times, always use 24h HH:MM format internally.
- Keep responses SHORT — this is voice, not text. Max 2 sentences per turn.
- Do not use bullet points, markdown, or special characters. Plain speech only.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.6,
      max_tokens: 150,
    });

    const reply = completion.choices[0].message.content.trim();

    // Check if GPT included a BOOKING payload
    const bookingMatch = reply.match(/BOOKING:(\{.+\})/);
    let booking = null;
    let spokenReply = reply;

    if (bookingMatch) {
      try {
        booking = JSON.parse(bookingMatch[1]);
        // Strip the JSON from the spoken text
        spokenReply = reply.replace(/BOOKING:\{.+\}/, "").trim();
        if (!spokenReply) {
          spokenReply = "Perfect! Let me create that event for you right now.";
        }
      } catch {
        // JSON parse failed — treat as normal reply
      }
    }

    res.json({ reply: spokenReply, booking });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err.message });
  }
}
