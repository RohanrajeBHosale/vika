# Aria Voice Scheduling Agent

Voice-first scheduling assistant that collects meeting details and creates Google Calendar events after confirmation.

## Repository

- GitHub: [https://github.com/RohanrajeBHosale/vika](https://github.com/RohanrajeBHosale/vika)

## Deployed App

- Production URL: [https://vika-drab.vercel.app](https://vika-drab.vercel.app)

## How To Test The Agent

1. Open [https://vika-drab.vercel.app](https://vika-drab.vercel.app).
2. Click `Connect Google Calendar` and complete OAuth.
3. Click `Start Session`.
4. Click `Speak Now`, say:
   - your name
   - date
   - time
   - title/topic
5. Confirm booking when asked.
6. Verify the event appears in Google Calendar.

### Recommended Test Script

- "Hi my name is John."
- "Schedule for tomorrow."
- "3:30 PM."
- "Team sync."
- "Yes, book it."

## Run Locally (Optional)

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in Vercel or local runtime:

- `GROQ_API_KEY`
- `GROQ_MODEL` (optional, defaults in code)
- `OPENAI_API_KEY` (used by `/api/transcribe` fallback path)
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` (for local: `http://localhost:3000/api/auth/callback`)

3. Start local dev server:

```bash
vercel dev
```

4. Ensure Google OAuth client includes redirect URI:

- `http://localhost:3000/api/auth/callback`

## Calendar Integration (How It Works)

### OAuth

- `GET /api/auth/google` starts Google OAuth consent.
- `GET /api/auth/callback` exchanges code for tokens.
- Tokens are stored in `HttpOnly` cookie (`gcal_tokens`) and refreshed automatically.

### Event Creation

- When user confirms, frontend calls `POST /api/book`.
- Request includes `name`, `date`, `time`, `title`, `duration`, and browser `timeZone`.
- Backend creates event on `primary` calendar with explicit timezone and start/end local wall-clock times.
- Success response returns event link and details shown in UI.

## Evidence (Event Created)

- Vercel logs should show:
  - `POST /api/book 200`
- Google Calendar should show created event matching requested date/time/timezone.

Add one of these to your submission:

1. Screenshots:
   - OAuth success state
   - booking confirmation card
   - event visible in Google Calendar
   - Vercel logs with `POST /api/book 200`
2. Loom video (short walkthrough):
   - start session
   - collect details
   - confirm booking
   - show event in calendar

