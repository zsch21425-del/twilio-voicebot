const crypto = require('crypto');
const ttsService = require('./ttsService');
const twilioService = require('./twilioService');
const {
  tradingAlertsEnabled,
  tradingAlertsPhone,
  tradingAlertsChannel,
  publicBaseUrl,
  googleCredentialsPath
} = require('../config');

const MAX_SMS_LEN = 1500;
const MAX_SPEECH_LEN = 600;

function isConfigured() {
  return tradingAlertsEnabled && Boolean(tradingAlertsPhone) && twilioService.isConfigured;
}

function truncate(text, max) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function buildTradesMessage(orders) {
  if (!orders || !orders.length) return null;
  const lines = orders.map((o) => {
    const label = o.action === 'auto_executed'
      ? 'submitted'
      : o.action === 'pending_approval'
      ? 'queued for approval'
      : o.action;
    const dollars = Number(o.estNotional || 0).toFixed(2);
    return `${o.symbol || '?'} ${o.side || '?'} $${dollars} ${label}`;
  });
  const header = `AI analysis placed ${orders.length} order${orders.length === 1 ? '' : 's'}:`;
  return `${header}\n${lines.join('\n')}`;
}

function buildPauseMessage(reason) {
  return `Auto-execute PAUSED. ${reason || 'Manual pause from dashboard.'}`;
}

function buildFailureMessage({ symbol, side, estNotional, error }) {
  const dollars = Number(estNotional || 0).toFixed(2);
  return `Order FAILED: ${symbol} ${side} $${dollars}. Reason: ${error || 'unknown'}`;
}

async function sendSmsSafe(text) {
  if (!isConfigured()) return null;
  try {
    return await twilioService.sendSms(tradingAlertsPhone, truncate(text, MAX_SMS_LEN));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[notifier] SMS failed:', error.message);
    return null;
  }
}

async function sendVoiceSafe(text) {
  if (!isConfigured()) return null;
  if (!googleCredentialsPath) {
    // Fall back to SMS if TTS isn't configured.
    return sendSmsSafe(text);
  }
  if (!publicBaseUrl || publicBaseUrl.includes('localhost')) {
    // Twilio can't reach localhost — fall back to SMS.
    return sendSmsSafe(`[voice-fallback] ${text}`);
  }
  try {
    const speechText = truncate(text, MAX_SPEECH_LEN);
    const token = crypto.randomBytes(8).toString('hex');
    const filename = `alert-${token}.mp3`;
    await ttsService.synthesizeToFile(speechText, filename);
    const twimlPath = `/twiml/alert?audio=${encodeURIComponent(filename)}`;
    return await twilioService.placeAlertCall(tradingAlertsPhone, twimlPath);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[notifier] voice call failed:', error.message);
    return sendSmsSafe(`[voice-failed] ${text}`);
  }
}

async function notifyTrades(orders) {
  const message = buildTradesMessage(orders);
  if (!message) return;
  // Trades are routine info. SMS by default; voice only when channel=voice.
  if (tradingAlertsChannel === 'voice') {
    await sendVoiceSafe(message);
  } else {
    await sendSmsSafe(message);
  }
}

async function notifyPause(reason) {
  const message = buildPauseMessage(reason);
  // Pauses are urgent — voice on "voice" or "both".
  if (tradingAlertsChannel === 'sms') {
    await sendSmsSafe(message);
  } else {
    await sendVoiceSafe(message);
    if (tradingAlertsChannel === 'both') await sendSmsSafe(message);
  }
}

async function notifyFailure(details) {
  const message = buildFailureMessage(details);
  if (tradingAlertsChannel === 'sms') {
    await sendSmsSafe(message);
  } else {
    await sendVoiceSafe(message);
    if (tradingAlertsChannel === 'both') await sendSmsSafe(message);
  }
}

module.exports = {
  isConfigured,
  buildTradesMessage,
  buildPauseMessage,
  buildFailureMessage,
  notifyTrades,
  notifyPause,
  notifyFailure
};
