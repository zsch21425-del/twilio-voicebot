const test = require('node:test');
const assert = require('node:assert/strict');
const { buildScheduleRule } = require('../src/services/scheduleRule');

test('buildScheduleRule returns Date for once', () => {
  const date = new Date('2030-01-01T10:15:00Z');
  const rule = buildScheduleRule('once', date, 'UTC');
  assert.equal(rule, date);
});

test('buildScheduleRule sets weekly day and time', () => {
  const date = new Date('2030-01-07T10:15:00Z');
  const rule = buildScheduleRule('weekly', date, 'UTC');
  assert.equal(rule.dayOfWeek, 1);
  assert.equal(rule.hour, 10);
  assert.equal(rule.minute, 15);
});

test('buildScheduleRule sets monthly date and time', () => {
  const date = new Date('2030-01-22T08:45:00Z');
  const rule = buildScheduleRule('monthly', date, 'UTC');
  assert.equal(rule.date, 22);
  assert.equal(rule.hour, 8);
  assert.equal(rule.minute, 45);
});
