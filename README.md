# Twilio Voicebot

Professional Node.js web app for scheduling automated Twilio voice calls and optional SMS, using Google Cloud Text-to-Speech for natural audio.

## Features

- Responsive web UI to create and manage schedules
- One-time and recurring schedules: `once`, `daily`, `weekly`, `monthly`
- Google Cloud TTS audio generation per call
- Twilio outbound voice calls + optional SMS send
- Enable / disable / delete scheduled jobs
- SQLite persistence so schedules survive restarts
- Input sanitization + E.164 phone normalization
- Rate limiting on public schedule-creation endpoint

## Tech Stack

- Node.js + Express
- EJS server-rendered frontend
- SQLite (`sqlite` + `sqlite3`)
- `node-schedule` for background jobs
- Twilio SDK
- Google Cloud Text-to-Speech SDK

## Local Setup (Windows-friendly)

1. Install Node.js 20+ and Git.
2. Clone and install:

```bash
git clone https://github.com/zsch21425-del/twilio-voicebot.git
cd twilio-voicebot
npm install
```

3. Copy env template:

```bash
copy .env.example .env
```

4. Update `.env` values:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` (E.164 format)
- `GOOGLE_APPLICATION_CREDENTIALS` (path to service-account JSON key)
- Optional: `PUBLIC_BASE_URL`, `GOOGLE_TTS_*`, rate-limit values

5. Start app:

```bash
npm start
```

6. Open: `http://localhost:3000`

## Twilio Setup

1. Create/verify a Twilio account and phone number.
2. Ensure the Twilio number can place outbound calls/SMS to destination regions.
3. For callback and TwiML URLs in production, set `PUBLIC_BASE_URL` to your public HTTPS domain.

## Google Cloud Text-to-Speech Setup

1. Create/select a Google Cloud project.
2. Enable **Cloud Text-to-Speech API**.
3. Create service account, grant minimum required access.
4. Download JSON key and point `.env` `GOOGLE_APPLICATION_CREDENTIALS` to that file.

## Usage

1. Go to **Create Schedule**.
2. Enter:
   - phone number (E.164, e.g. `+14155551212`)
   - voice message
   - optional SMS
   - schedule type (`once/daily/weekly/monthly`)
   - date/time
3. Submit and review entries in **Scheduled Jobs**.
4. Use **Disable/Enable** or **Delete** as needed.

## Notes

- If Twilio credentials are not configured, call/SMS execution is safely skipped and logged.
- SQLite DB file is `data.sqlite` in project root.
- Generated MP3 files are written to `public/audio`.

## Testing

```bash
npm test
```

## Optional Deployment Notes

- Deploy on a VM/container with a process manager (PM2/systemd).
- Use HTTPS and set `PUBLIC_BASE_URL` to public URL.
- Persist `data.sqlite` on durable disk/volume.
- Keep `.env` and Google key outside version control.
