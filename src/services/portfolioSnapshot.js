const alpaca = require('./alpacaService');

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function round(x, places = 2) {
  const m = 10 ** places;
  return Math.round(num(x) * m) / m;
}

function normalizeAccount(a) {
  return {
    status: a.status,
    currency: a.currency,
    equity: round(a.equity),
    last_equity: round(a.last_equity),
    cash: round(a.cash),
    buying_power: round(a.buying_power),
    portfolio_value: round(a.portfolio_value),
    long_market_value: round(a.long_market_value),
    short_market_value: round(a.short_market_value),
    day_pnl: round(num(a.equity) - num(a.last_equity)),
    day_pnl_pct: num(a.last_equity) > 0
      ? round(((num(a.equity) - num(a.last_equity)) / num(a.last_equity)) * 100, 3)
      : 0,
    maintenance_margin: round(a.maintenance_margin),
    pattern_day_trader: Boolean(a.pattern_day_trader),
    trading_blocked: Boolean(a.trading_blocked)
  };
}

function normalizePosition(p) {
  return {
    symbol: p.symbol,
    asset_class: p.asset_class,
    qty: num(p.qty),
    side: p.side,
    avg_entry: round(p.avg_entry_price, 4),
    current_price: round(p.current_price, 4),
    market_value: round(p.market_value),
    cost_basis: round(p.cost_basis),
    unrealized_pl: round(p.unrealized_pl),
    unrealized_plpc: round(num(p.unrealized_plpc) * 100, 3),
    change_today_pct: round(num(p.change_today) * 100, 3)
  };
}

function buildSnapshot({ account, positions, openOrders, clock }) {
  const acct = normalizeAccount(account);
  const pos = (positions || []).map(normalizePosition);
  const totalMv = pos.reduce((s, p) => s + p.market_value, 0);
  const withWeights = pos.map((p) => ({
    ...p,
    weight_pct: totalMv ? round((p.market_value / totalMv) * 100, 2) : 0
  }));

  return {
    generated_at: new Date().toISOString(),
    broker: 'alpaca',
    mode: alpaca.isPaper ? 'paper' : 'live',
    market: clock ? {
      is_open: Boolean(clock.is_open),
      next_open: clock.next_open,
      next_close: clock.next_close
    } : null,
    account: acct,
    positions: withWeights,
    open_orders: (openOrders || []).map((o) => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      qty: num(o.qty),
      type: o.type,
      limit_price: o.limit_price ? round(o.limit_price, 4) : null,
      status: o.status,
      submitted_at: o.submitted_at
    })),
    totals: {
      positions: pos.length,
      gross_market_value: round(totalMv),
      cash_pct: acct.equity ? round((acct.cash / acct.equity) * 100, 2) : 0
    }
  };
}

async function fetchSnapshot() {
  const [account, positions, openOrders, clock] = await Promise.all([
    alpaca.getAccount(),
    alpaca.getPositions(),
    alpaca.getOpenOrders(),
    alpaca.getClock()
  ]);
  return buildSnapshot({ account, positions, openOrders, clock });
}

module.exports = { buildSnapshot, fetchSnapshot, normalizeAccount, normalizePosition };
