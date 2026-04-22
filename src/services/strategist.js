const Anthropic = require('@anthropic-ai/sdk').default;
const { anthropicApiKey } = require('../config');
const { buildSystemPrompt, buildUserMessage } = require('./masterPrompt');

const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 16000;

const isConfigured = Boolean(anthropicApiKey);
const client = isConfigured ? new Anthropic({ apiKey: anthropicApiKey }) : null;

async function loadSettings(db) {
  const row = await db.get('SELECT profile_json, master_prompt FROM portfolio_settings WHERE id = 1');
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

async function analyze({ db, snapshot, extraInstruction = '', source = 'manual' }) {
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

  const settings = await loadSettings(db);
  const systemText = buildSystemPrompt({
    masterPrompt: settings.masterPrompt,
    profile: settings.profile
  });
  const userText = buildUserMessage(snapshot, extraInstruction);

  try {
    // System prompt + profile is the stable prefix — cache it. Min cacheable
    // prefix on Opus 4.7 is 4096 tokens; may silently no-op until prompt
    // grows, which is fine. The snapshot goes in the user turn (volatile).
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive', display: 'summarized' },
      system: [
        {
          type: 'text',
          text: systemText,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: userText }]
    });

    const finalMessage = await stream.finalMessage();

    let responseText = '';
    let thinkingText = '';
    for (const block of finalMessage.content) {
      if (block.type === 'text') responseText += block.text;
      else if (block.type === 'thinking') thinkingText += block.thinking || '';
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

    return {
      id: result.lastID,
      responseText,
      thinkingText,
      usage: u,
      model: MODEL
    };
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
}

module.exports = { analyze, loadSettings, isConfigured, MODEL };
