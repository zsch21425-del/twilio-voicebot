const schedule = require('node-schedule');
const alpaca = require('./alpacaService');
const { fetchSnapshot } = require('./portfolioSnapshot');
const strategist = require('./strategist');
const { analysisCron, analysisTimezone } = require('../config');

let job = null;

function isEnabled() {
  return Boolean(analysisCron && alpaca.isConfigured && strategist.isConfigured);
}

async function runAnalysisOnce() {
  const snapshot = await fetchSnapshot();
  return strategist.analyze({
    db: currentDb,
    snapshot,
    source: 'scheduled'
  });
}

let currentDb = null;

function start(db) {
  currentDb = db;
  if (!isEnabled()) {
    // eslint-disable-next-line no-console
    console.log('[portfolio] nightly analysis disabled (missing cron, Alpaca keys, or Anthropic key).');
    return null;
  }
  const rule = { rule: analysisCron, tz: analysisTimezone };
  job = schedule.scheduleJob(rule, async () => {
    try {
      const result = await runAnalysisOnce();
      // eslint-disable-next-line no-console
      console.log(`[portfolio] scheduled analysis ${result.id} stored.`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[portfolio] scheduled analysis failed:', error.message);
    }
  });
  // eslint-disable-next-line no-console
  console.log(`[portfolio] nightly analysis scheduled: "${analysisCron}" (${analysisTimezone}).`);
  return job;
}

function stop() {
  if (job) {
    job.cancel();
    job = null;
  }
}

module.exports = { start, stop, runAnalysisOnce, isEnabled };
