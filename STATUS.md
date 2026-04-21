# Twilio Voicebot – Status & Setup Guide

This document captures:
1. What's been built so far (Done)
2. What you still need to do to make it actually place calls (Your TODOs)
3. Optional/nice-to-have work that isn't blocking (Future)
4. Step-by-step setup instructions, start to finish

---

## 1. Done

Committed on branch `claude/finish-twilio-chatbot-e12xx` (PR #2, draft):
https://github.com/zsch21425425-del/twilio-voicebot/pull/2

### Core app (pre-existing)
- Express + EJS web UI at `/` (create), `/schedules` (manage), `/health`.
- SQLite persistence (`data.sqlite`) for schedules and call logs.
- Google Cloud Text-to-Speech for natural voice audio (`src/services/ttsService.js`).
- Twilio outbound voice + optional SMS (`src/services/twilioService.js`).
- `node-schedule` background jobs restored on boot (`src/services/schedulerService.js`).
- Input sanitization, E.164 phone normalization, rate limiting on the public endpoint.

### Fixes & additions in this PR
- **Timezone-correct recurrences.** `buildScheduleRule` now derives hour / minute / day-of-week in the schedule's IANA timezone via `Intl.DateTimeFormat`. Previously daily/weekly/monthly jobs fired at the server's local hour, not the user's.
- **datetime-local → UTC conversion.** `public/js/app.js` converts the browser's naive local string to a real UTC ISO (`scheduledAtIso`) on submit; the validator prefers that field. This removes server-TZ ambiguity.
- **Call Logs view** at `/logs` with Twilio status updates joined to the originating schedule.
- **Enriched schedules table**: message preview, next-run (live from `node-schedule`), last-run.
- **Setup-incomplete banner** in the header when `TWILIO_*` or `GOOGLE_APPLICATION_CREDENTIALS` are missing.
- **Graceful shutdown** on SIGINT/SIGTERM via `schedule.gracefulShutdown()`, closes HTTP server + DB.
- **Audio dir bootstrap** (`public/audio/` created at boot, `.gitkeep` committed).
- **Hourly cleanup** of generated MP3s older than 24 h (`src/services/audioCleanup.js`).
- **Optional Twilio signature validation** on `/webhooks/call-status` whenever `TWILIO_AUTH_TOKEN` is set.
- **TwiML uses `PUBLIC_BASE_URL`** (falls back to request host), which matters behind HTTPS proxies.
- **Tests**: 6 → 11, all passing. New coverage: timezone-aware rule building, `scheduledAtIso` path, HTML stripping, MP3 cleanup worker.

---

## 2. Your TODOs (required before first call)

These require your accounts/credentials and cannot be done in code.

### 2.1 Twilio account
- [ ] Create/verify a Twilio account: https://www.twilio.com/try-twilio
- [ ] Buy (or use the trial) phone number with **Voice** + **SMS** capabilities.
- [ ] Copy from the Twilio Console:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER` (E.164, e.g. `+14155551212`)
- [ ] On **trial accounts**, verify any destination numbers you want to call (Twilio blocks outbound calls to unverified numbers on trial).

### 2.2 Google Cloud TTS
- [ ] Create a Google Cloud project: https://console.cloud.google.com
- [ ] Enable **Cloud Text-to-Speech API** for that project.
- [ ] Create a service account with role `Cloud Text-to-Speech User` (or broader).
- [ ] Create a JSON key for the service account and download it as `google-key.json` into the repo root (it's already gitignored).

### 2.3 Configure `.env`
- [ ] Copy template: `cp .env.example .env` (Windows: `copy .env.example .env`).
- [ ] Fill in all the `TWILIO_*` values.
- [ ] Set `GOOGLE_APPLICATION_CREDENTIALS=./google-key.json`.
- [ ] For local testing, leave `PUBLIC_BASE_URL=http://localhost:3000`.

### 2.4 Make the app reachable from Twilio
Twilio's cloud needs to fetch two URLs from your server in order to play audio and report status:
- `GET  {PUBLIC_BASE_URL}/twiml/:id?audio=...`
- `POST {PUBLIC_BASE_URL}/webhooks/call-status?scheduleId=...`

Twilio **cannot reach `localhost`**. Pick one:

**Option A — Quickest for local testing (ngrok):**
- [ ] Install ngrok: https://ngrok.com/download
- [ ] Run the app: `npm start`
- [ ] In another terminal: `ngrok http 3000`
- [ ] Copy the HTTPS URL ngrok prints (e.g. `https://abcd1234.ngrok-free.app`).
- [ ] Set `PUBLIC_BASE_URL` in `.env` to that HTTPS URL and restart the app.

**Option B — Deploy to a PaaS (Render / Railway / Fly.io / Heroku):**
- [ ] Create a service pointing at the repo.
- [ ] Set the same env vars in the platform's dashboard. For `GOOGLE_APPLICATION_CREDENTIALS` on a PaaS, either use a secret-file feature or switch to `GOOGLE_CREDENTIALS_JSON` (see Future / 3.3).
- [ ] Set `PUBLIC_BASE_URL` to the assigned HTTPS domain.
- [ ] Mount a persistent volume at the repo root so `data.sqlite` survives restarts.

### 2.5 Install & run
- [ ] `npm install`
- [ ] `npm test` &rarr; should show **11 passing**.
- [ ] `npm start` &rarr; open http://localhost:3000.
- [ ] Create a schedule ~2 minutes in the future to a verified phone number and confirm the call arrives.
- [ ] Check `/logs` for the Twilio status updates.

---

## 3. Future / optional (not blocking)

Nice-to-haves that we didn't do because they weren't strictly needed for "usable":

- [ ] **GOOGLE_CREDENTIALS_JSON env var** support (inline JSON) so PaaS deploys don't need a secret file on disk.
- [ ] **Authentication** on the web UI (currently anyone who can reach the URL can schedule calls).
- [ ] **Per-user tenancy** + API keys for a multi-tenant deployment.
- [ ] **Voice picker** in the UI (list voices from Google TTS, let user choose per schedule).
- [ ] **SSML** input support for finer prosody control.
- [ ] **Retry with backoff** on Twilio/Google API failures.
- [ ] **Pagination** on `/schedules` and `/logs` once data grows past a few hundred rows.
- [ ] **CSV export** of call logs.
- [ ] **Dockerfile** + `docker-compose.yml` for a one-command deploy.
- [ ] **CI workflow** (GitHub Actions) running `npm test` on every push — the repo has no workflow yet, which is why PR checks are empty.
- [ ] **End-to-end Twilio test** using the Twilio test credentials so CI can exercise the call flow without spending money.
- [ ] **Structured logging** (`pino` or `winston`) instead of `console.log`.
- [ ] **Metrics/health** (`/metrics` Prometheus endpoint) for production observability.
- [ ] **"Run once now" button** on each schedule for manual testing.
- [ ] **Preview TTS** endpoint so you can hear the audio before the call goes out.
- [ ] **Phone-number verification** flow that texts an OTP before allowing a number to be scheduled.
- [ ] **Concurrency-safe SQLite**: enable WAL mode on open for better write throughput.

---

## 4. Step-by-step: zero to first real call

Condensed to the critical path.

1. **Clone + install**
   ```bash
   git clone https://github.com/zsch21425-del/twilio-voicebot.git
   cd twilio-voicebot
   git checkout claude/finish-twilio-chatbot-e12xx
   npm install
   ```

2. **Get Twilio credentials** (Account SID, Auth Token, a phone number). On trial, verify the destination number you'll call.

3. **Get Google TTS credentials**
   - Enable Cloud Text-to-Speech API in a GCP project.
   - Create a service account, download its JSON key as `google-key.json` in the repo root.

4. **Configure `.env`**
   ```bash
   cp .env.example .env
   # then edit .env and fill in TWILIO_*, GOOGLE_APPLICATION_CREDENTIALS=./google-key.json
   ```

5. **Expose the app publicly** so Twilio can call back
   ```bash
   # terminal 1
   npm start
   # terminal 2
   ngrok http 3000
   ```
   Copy the ngrok `https://...` URL into `.env` as `PUBLIC_BASE_URL`, then restart `npm start`.

6. **Run a test schedule**
   - Open http://localhost:3000
   - Phone: a verified E.164 number (e.g. `+14155551212`)
   - Message: "Hello from your voicebot."
   - Schedule Type: `once`
   - Date & Time: ~2 minutes from now
   - Submit → check `/schedules` for next run, wait, answer the call.

7. **Verify status flow**
   - After the call completes, `/logs` should show `initiated` → `ringing` → `answered` → `completed`.
   - If you see `failed`, the error column explains why (auth, unverified number, credentials path, etc.).

8. **Production hardening (when you're ready)**
   - Deploy behind HTTPS (any PaaS or a VM + caddy/nginx).
   - Set `PUBLIC_BASE_URL` to the public HTTPS domain.
   - Keep `.env` and `google-key.json` out of version control (already gitignored).
   - Persist `data.sqlite` and `public/audio/` on durable storage.
   - Rotate `TWILIO_AUTH_TOKEN` periodically; the webhook signature check uses it automatically.

---

## 5. Quick command reference

```bash
npm install          # install deps
npm test             # run test suite (11 tests)
npm start            # start server on PORT (default 3000)
npm run dev          # nodemon-reload dev server

# useful for troubleshooting
curl http://localhost:3000/health
sqlite3 data.sqlite 'SELECT * FROM schedules;'
sqlite3 data.sqlite 'SELECT * FROM call_logs ORDER BY id DESC LIMIT 20;'
```
