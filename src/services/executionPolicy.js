const DEFAULT_DEPOSIT_USD = 100;
const DEFAULT_GOAL_USD = 100000;
const DEFAULT_TIER_STEP_USD = 50;
const DEFAULT_FLOOR_CAP_USD = 100;

function computeTierCap({ equity, deposit, tierStep, floorCap }) {
  const dep = Number(deposit) || DEFAULT_DEPOSIT_USD;
  const step = Number(tierStep) || DEFAULT_TIER_STEP_USD;
  const floor = Number(floorCap) || DEFAULT_FLOOR_CAP_USD;
  const eq = Number(equity) || 0;
  const gain = Math.max(0, eq - dep);
  const tiers = Math.floor(gain / step);
  return Math.max(floor, floor + tiers * step);
}

async function loadState(db) {
  const row = await db.get(
    `SELECT deposit_usd, goal_usd, tier_step_usd, floor_cap_usd,
            autoexec_paused_at, live_ack_at
     FROM portfolio_settings WHERE id = 1`
  );
  return {
    deposit: row?.deposit_usd ?? DEFAULT_DEPOSIT_USD,
    goal: row?.goal_usd ?? DEFAULT_GOAL_USD,
    tierStep: row?.tier_step_usd ?? DEFAULT_TIER_STEP_USD,
    floorCap: row?.floor_cap_usd ?? DEFAULT_FLOOR_CAP_USD,
    pausedAt: row?.autoexec_paused_at || null,
    liveAckAt: row?.live_ack_at || null
  };
}

async function getDynamicCap(db, currentEquity) {
  const s = await loadState(db);
  return computeTierCap({
    equity: currentEquity,
    deposit: s.deposit,
    tierStep: s.tierStep,
    floorCap: s.floorCap
  });
}

async function isPaused(db) {
  const s = await loadState(db);
  return Boolean(s.pausedAt);
}

async function setPaused(db, paused, { reason = null } = {}) {
  const now = new Date().toISOString();
  await db.run(
    `UPDATE portfolio_settings SET autoexec_paused_at = ?, updated_at = ? WHERE id = 1`,
    paused ? now : null,
    now
  );
  if (paused) {
    // Defer require to avoid a cycle at module load.
    const notifier = require('./notifier');
    notifier.notifyPause(reason).catch(() => {});
  }
}

async function setLiveAck(db) {
  const now = new Date().toISOString();
  await db.run(
    `UPDATE portfolio_settings SET live_ack_at = ?, updated_at = ? WHERE id = 1`,
    now,
    now
  );
}

module.exports = {
  computeTierCap,
  loadState,
  getDynamicCap,
  isPaused,
  setPaused,
  setLiveAck,
  DEFAULT_DEPOSIT_USD,
  DEFAULT_GOAL_USD,
  DEFAULT_TIER_STEP_USD,
  DEFAULT_FLOOR_CAP_USD
};
