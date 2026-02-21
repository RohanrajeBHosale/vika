// api/book.js
// Creates a Google Calendar event from booking data

import { getOAuthClient } from "../lib/gcal.js";
import { google } from "googleapis";

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, decodeURIComponent(v.join("="))];
    })
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, date, time, title, duration = 60 } = req.body;

  if (!name || !date || !time) {
    return res.status(400).json({ error: "name, date, and time are required" });
  }

  // Get tokens from cookie
  const cookies = parseCookies(req.headers.cookie);
  if (!cookies.gcal_tokens) {
    return res.status(401).json({ error: "not_authorized", message: "Google Calendar not connected" });
  }

  try {
    const tokens = JSON.parse(Buffer.from(cookies.gcal_tokens, "base64").toString());
    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials(tokens);

    // Refresh tokens if needed and update cookie
    oauth2Client.on("tokens", (newTokens) => {
      const merged = { ...tokens, ...newTokens };
      const encoded = Buffer.from(JSON.stringify(merged)).toString("base64");
      res.setHeader("Set-Cookie", `gcal_tokens=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const eventTitle = title || `Meeting with ${name}`;

    // Build start/end datetimes
    const startDT = new Date(`${date}T${time}:00`);
    if (isNaN(startDT)) throw new Error(`Invalid date/time: ${date} ${time}`);
    const endDT = new Date(startDT.getTime() + duration * 60000);

    const event = {
      summary: eventTitle,
      description: `Scheduled via Aria — Voice Scheduling Agent\nRequested by: ${name}`,
      start: {
        dateTime: startDT.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      },
      end: {
        dateTime: endDT.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 60 },
          { method: "popup", minutes: 10 },
        ],
      },
    };

    const created = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    res.json({
      success: true,
      eventId: created.data.id,
      eventTitle,
      link: created.data.htmlLink,
      start: startDT.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  } catch (err) {
    console.error("Book error:", err);
    res.status(500).json({ error: err.message });
  }
}
