const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ANTHROPIC_API_KEY = '';
process.env.ALPACA_KEY_ID = '';
process.env.ALPACA_SECRET_KEY = '';

const { normalizeRecommendation } = require('../src/services/strategist');

function posMap(positions) {
  return new Map(positions.map((p) => [p.symbol.toUpperCase(), p]));
}

test('buy with notional passes through unchanged', () => {
  const out = normalizeRecommendation(
    { symbol: 'SPY', side: 'buy', notional_usd: 95, qty: null },
    posMap([])
  );
  assert.equal(out.notional, 95);
  assert.equal(out.qty, null);
  assert.ok(!out.skip);
});

test('buy missing both qty and notional is skipped', () => {
  const out = normalizeRecommendation(
    { symbol: 'SPY', side: 'buy', notional_usd: null, qty: null },
    posMap([])
  );
  assert.match(out.skip, /missing both qty and notional/);
});

test('sell without an open position is skipped', () => {
  const out = normalizeRecommendation(
    { symbol: 'AAPL', side: 'sell', notional_usd: 50, qty: null },
    posMap([])
  );
  assert.match(out.skip, /no open position/);
});

test('sell with notional converts to qty using current_price', () => {
  const out = normalizeRecommendation(
    { symbol: 'AAPL', side: 'sell', notional_usd: 100, qty: null },
    posMap([{ symbol: 'AAPL', qty: 10, current_price: 50 }])
  );
  assert.equal(out.qty, 2);
  assert.equal(out.notional, null);
  assert.equal(out.refPrice, 50);
});

test('sell caps qty at current position size', () => {
  const out = normalizeRecommendation(
    { symbol: 'AAPL', side: 'sell', notional_usd: 10000, qty: null },
    posMap([{ symbol: 'AAPL', qty: 3, current_price: 50 }])
  );
  assert.equal(out.qty, 3);
});

test('sell with qty passes through but is capped at position size', () => {
  const out = normalizeRecommendation(
    { symbol: 'AAPL', side: 'sell', notional_usd: null, qty: 99 },
    posMap([{ symbol: 'AAPL', qty: 2, current_price: 100 }])
  );
  assert.equal(out.qty, 2);
});

test('sell with no current_price and only notional is skipped', () => {
  const out = normalizeRecommendation(
    { symbol: 'AAPL', side: 'sell', notional_usd: 50, qty: null },
    posMap([{ symbol: 'AAPL', qty: 5, current_price: 0 }])
  );
  assert.match(out.skip, /no current_price/);
});

test('sell computing qty <= 0 is skipped', () => {
  const out = normalizeRecommendation(
    { symbol: 'AAPL', side: 'sell', notional_usd: 0.0001, qty: null },
    posMap([{ symbol: 'AAPL', qty: 5, current_price: 10 }])
  );
  assert.match(out.skip, /qty <= 0/);
});

test('unknown side is skipped', () => {
  const out = normalizeRecommendation(
    { symbol: 'SPY', side: 'short', notional_usd: 10, qty: null },
    posMap([])
  );
  assert.match(out.skip, /unknown side/);
});
