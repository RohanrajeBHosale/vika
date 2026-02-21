# 🎙️ Aria — Voice Scheduling Agent

Real-time voice assistant that books Google Calendar events.
No prebuilt chatbots — fully custom pipeline you own.

```
Browser mic → OpenAI Whisper (STT) → GPT-4o (brain) → ElevenLabs TTS → speaker
                                           ↓ on confirmation
                                    Google Calendar API
```

---

## Deploy in 10 Minutes

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/aria-scheduler.git
git push -u origin main
```

### Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework Preset: **Other**
4. Root Directory: `/` (leave default)
5. Click **Deploy** (it will fail on first deploy — that's fine, we need to add env vars next)

### Step 3 — Add Environment Variables

In Vercel Dashboard → Your Project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | `sk-...` |
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key |
| `ELEVENLABS_VOICE_ID` | `RBJ2S1JklYXJtRTqaggc` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://YOUR-APP.vercel.app/api/auth/callback` |

Then **Redeploy** (Deployments tab → ••• → Redeploy).

### Step 4 — Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or use existing)
3. **APIs & Services → Enable APIs** → search "Google Calendar API" → Enable
4. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized redirect URIs: `https://YOUR-APP.vercel.app/api/auth/callback`
5. Copy the **Client ID** and **Client Secret** into Vercel env vars
6. Redeploy

### Step 5 — Connect Google Calendar

Visit your deployed URL and click **"Connect Google Calendar →"** in the sidebar.
Authorize access. You'll be redirected back with a green "connected" indicator.

### Step 6 — Start talking!

Click the blue orb. Say your name, pick a date and time, confirm — done.

---

## How It Works

### Voice Pipeline

1. **Mic capture** — Browser `MediaRecorder` captures audio as WebM/Opus
2. **Silence detection** — Volume analyser stops recording after ~2.5s of silence
3. **Whisper STT** — Audio blob POSTed to `/api/transcribe` → OpenAI Whisper → text
4. **GPT-4o** — Full conversation history sent to `/api/chat` → next reply + optional booking JSON
5. **ElevenLabs TTS** — Reply text sent to `/api/speak` → MP3 audio → plays in browser
6. **Google Calendar** — On confirmation, `/api/book` creates real calendar event

### Conversation Logic

GPT-4o follows a strict system prompt to:
- Collect name → date → time → title in order
- Confirm each detail out loud
- Ask for final confirmation before booking
- Return a `BOOKING:{...}` JSON payload that triggers the calendar API

### Auth Flow

Google OAuth tokens are stored in an **HttpOnly cookie** (base64 encoded).
Tokens auto-refresh via the googleapis library.

---

## File Structure

```
aria-scheduler/
├── api/
│   ├── transcribe.js     # Whisper STT endpoint
│   ├── chat.js           # GPT-4o conversation endpoint
│   ├── speak.js          # ElevenLabs TTS endpoint
│   ├── book.js           # Google Calendar event creation
│   └── auth/
│       ├── google.js     # Start OAuth flow
│       └── callback.js   # Handle OAuth callback + set cookie
├── lib/
│   └── gcal.js           # Shared Google OAuth client
├── public/
│   └── index.html        # Full frontend (mic → UI → playback)
├── vercel.json
├── package.json
└── .env.example
```

---

## Local Development

```bash
npm install
cp .env.example .env   # fill in your keys

# Install Vercel CLI
npm i -g vercel

# Run locally (mimics Vercel serverless)
vercel dev
```

For Google OAuth locally, set `GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback`
and add `http://localhost:3000/api/auth/callback` as an authorized redirect URI in Google Cloud Console.

---

## Troubleshooting

**Orb clicks but nothing happens** → Check browser mic permissions (click the lock icon in URL bar)

**"TTS failed"** → Verify `ELEVENLABS_API_KEY` is correct in Vercel env vars. Redeploy after changing.

**Calendar not connecting** → Make sure `GOOGLE_REDIRECT_URI` exactly matches the URI you added in Google Cloud Console (including no trailing slash).

**Events not being created** → Connect Google Calendar first (click the sidebar link). Check Vercel function logs for errors.

**Whisper returns empty** → Speak clearly and wait for silence detection to kick in (~2.5s of quiet).
