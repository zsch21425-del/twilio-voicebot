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

test('validateSchedulePayload prefers scheduledAtIso over scheduledAt', () => {
  const iso = new Date(Date.now() + 60 * 60_000).toISOString();
  const result = validateSchedulePayload({
    phoneNumber: '+14155551212',
    messageText: 'hello',
    scheduleType: 'once',
    scheduledAt: 'not-a-date',
    scheduledAtIso: iso
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.value.scheduledAt.toISOString(), iso);
});

test('validateSchedulePayload strips HTML from the message', () => {
  const result = validateSchedulePayload({
    phoneNumber: '+14155551212',
    messageText: '<b>Hi</b> <script>alert(1)</script>there',
    scheduleType: 'once',
    scheduledAt: new Date(Date.now() + 60_000).toISOString()
  });
  assert.equal(result.value.messageText, 'Hi there');
});
