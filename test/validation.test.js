const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePhoneNumber, validateSchedulePayload } = require('../src/utils/validation');

test('normalizePhoneNumber returns E.164 for valid numbers', () => {
  assert.equal(normalizePhoneNumber('+1 415 555 1212'), '+14155551212');
});

test('validateSchedulePayload rejects invalid schedule type', () => {
  const result = validateSchedulePayload({
    phoneNumber: '+14155551212',
    messageText: 'hello',
    scheduleType: 'yearly',
    scheduledAt: new Date(Date.now() + 60_000).toISOString()
  });

  assert.equal(result.errors.includes('Invalid schedule type.'), true);
});

test('validateSchedulePayload rejects past once schedules', () => {
  const result = validateSchedulePayload({
    phoneNumber: '+14155551212',
    messageText: 'hello',
    scheduleType: 'once',
    scheduledAt: new Date(Date.now() - 60_000).toISOString()
  });

  assert.equal(result.errors.includes('One-time schedule must be in the future.'), true);
});
