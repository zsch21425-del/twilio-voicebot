const Anthropic = require('@anthropic-ai/sdk').default;
const { anthropicApiKey } = require('../config');
const {
  buildSystemPrompt,
  buildUserMessage,
  STRATEGIST_SCHEMA
} = require('./masterPrompt');
const executionPolicy = require('./executionPolicy');
const orderPolicy = require('./orderPolicy');
const alpaca = require('./alpacaService');

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 16000;

const isConfigured = Boolean(anthropicApiKey);
const client = isConfigured ? new Anthropic({ apiKey: anthropicApiKey }) : null;

async function loadSettings(db) {
  const row = await db.get(
    `SELECT profile_json, master_prompt FROM portfolio_settings WHERE id = 1`
  );
  if (!row) return { profile: null, masterPrompt: null };
  let profile = null;
  try {
    profile = row.profile_json ? JSON.parse(row.profile_json) : null;
  } catch {
    profile = row.profile_json;
  }
  return {
    profile: typeof profile === 'string' ? profile : profile ? JSON.stringify(profile, null, 2) : null,
    masterPrompt: row.master_prompt || null
  };
}

async function analyze({ db, snapshot, extraInstruction = '', source = 'manual', autoSubmit = true }) {
  const now = new Date().toISOString();

  if (!isConfigured) {
    await db.run(
      `INSERT INTO portfolio_analyses (snapshot_json, model, error_message, source, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      JSON.stringify(snapshot),
      MODEL,
      'ANTHROPIC_API_KEY not set',
      source,
      now
    );
    throw new Error('ANTHROPIC_API_KEY not configured.');
  }

  const [settings, execState] = await Promise.all([
    loadSettings(db),
    executionPolicy.loadState(db)
  ]);

  const currentEquity = snapshot?.account?.equity ?? 0;
  const currentCap = executionPolicy.computeTierCap({
    equity: currentEquity,
    deposit: execState.deposit,
    tierStep: execState.tierStep,
    floorCap: execState.floorCap
  });

  const systemText = buildSystemPrompt({
    masterPrompt: settings.masterPrompt,
    profile: settings.profile,
    runtime: {
      deposit: execState.deposit,
      goal: execState.goal,
      currentEquity,
      currentCap,
      pausedAt: execState.pausedAt,
      liveMode: snapshot?.mode === 'live'
    }
  });
  const userText = buildUserMessage(snapshot, extraInstruction);

  let finalMessage;
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: {
        format: { type: 'json_schema', schema: STRATEGIST_SCHEMA }
      },
      system: [
        {
          type: 'text',
          text: systemText,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: userText }]
    });
    finalMessage = await stream.finalMessage();
  } catch (error) {
    await db.run(
      `INSERT INTO portfolio_analyses (snapshot_json, model, error_message, source, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      JSON.stringify(snapshot),
      MODEL,
      String(error.message || error).slice(0, 1000),
      source,
      now
    );
    throw error;
  }

  let responseText = '';
  let thinkingText = '';
  let parsed = null;
  for (const block of finalMessage.content) {
    if (block.type === 'text') responseText += block.text;
    else if (block.type === 'thinking') thinkingText += block.thinking || '';
  }
  try {
    parsed = JSON.parse(responseText);
  } catch {
    parsed = null;
  }

  const u = finalMessage.usage || {};
  const result = await db.run(
    `INSERT INTO portfolio_analyses (
      snapshot_json, model, response_text, thinking_text,
      input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens,
      source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    JSON.stringify(snapshot),
    MODEL,
    responseText,
    thinkingText || null,
    u.input_tokens || 0,
    u.output_tokens || 0,
    u.cache_read_input_tokens || 0,
    u.cache_creation_input_tokens || 0,
    source,
    now
  );
  const analysisId = result.lastID;

  const submittedOrders = [];
  const skippedOrders = [];

  if (autoSubmit && parsed && Array.isArray(parsed.recommendations)) {
    for (const rec of parsed.recommendations) {
      try {
        const orderResult = await orderPolicy.createOrder(
          db,
          {
            symbol: rec.symbol,
            side: rec.side,
            notional: rec.notional_usd,
            orderType: rec.order_type,
            timeInForce: rec.time_in_force
          },
          { source: 'ai', linkedAnalysisId: analysisId }
        );
        submittedOrders.push({ ...orderResult, rationale: rec.rationale });
      } catch (err) {
        skippedOrders.push({
          symbol: rec.symbol,
          side: rec.side,
          error: String(err.message || err).slice(0, 200)
        });
      }
    }
  }

  return {
    id: analysisId,
    responseText,
    thinkingText,
    parsed,
    usage: u,
    model: MODEL,
    submittedOrders,
    skippedOrders,
    dynamicCap: currentCap,
    equity: currentEquity
  };
}

module.exports = { analyze, loadSettings, isConfigured, MODEL };
