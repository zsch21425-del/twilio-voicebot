const twilio = require('twilio');
const {
  twilioAccountSid,
  twilioAuthToken,
  twilioPhoneNumber,
  publicBaseUrl
} = require('../config');

const isConfigured = Boolean(twilioAccountSid && twilioAuthToken && twilioPhoneNumber);
const client = isConfigured ? twilio(twilioAccountSid, twilioAuthToken) : null;

async function sendSms(to, body) {
  if (!isConfigured || !body) {
    return null;
  }

  return client.messages.create({
    to,
    from: twilioPhoneNumber,
    body
  });
}

async function placeCall(to, twimlPath, scheduleId) {
  if (!isConfigured) {
    return null;
  }

  const callbackPath = `/webhooks/call-status?scheduleId=${encodeURIComponent(String(scheduleId))}`;

  return client.calls.create({
    to,
    from: twilioPhoneNumber,
    url: `${publicBaseUrl}${twimlPath}`,
    statusCallback: `${publicBaseUrl}${callbackPath}`,
    statusCallbackMethod: 'POST',
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    method: 'GET',
  });
}

async function placeAlertCall(to, twimlPath) {
  if (!isConfigured) {
    return null;
  }
  return client.calls.create({
    to,
    from: twilioPhoneNumber,
    url: `${publicBaseUrl}${twimlPath}`,
    method: 'GET'
  });
}

module.exports = { sendSms, placeCall, placeAlertCall, isConfigured };
