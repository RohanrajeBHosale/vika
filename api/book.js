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

function addMinutesLocal(dateStr, timeStr, minutesToAdd) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  dt.setUTCMinutes(dt.getUTCMinutes() + minutesToAdd);
  const yyyy = dt.getUTCFullYear();
  const MM = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const DD = String(dt.getUTCDate()).padStart(2, "0");
  const HH = String(dt.getUTCHours()).padStart(2, "0");
  const MIN = String(dt.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${MM}-${DD}T${HH}:${MIN}:00`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, date, time, title, duration = 60, timeZone } = req.body;

  if (!name || !date || !time) {
    return res.status(400).json({ error: "name, date, and time are required" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: "date must be YYYY-MM-DD and time must be HH:MM" });
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
    const tz = timeZone || "America/New_York";
    const durationMin = Number.isFinite(Number(duration)) ? Number(duration) : 60;
    const safeDuration = Math.max(15, Math.min(480, durationMin));

    // Keep local wall-clock time exactly as provided by the user and apply timezone explicitly.
    const startLocal = `${date}T${time}:00`;
    const endLocal = addMinutesLocal(date, time, safeDuration);

    const event = {
      summary: eventTitle,
      description: `Scheduled via Aria — Voice Scheduling Agent\nRequested by: ${name}`,
      start: {
        dateTime: startLocal,
        timeZone: tz,
      },
      end: {
        dateTime: endLocal,
        timeZone: tz,
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
      start: `${date} ${time}`,
      timeZone: tz,
    });
  } catch (err) {
    console.error("Book error:", err);
    res.status(500).json({ error: err.message });
  }
}
