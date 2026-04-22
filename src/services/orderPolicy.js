const { alpacaAutoExecuteEnabled } = require('../config');
const alpaca = require('./alpacaService');
const executionPolicy = require('./executionPolicy');

function estimateNotional({ qty, notional, refPrice }) {
  if (notional != null) return Math.abs(Number(notional));
  if (qty != null && refPrice != null) return Math.abs(Number(qty) * Number(refPrice));
  return Infinity;
}

function decide({ estNotional, dynamicCap, pausedAt }) {
  if (!alpacaAutoExecuteEnabled) {
    return { action: 'pending_approval', reason: 'auto-execute disabled by config' };
  }
  if (pausedAt) {
    return { action: 'pending_approval', reason: `auto-execute paused at ${pausedAt}` };
  }
  if (!Number.isFinite(estNotional)) {
    return { action: 'pending_approval', reason: 'could not estimate notional' };
  }
  if (estNotional <= dynamicCap) {
    return {
      action: 'auto_execute',
      reason: `notional $${estNotional.toFixed(2)} <= dynamic cap $${dynamicCap}`
    };
  }
  return {
    action: 'pending_approval',
    reason: `notional $${estNotional.toFixed(2)} > dynamic cap $${dynamicCap}`
  };
}

async function createOrder(db, input, { source = 'manual', linkedAnalysisId = null } = {}) {
  const {
    symbol,
    side,
    qty = null,
    notional = null,
    orderType = 'market',
    timeInForce = 'day',
    refPrice = null
  } = input;

  if (!symbol || !side) throw new Error('symbol and side required');
  if (qty == null && notional == null) throw new Error('qty or notional required');

  const estNotional = estimateNotional({ qty, notional, refPrice });

  let equity = null;
  try {
    const account = await alpaca.getAccount();
    equity = Number(account.equity) || 0;
  } catch {
    equity = 0;
  }
  const dynamicCap = await executionPolicy.getDynamicCap(db, equity);
  const state = await executionPolicy.loadState(db);

  const { action, reason } = decide({
    estNotional,
    dynamicCap,
    pausedAt: state.pausedAt
  });
  const now = new Date().toISOString();

  const initialStatus = action === 'auto_execute' ? 'auto_executed' : 'pending_approval';

  const result = await db.run(
    `INSERT INTO portfolio_orders (
      symbol, side, qty, notional, order_type, time_in_force,
      est_notional, status, reason, source, created_at, linked_analysis_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    symbol.toUpperCase(),
    side,
    qty,
    notional,
    orderType,
    timeInForce,
    Number.isFinite(estNotional) ? estNotional : null,
    initialStatus,
    reason,
    source,
    now,
    linkedAnalysisId
  );

  const orderId = result.lastID;

  if (action === 'auto_execute') {
    await submitAndRecord(db, orderId, { symbol, side, qty, notional, orderType, timeInForce });
  }

  return { id: orderId, action, reason, estNotional, dynamicCap };
}

async function approve(db, id) {
  const row = await db.get('SELECT * FROM portfolio_orders WHERE id = ?', id);
  if (!row) throw new Error('order not found');
  if (row.status !== 'pending_approval') throw new Error(`order status is ${row.status}, not pending_approval`);

  await submitAndRecord(db, id, {
    symbol: row.symbol,
    side: row.side,
    qty: row.qty,
    notional: row.notional,
    orderType: row.order_type,
    timeInForce: row.time_in_force
  });
  return db.get('SELECT * FROM portfolio_orders WHERE id = ?', id);
}

async function reject(db, id) {
  const now = new Date().toISOString();
  await db.run(
    `UPDATE portfolio_orders SET status = 'rejected', decided_at = ? WHERE id = ? AND status = 'pending_approval'`,
    now,
    id
  );
  return db.get('SELECT * FROM portfolio_orders WHERE id = ?', id);
}

async function submitAndRecord(db, id, spec) {
  const now = new Date().toISOString();
  try {
    const broker = await alpaca.submitOrder({
      symbol: spec.symbol,
      side: spec.side,
      qty: spec.qty,
      notional: spec.notional,
      type: spec.orderType,
      timeInForce: spec.timeInForce
    });
    await db.run(
      `UPDATE portfolio_orders
       SET status = 'submitted', broker_order_id = ?, broker_status = ?, decided_at = ?
       WHERE id = ?`,
      broker?.id || null,
      broker?.status || null,
      now,
      id
    );
  } catch (error) {
    await db.run(
      `UPDATE portfolio_orders
       SET status = 'failed', error_message = ?, decided_at = ?
       WHERE id = ?`,
      String(error.message || error).slice(0, 500),
      now,
      id
    );
    throw error;
  }
}

module.exports = { estimateNotional, decide, createOrder, approve, reject };
