const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeTierCap,
  DEFAULT_DEPOSIT_USD,
  DEFAULT_TIER_STEP_USD,
  DEFAULT_FLOOR_CAP_USD
} = require('../src/services/executionPolicy');

const base = { deposit: 100, tierStep: 50, floorCap: 100 };

test('tier cap equals floor at starting equity', () => {
  assert.equal(computeTierCap({ equity: 100, ...base }), 100);
});

test('tier cap does not drop below floor when equity is under deposit', () => {
  assert.equal(computeTierCap({ equity: 50, ...base }), 100);
  assert.equal(computeTierCap({ equity: 0, ...base }), 100);
});

test('tier cap rises by step for every step of gain', () => {
  assert.equal(computeTierCap({ equity: 149.99, ...base }), 100, 'under first tier');
  assert.equal(computeTierCap({ equity: 150, ...base }), 150, 'first tier hit');
  assert.equal(computeTierCap({ equity: 199, ...base }), 150, 'still first tier');
  assert.equal(computeTierCap({ equity: 200, ...base }), 200, 'second tier');
  assert.equal(computeTierCap({ equity: 525, ...base }), 500, '8 tiers up');
});

test('tier cap scales deep into the run', () => {
  assert.equal(computeTierCap({ equity: 1100, ...base }), 1100);
  assert.equal(computeTierCap({ equity: 25000, ...base }), 25000);
});

test('defaults match constants', () => {
  assert.equal(DEFAULT_DEPOSIT_USD, 100);
  assert.equal(DEFAULT_TIER_STEP_USD, 50);
  assert.equal(DEFAULT_FLOOR_CAP_USD, 100);
});

test('decide returns pending_approval when paused even under cap', () => {
  process.env.ALPACA_AUTO_EXECUTE_ENABLED = 'true';
  // Re-require to pick up env; tests share process state so this is ok once.
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/services/orderPolicy')];
  const { decide } = require('../src/services/orderPolicy');
  const result = decide({ estNotional: 50, dynamicCap: 100, pausedAt: '2026-04-22T00:00:00Z' });
  assert.equal(result.action, 'pending_approval');
  assert.match(result.reason, /paused/i);
});

test('decide returns auto_execute when enabled, unpaused, under cap', () => {
  process.env.ALPACA_AUTO_EXECUTE_ENABLED = 'true';
  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve('../src/services/orderPolicy')];
  const { decide } = require('../src/services/orderPolicy');
  const result = decide({ estNotional: 75, dynamicCap: 100, pausedAt: null });
  assert.equal(result.action, 'auto_execute');
  assert.match(result.reason, /\$75\.00 <= dynamic cap \$100/);
});
