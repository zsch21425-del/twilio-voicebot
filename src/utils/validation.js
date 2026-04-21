const sanitizeHtml = require('sanitize-html');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

const scheduleTypes = new Set(['once', 'daily', 'weekly', 'monthly']);

function sanitizeText(input, maxLength = 1000) {
  const stripped = sanitizeHtml(String(input || ''), {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();

  return stripped.slice(0, maxLength);
}

function normalizePhoneNumber(value) {
  const trimmed = String(value || '').trim();
  const parsed = parsePhoneNumberFromString(trimmed);

  if (!parsed || !parsed.isValid()) {
    return null;
  }

  return parsed.number;
}

function parseScheduleDate(input) {
  if (!input) {
    return null;
  }

  const dt = new Date(input);
  if (Number.isNaN(dt.getTime())) {
    return null;
  }

  return dt;
}

function validateSchedulePayload(payload) {
  const messageText = sanitizeText(payload.messageText, 1000);
  const smsText = sanitizeText(payload.smsText || '', 500);
  const scheduleType = String(payload.scheduleType || '').trim().toLowerCase();
  const timezone = sanitizeText(payload.timezone || 'UTC', 64) || 'UTC';
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
  const scheduledAt = parseScheduleDate(payload.scheduledAtIso || payload.scheduledAt);

  const errors = [];

  if (!messageText) {
    errors.push('Message is required.');
  }

  if (!phoneNumber) {
    errors.push('Phone number must be a valid E.164 number (example: +14155551212).');
  }

  if (!scheduleTypes.has(scheduleType)) {
    errors.push('Invalid schedule type.');
  }

  if (!scheduledAt) {
    errors.push('Scheduled date/time is invalid.');
  }

  if (scheduleType === 'once' && scheduledAt && scheduledAt <= new Date()) {
    errors.push('One-time schedule must be in the future.');
  }

  return {
    errors,
    value: {
      messageText,
      smsText,
      scheduleType,
      timezone,
      phoneNumber,
      scheduledAt
    }
  };
}

module.exports = {
  sanitizeText,
  normalizePhoneNumber,
  validateSchedulePayload
};
