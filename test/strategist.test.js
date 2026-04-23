const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ANTHROPIC_API_KEY = '';
process.env.ALPACA_KEY_ID = '';
process.env.ALPACA_SECRET_KEY = '';

const { buildSystemPrompt, buildUserMessage, DEFAULT_MASTER_PROMPT } = require('../src/services/masterPrompt');

test('buildSystemPrompt uses default when no override', () => {
  const sys = buildSystemPrompt({ masterPrompt: null, profile: null });
  assert.equal(sys, DEFAULT_MASTER_PROMPT.trim());
});

test('buildSystemPrompt appends profile when provided', () => {
  const sys = buildSystemPrompt({
    masterPrompt: 'You are a strategist.',
    profile: 'Risk tolerance: Moderate.\nHorizon: 10 yrs.'
  });
  assert.match(sys, /You are a strategist\./);
  assert.match(sys, /INVESTOR PROFILE/);
  assert.match(sys, /Risk tolerance: Moderate/);
});

test('buildSystemPrompt lets custom master prompt override default', () => {
  const sys = buildSystemPrompt({ masterPrompt: 'Be brief.', profile: null });
  assert.equal(sys, 'Be brief.');
});

test('buildUserMessage wraps snapshot in tags and includes intro', () => {
  const snap = { account: { equity: 1000 }, positions: [] };
  const msg = buildUserMessage(snap);
  assert.match(msg, /<portfolio_snapshot>/);
  assert.match(msg, /<\/portfolio_snapshot>/);
  assert.match(msg, /"equity": 1000/);
  assert.match(msg, /portfolio snapshot/i);
});

test('buildUserMessage appends extra instruction when provided', () => {
  const msg = buildUserMessage({}, 'Focus on covered calls.');
  assert.match(msg, /Extra instruction.*Focus on covered calls/);
});

test('strategist.analyze throws when ANTHROPIC_API_KEY not set', async () => {
  const strategist = require('../src/services/strategist');
  assert.equal(strategist.isConfigured, false);
  assert.equal(strategist.MODEL, 'claude-opus-4-7');

  const calls = [];
  const stubDb = {
    get: async () => null,
    run: async (sql, ...args) => {
      calls.push({ sql, args });
      return { lastID: 1 };
    }
  };
  await assert.rejects(
    () => strategist.analyze({ db: stubDb, snapshot: {} }),
    /ANTHROPIC_API_KEY not configured/
  );
  // Error should still be logged to portfolio_analyses.
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO portfolio_analyses/);
});
