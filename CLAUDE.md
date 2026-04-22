# Project context for Claude Code / future agent sessions

## Mission

This repo started as a Twilio voice-call scheduler and now also hosts an AI-driven portfolio tracker with auto-execution against the Alpaca broker API.

## The owner's trading plan (persistent goal)

**Goal: grow an initial $100 deposit into $100,000 via AI-driven auto-trading.**

- Starting deposit: **$100**
- Long-term target: **$100,000**
- Broker: **Alpaca live account** (not paper)
- Strategist: **Claude (`claude-opus-4-7`)**, structured-output recommendations auto-submitted
- Per-order auto-exec cap: **dynamic**, starts at $100 and rises $50 for every $50 of equity gain from the starting deposit
- Safety rails intentionally kept light at the owner's request; the essentials that remain are:
  - `ALPACA_AUTO_EXECUTE_ENABLED` env kill switch
  - In-DB pause flag (`autoexec_paused_at`) exposed via the UI
  - Dynamic per-order cap
  - Live-mode acknowledgment flag

**PDT constraint to respect:** US brokerages block sub-$25K accounts from more than 3 day-trades in any rolling 5-business-day window. The system prompt instructs the strategist to prefer swing positions, covered calls, cash-secured puts, and dividend income until equity clears $25K.

## Architecture

- Express + EJS web UI (shared with the Twilio voicebot)
- SQLite (`data.sqlite`) for persistence
- `src/services/alpacaService.js` — REST wrapper
- `src/services/portfolioSnapshot.js` — normalizes Alpaca data for the strategist
- `src/services/masterPrompt.js` — base prompt, runtime-context injection, JSON schema
- `src/services/strategist.js` — Claude call (adaptive thinking, prompt caching, structured outputs)
- `src/services/executionPolicy.js` — dynamic tier cap, pause flag, live-ack
- `src/services/orderPolicy.js` — auto-exec gate, order submission, approval/rejection
- `src/services/portfolioAnalysisScheduler.js` — nightly cron runner
- Views: `views/portfolio.ejs`, `views/analyses.ejs`, `views/analysis.ejs`
- CI: `.github/workflows/ci.yml` runs `npm ci && npm test`

## Editable from the UI (not env)

- Investor profile
- Master prompt override
- Deposit, goal, tier step, floor cap
- Pause / resume auto-exec
- Live-mode acknowledgment

## Do not regress

- The strategist system prompt must always contain the PDT warning and the runtime context block (mode, deposit, equity, goal, cap, pause flag).
- The auto-exec policy must always consult the dynamic cap + pause flag together; don't revert to a static cap.
- Every AI-submitted order must be linked to its originating analysis row (`portfolio_orders.linked_analysis_id`).
- Prompt caching targets the stable prefix (system prompt + profile); the snapshot always belongs in the user turn.
- Default model: `claude-opus-4-7`.

## Conventions

- Never add `/* WHAT this line does */` style comments.
- Tests live under `test/`, run with `npm test`.
- Only commit on the development branch specified in the harness instructions.
