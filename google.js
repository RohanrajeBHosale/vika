// api/auth/google.js
// Redirects user to Google OAuth consent screen

import { getOAuthClient } from "../../lib/gcal.js";

export default function handler(req, res) {
  const oauth2Client = getOAuthClient();

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
  });

  res.redirect(url);
}
