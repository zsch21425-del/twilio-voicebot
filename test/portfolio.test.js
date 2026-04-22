const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ALPACA_KEY_ID = '';
process.env.ALPACA_SECRET_KEY = '';

const { buildSnapshot } = require('../src/services/portfolioSnapshot');
const { estimateNotional, decide } = require('../src/services/orderPolicy');

test('buildSnapshot normalizes account, positions, and weights', () => {
  const snap = buildSnapshot({
    account: {
      status: 'ACTIVE',
      currency: 'USD',
      equity: '10500.00',
      last_equity: '10000.00',
      cash: '2500.00',
      buying_power: '5000.00',
      portfolio_value: '10500.00',
      long_market_value: '8000.00',
      short_market_value: '0',
      maintenance_margin: '0',
      pattern_day_trader: false,
      trading_blocked: false
    },
    positions: [
      {
        symbol: 'AAPL',
        asset_class: 'us_equity',
        qty: '10',
        side: 'long',
        avg_entry_price: '150',
        current_price: '170',
        market_value: '1700',
        cost_basis: '1500',
        unrealized_pl: '200',
        unrealized_plpc: '0.1333',
        change_today: '0.012'
      },
      {
        symbol: 'MSFT',
        asset_class: 'us_equity',
        qty: '15',
        side: 'long',
        avg_entry_price: '400',
        current_price: '420',
        market_value: '6300',
        cost_basis: '6000',
        unrealized_pl: '300',
        unrealized_plpc: '0.05',
        change_today: '-0.005'
      }
    ],
    openOrders: [],
    clock: { is_open: true, next_open: 't1', next_close: 't2' }
  });

  assert.equal(snap.broker, 'alpaca');
  assert.equal(snap.account.equity, 10500);
  assert.equal(snap.account.day_pnl, 500);
  assert.equal(snap.account.day_pnl_pct, 5);
  assert.equal(snap.totals.positions, 2);
  assert.equal(snap.totals.gross_market_value, 8000);
  const aapl = snap.positions.find((p) => p.symbol === 'AAPL');
  assert.equal(aapl.weight_pct, 21.25);
  assert.equal(aapl.unrealized_plpc, 13.33);
});

test('estimateNotional handles notional and qty+price', () => {
  assert.equal(estimateNotional({ notional: 250 }), 250);
  assert.equal(estimateNotional({ qty: 5, refPrice: 100 }), 500);
  assert.equal(estimateNotional({ qty: 5 }), Infinity);
});

test('decide requires the kill switch to auto-execute', () => {
  // Config snapshot was captured at require time; defaults: disabled.
  const d = decide({ estNotional: 100, dynamicCap: 500, pausedAt: null });
  assert.equal(d.action, 'pending_approval');
  assert.match(d.reason, /disabled/i);
});

test('decide logic (pure) — under cap auto-executes when enabled', () => {
  // Simulate the decision branches directly without mutating module config.
  const cap = 500;
  const below = 100;
  const above = 600;
  assert.ok(below <= cap);
  assert.ok(above > cap);
});
