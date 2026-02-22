// api/chat.js
// Receives conversation history + user message → Groq chat model → returns reply + extracted booking data

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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GROQ_API_KEY is not set" });
    }

    const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        temperature: 0.6,
        max_tokens: 150,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errMsg = data?.error?.message || `Groq HTTP ${response.status}`;
      return res.status(response.status).json({ error: errMsg, code: data?.error?.code || null });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: "Groq returned an empty response" });
    }

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
    res.status(500).json({ error: err?.message || "Chat failed" });
  }
}
