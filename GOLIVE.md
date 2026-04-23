# Going Live — Setup & Operations Guide

This is your runbook for the AI portfolio tracker. Save this. If you start a fresh Claude session, point it at this file and `CLAUDE.md` and it will know the plan.

---

## Mission

Grow a **$100 deposit** into **$100,000** via AI-driven auto-trading on Alpaca, with Claude (`claude-opus-4-7`) as the strategist.

- Per-order auto-execute cap is **dynamic**: starts at $100, rises $50 for every $50 of equity gain.
- Until equity clears $25K, the strategist avoids day trades (PDT rule). It prefers swing positions, covered calls, cash-secured puts, and dividend income.
- Pause button on the UI is your brake. Hit it any time.

---

## What you need before starting

Have these tabs open and credentials handy.

| Item | Where | Notes |
|---|---|---|
| **Alpaca live account** | [alpaca.markets](https://alpaca.markets) → API Keys | Live, NOT paper. Copy Key ID + Secret. |
| **Anthropic API key** | [console.anthropic.com](https://console.anthropic.com) → API Keys | Generate, copy once (only shown once). |
| **Twilio** SID + Auth Token + phone number | Twilio console | You already have these from the voicebot. |
| **Google service-account key** | `google-key.json` in the repo root | You already have this. |
| **Your cell phone** in E.164 | e.g. `+14155551212` | This is where alerts go. |

Software on your laptop:
- **Node.js 20+** ([nodejs.org](https://nodejs.org))
- **Git** ([git-scm.com](https://git-scm.com))
- A text editor (VS Code, Notepad, TextEdit — anything)

---

## One-time setup

### 1. Open a terminal

- **Mac:** Cmd+Space, type "Terminal", Enter
- **Windows:** Win key, type "PowerShell", Enter

### 2. Clone the repo (skip if already cloned)

```bash
cd ~
git clone https://github.com/zsch21425-del/twilio-voicebot.git
cd twilio-voicebot
git checkout claude/ai-portfolio-tracker-C7p9n
```

If already cloned:

```bash
cd ~/twilio-voicebot
git checkout claude/ai-portfolio-tracker-C7p9n
git pull origin claude/ai-portfolio-tracker-C7p9n
```

### 3. Install and verify

```bash
npm install
npm test
```

**Expected output ends with:** `# tests 52 / # pass 52 / # fail 0`

If anything fails, do not proceed — capture the last 20 lines of output and ask Claude.

### 4. Create `.env` from the template

```bash
cp .env.example .env       # Mac/Linux
# or
Copy-Item .env.example .env  # Windows PowerShell
```

Open in editor:

- **Mac:** `open -e .env`
- **Windows:** `notepad .env`

Fill in these fields (leave others as default):

```ini
TWILIO_ACCOUNT_SID=<from Twilio console>
TWILIO_AUTH_TOKEN=<from Twilio console>
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

GOOGLE_APPLICATION_CREDENTIALS=./google-key.json

ANTHROPIC_API_KEY=sk-ant-<your key>

ALPACA_KEY_ID=<your live key>
ALPACA_SECRET_KEY=<your live secret>
ALPACA_BASE_URL=https://api.alpaca.markets
ALPACA_AUTO_EXECUTE_ENABLED=true
ALPACA_AUTO_EXECUTE_MAX_USD=100

TRADING_ALERTS_ENABLED=true
TRADING_ALERTS_PHONE=+1<your cell>
TRADING_ALERTS_CHANNEL=both
```

Save. Confirm `google-key.json` is in the project root.

### 5. Start the app

```bash
npm start
```

**Expected output:**
```
Server listening on http://localhost:3000
[portfolio] nightly analysis scheduled: "30 9 * * 1-5" (America/New_York).
```

Leave this terminal open. The app is running.

### 6. Open the dashboard

In your browser: **http://localhost:3000/portfolio/analyses**

---

## Smoke tests (do these BEFORE funding)

Walk through these in order. Each should pass; if one fails, stop and ask Claude.

| # | Action | Expected result |
|---|---|---|
| 1 | Visit `/portfolio` and refresh | Equity table shows your Alpaca balance (likely $0 pre-funding); no positions yet |
| 2 | On `/portfolio/analyses`, click **Acknowledge live mode** | Orange "LIVE mode without acknowledgment" banner disappears |
| 3 | Click **Send test alert** | SMS arrives on your phone in <30s: `AI analysis placed 1 order: TEST buy $1.23 submitted` |
| 4 | Click **PAUSE auto-exec now** → click **Analyze & auto-execute** → wait 15–45s | Analysis page loads; any recommendations status = `pending_approval`. Click **Resume** when done. |
| 5 | Click **Analyze & auto-execute** again (unpaused, still unfunded) | Recommendations appear; orders fail with "insufficient buying power" (this is correct — no money in account); SMS reports the failure |
| 6 | On [alpaca.markets](https://alpaca.markets) → Orders | The same symbols Claude recommended appear as rejected orders |

All 6 pass → you're ready to fund.

---

## Going live

1. Alpaca dashboard → **Banking** → transfer $100 from your linked bank.
2. Wait for the funds to clear (a few minutes for instant deposit, otherwise next business day).
3. Once cleared, either:
   - **Wait for the nightly cron** at 9:30 AM ET on the next weekday — it auto-runs and SMSes you the result, OR
   - Click **Analyze & auto-execute** manually any time

The dynamic cap auto-tiers as your equity grows: $150 → cap $150, $200 → cap $200, etc.

---

## Daily operation

### Starting the app

```bash
cd ~/twilio-voicebot
npm start
```

Leave the terminal open. Visit `http://localhost:3000/portfolio/analyses`.

### Stopping the app

In the running terminal, press **Ctrl+C**.

### Pausing auto-exec

Big red **PAUSE auto-exec now** button on `/portfolio/analyses`. One click. All future AI orders queue for approval instead of submitting.

To resume: green **Resume auto-exec** button in the same place.

### What you'll get on your phone

- **SMS** when AI places one or more orders (summary)
- **Voice call + SMS** when an order fails
- **Voice call + SMS** when auto-exec is paused (manually or auto-paused)

---

## Week 1 watchlist

Check the Analyses page daily. Specifically:

- **Token cost** in the Recent Analyses table — `cache_creation_input_tokens` should be > 0 on the first run, then `cache_read_input_tokens` > 0 on subsequent runs. If cache_read stays at 0 across many runs, the prompt prefix is being invalidated — tell Claude.
- **Failed/skipped recommendations** in the Recent Orders table — patterns like "no open position" or "insufficient buying power" repeated across many runs signal the strategist is drifting.
- **PDT counter** on Alpaca dashboard → Account → Day Trade Count. If approaching 3 in a 5-day window, pause and tighten the prompt.
- **Equity trajectory.** A 10%+ drawdown in week one warrants a pause and review. Starting capital is small; one bad pick can hurt.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm start` errors with `Cannot find module …` | Dependencies not installed | `npm install` |
| Dashboard shows "Alpaca not configured" | Wrong/missing env keys | Re-check `.env`, restart |
| `/portfolio` returns 500 | Alpaca rejected your keys | Confirm keys are LIVE, not paper, and active |
| SMS test alert never arrives | Twilio creds wrong, or trial account can't reach your number | Check Twilio console logs |
| Voice calls fall back to SMS with `[voice-fallback]` prefix | `PUBLIC_BASE_URL` is localhost (Twilio can't reach you) | For voice, run `ngrok http 3000` and put the https URL into `PUBLIC_BASE_URL`, restart |
| Orders all show `pending_approval` even though auto-exec is on | Auto-exec is paused, OR `ALPACA_AUTO_EXECUTE_ENABLED` is not exactly `true`, OR you exceeded the dynamic cap | Check pause flag on `/portfolio/analyses`, check `.env` |
| Analyses fail with `ANTHROPIC_API_KEY not configured` | Missing or wrong Anthropic key | Update `.env`, restart |
| Test suite fails after pulling | Dependencies out of date | `npm install` then `npm test` |

---

## Quick reference

### Important URLs

| Page | URL |
|---|---|
| Dashboard (positions, orders, place manual order) | `http://localhost:3000/portfolio` |
| AI analyses, settings, pause button, goal progress | `http://localhost:3000/portfolio/analyses` |
| Single analysis detail | `http://localhost:3000/portfolio/analyses/<id>` |
| Snapshot JSON (for debugging) | `http://localhost:3000/portfolio/snapshot.json` |
| Voicebot schedules (separate feature) | `http://localhost:3000/schedules` |

### Important commands

```bash
npm start              # start the app
npm test               # run the test suite
npm run dev            # auto-reload during development
git pull               # pull latest code
sqlite3 data.sqlite    # inspect the database directly
```

### Important env vars

| Var | Default | What it controls |
|---|---|---|
| `ALPACA_BASE_URL` | `https://paper-api.alpaca.markets` | Paper vs live broker. Live = `https://api.alpaca.markets` |
| `ALPACA_AUTO_EXECUTE_ENABLED` | `false` | Master kill switch — must be `true` for any auto-submission |
| `ALPACA_AUTO_EXECUTE_MAX_USD` | `500` | Floor cap. Dynamic cap can rise above this; never falls below. |
| `PORTFOLIO_ANALYSIS_CRON` | `30 9 * * 1-5` | Nightly cron schedule (default = market open weekdays) |
| `PORTFOLIO_ANALYSIS_TIMEZONE` | `America/New_York` | Timezone for the cron |
| `TRADING_ALERTS_ENABLED` | `false` | Master toggle for SMS/voice alerts |
| `TRADING_ALERTS_CHANNEL` | `both` | `sms`, `voice`, or `both` |

### Editable from the UI (not env)

- Investor profile
- Master prompt override (override the built-in default)
- Deposit amount, goal, tier step, floor cap
- Pause / resume auto-exec
- Live-mode acknowledgment

---

## If you start a fresh Claude session

Point Claude at:
1. **`CLAUDE.md`** — mission, architecture, what not to regress
2. **`GOLIVE.md`** — this file, for operational steps
3. **`STATUS.md`** — historical voicebot setup notes (still accurate)

Sample opener:
> "Read CLAUDE.md and GOLIVE.md. The portfolio tracker is live with the $100 → $100,000 mission. I want to [add a feature / debug X / review last week's trades]."

---

## Where the data lives

- `data.sqlite` in repo root — all schedules, call logs, portfolio orders, analyses, settings
- `public/audio/` — generated TTS MP3s (auto-cleaned after 24h)
- `.env` — all secrets, NEVER commit this

Back up `data.sqlite` weekly.
