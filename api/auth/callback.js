// api/auth/callback.js
// Receives OAuth code, exchanges for tokens, stores in cookie, redirects home

import { getOAuthClient } from "../../lib/gcal.js";

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect("/?auth=error");
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    // Encode tokens as base64 and store in a cookie (7 days)
    const encoded = Buffer.from(JSON.stringify(tokens)).toString("base64");

    res.setHeader(
      "Set-Cookie",
      `gcal_tokens=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );
    res.redirect("/?auth=success");
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.redirect("/?auth=error");
  }
}
