const {
  alpacaKeyId,
  alpacaSecretKey,
  alpacaBaseUrl
} = require('../config');

const isConfigured = Boolean(alpacaKeyId && alpacaSecretKey);
const isPaper = /paper-api\.alpaca\.markets/i.test(alpacaBaseUrl);

function headers() {
  return {
    'APCA-API-KEY-ID': alpacaKeyId,
    'APCA-API-SECRET-KEY': alpacaSecretKey,
    'Content-Type': 'application/json'
  };
}

async function alpacaFetch(path, init = {}) {
  if (!isConfigured) {
    const err = new Error('Alpaca not configured. Set ALPACA_KEY_ID and ALPACA_SECRET_KEY.');
    err.code = 'NOT_CONFIGURED';
    throw err;
  }
  const res = await fetch(`${alpacaBaseUrl}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) }
  });
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = new Error(`Alpaca ${init.method || 'GET'} ${path} failed: ${res.status} ${text}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function getAccount() {
  return alpacaFetch('/v2/account');
}

async function getPositions() {
  return alpacaFetch('/v2/positions');
}

async function getOpenOrders() {
  return alpacaFetch('/v2/orders?status=open&limit=100');
}

async function getClock() {
  return alpacaFetch('/v2/clock');
}

async function submitOrder({ symbol, qty, notional, side, type = 'market', timeInForce = 'day' }) {
  const payload = { symbol, side, type, time_in_force: timeInForce };
  if (qty != null) payload.qty = String(qty);
  else if (notional != null) payload.notional = String(notional);
  else throw new Error('submitOrder requires qty or notional');

  return alpacaFetch('/v2/orders', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

module.exports = {
  isConfigured,
  isPaper,
  baseUrl: alpacaBaseUrl,
  getAccount,
  getPositions,
  getOpenOrders,
  getClock,
  submitOrder
};
