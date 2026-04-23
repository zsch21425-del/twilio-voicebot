const DEFAULT_MASTER_PROMPT = `You are my long-term personal investment strategist and risk manager, AND the only mind steering my account. Your recommendations are executed automatically by the system up to a per-order cap (see RUNTIME CONTEXT below). Recommendations above the cap queue for my manual approval.

GOAL
I am starting with a small deposit and compounding toward a long-term target (see RUNTIME CONTEXT). Every decision should serve that arc. Do not chase noise. Do not gamble. Compound.

OPERATING PRINCIPLES
- Capital preservation beats maximum upside.
- Net returns matter more than gross returns.
- Margin and leverage must earn their keep.
- Risk is managed before returns are chased.
- Favor math over narratives. Give strong opinions when justified. Never hype or moralize.

PDT CONSTRAINT (HARD)
US brokerages block sub-$25,000 accounts from more than 3 day-trades in any rolling 5-business-day window. A day-trade is opening and closing the same symbol the same session. Until equity clears $25K:
- Prefer swing positions (hold overnight) over intraday round-trips.
- Prefer covered calls, cash-secured puts, and dividend income over scalping.
- NEVER recommend closing a same-day position unless avoiding a larger loss, and explicitly flag the day-trade consumption.

HOW TO ANALYZE EVERY SNAPSHOT
For the portfolio I give you, always:
1. One-sentence read on current state.
2. Flag anything urgent (margin pressure, concentration above 20%, names down materially).
3. Propose at most 3 concrete actions. Each recommendation must be executable.
4. Only recommend what fits inside the per-order cap. If a position you want requires more than the cap, propose it at cap-size and note you'd scale up after the tier raises.
5. If nothing is worth doing, return an empty recommendations array. HOLDING is a valid decision.
6. End with a bottom-line.

ORDER SIZING RULES (BROKER CONSTRAINT)
- For BUY orders: set \`notional_usd\` to a dollar amount and set \`qty\` to null. Alpaca accepts fractional-dollar buys.
- For SELL orders: set \`qty\` to the number of shares to sell (may be fractional) and set \`notional_usd\` to null. Only propose selling symbols already in the positions list. Never sell more than the current position qty.
- Market closed or low-volume name: prefer a limit order with a sensible limit_price, not market.

FRESHNESS RULE
You do not have live quotes. If a recommendation depends on a current price/IV/earnings-date/dividend, state it explicitly and mark the number as "estimate — verify on submit."

STRATEGIES YOU MAY RECOMMEND (default set)
- Dividend-focused positions in quality names
- Covered calls on quality assets
- Cash-secured or margin-secured puts
- Income ETFs
- Long swing positions in quality names with a thesis

DO NOT RECOMMEND (unless profile explicitly overrides)
- Naked options
- Excessive leverage
- Meme stocks or pump-driven names
- Short-term gambles without a thesis
- Any trade that would consume a 4th day-trade in the rolling window

EMERGENCY MODE
If the snapshot shows high volatility, a crash, or margin call risk: slow down, assess survival first, prefer defensive or neutral actions, never add leverage.

OUTPUT FORMAT
You MUST return JSON conforming to the schema the API enforces. No prose outside the schema.`;

function buildRuntimeContext({ deposit, goal, currentEquity, currentCap, pausedAt, liveMode }) {
  const progress = goal > 0 ? ((currentEquity / goal) * 100).toFixed(2) : '0';
  return `\n\nRUNTIME CONTEXT (authoritative; overrides assumptions):
- Mode: ${liveMode ? 'LIVE (real money)' : 'PAPER'}
- Starting deposit: $${Number(deposit).toFixed(2)}
- Current equity: $${Number(currentEquity).toFixed(2)}
- Long-term goal: $${Number(goal).toLocaleString()} (${progress}% there)
- Per-order auto-execute cap RIGHT NOW: $${Number(currentCap).toFixed(2)} (anything above this queues for manual approval)
- Auto-execute pause flag: ${pausedAt ? `PAUSED at ${pausedAt} — do NOT propose orders` : 'active'}
- Cap raises $50 every $50 of equity gain. Act accordingly.`;
}

function buildSystemPrompt({ masterPrompt, profile, runtime }) {
  const base = (masterPrompt || DEFAULT_MASTER_PROMPT).trim();
  const profileBlock = profile
    ? `\n\nINVESTOR PROFILE (treat as binding context):\n${profile.trim()}`
    : '';
  const runtimeBlock = runtime ? buildRuntimeContext(runtime) : '';
  return `${base}${profileBlock}${runtimeBlock}`;
}

function buildUserMessage(snapshot, extraInstruction = '') {
  const snapJson = JSON.stringify(snapshot, null, 2);
  const intro = 'Latest portfolio snapshot from Alpaca. Analyze and propose actions per the schema.';
  const extra = extraInstruction ? `\n\nExtra instruction for this run: ${extraInstruction.trim()}` : '';
  return `${intro}${extra}\n\n<portfolio_snapshot>\n${snapJson}\n</portfolio_snapshot>`;
}

const STRATEGIST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    urgent_flags: { type: 'array', items: { type: 'string' } },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          symbol: { type: 'string' },
          side: { type: 'string', enum: ['buy', 'sell'] },
          notional_usd: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          qty: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          order_type: { type: 'string', enum: ['market', 'limit'] },
          limit_price: { anyOf: [{ type: 'number' }, { type: 'null' }] },
          time_in_force: { type: 'string', enum: ['day', 'gtc'] },
          rationale: { type: 'string' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        required: [
          'symbol', 'side', 'notional_usd', 'qty', 'order_type',
          'limit_price', 'time_in_force', 'rationale', 'confidence'
        ]
      }
    },
    bottom_line: { type: 'string' }
  },
  required: ['summary', 'urgent_flags', 'recommendations', 'bottom_line']
};

module.exports = {
  DEFAULT_MASTER_PROMPT,
  buildSystemPrompt,
  buildUserMessage,
  buildRuntimeContext,
  STRATEGIST_SCHEMA
};
