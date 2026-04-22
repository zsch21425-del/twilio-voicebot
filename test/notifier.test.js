const test = require('node:test');
const assert = require('node:assert/strict');

process.env.TRADING_ALERTS_ENABLED = 'false';
process.env.TRADING_ALERTS_PHONE = '';
process.env.TWILIO_ACCOUNT_SID = '';

const notifier = require('../src/services/notifier');

test('notifier is not configured by default (safe for tests)', () => {
  assert.equal(notifier.isConfigured(), false);
});

test('buildTradesMessage summarizes submitted orders', () => {
  const msg = notifier.buildTradesMessage([
    { symbol: 'SPY', side: 'buy', estNotional: 95.5, action: 'auto_executed' },
    { symbol: 'AAPL', side: 'sell', estNotional: 120, action: 'pending_approval' }
  ]);
  assert.match(msg, /placed 2 orders/);
  assert.match(msg, /SPY buy \$95\.50 submitted/);
  assert.match(msg, /AAPL sell \$120\.00 queued for approval/);
});

test('buildTradesMessage returns null for empty list', () => {
  assert.equal(notifier.buildTradesMessage([]), null);
  assert.equal(notifier.buildTradesMessage(null), null);
});

test('buildPauseMessage includes reason when provided', () => {
  const msg = notifier.buildPauseMessage('Drawdown guard tripped');
  assert.match(msg, /PAUSED/);
  assert.match(msg, /Drawdown guard tripped/);
});

test('buildPauseMessage has a sensible default reason', () => {
  const msg = notifier.buildPauseMessage();
  assert.match(msg, /PAUSED/);
  assert.match(msg, /Manual pause/);
});

test('buildFailureMessage includes symbol, side, notional, and error', () => {
  const msg = notifier.buildFailureMessage({
    symbol: 'TSLA',
    side: 'buy',
    estNotional: 250.75,
    error: 'insufficient buying power'
  });
  assert.match(msg, /TSLA buy \$250\.75/);
  assert.match(msg, /insufficient buying power/);
  assert.match(msg, /FAILED/);
});

test('notifyTrades is a no-op when not configured', async () => {
  // Should not throw, should not attempt to call Twilio.
  await notifier.notifyTrades([
    { symbol: 'SPY', side: 'buy', estNotional: 10, action: 'auto_executed' }
  ]);
});

test('notifyPause is a no-op when not configured', async () => {
  await notifier.notifyPause('test');
});

test('notifyFailure is a no-op when not configured', async () => {
  await notifier.notifyFailure({ symbol: 'X', side: 'buy', estNotional: 1, error: 'x' });
});
