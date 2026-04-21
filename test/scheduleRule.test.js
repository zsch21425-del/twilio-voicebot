const test = require('node:test');
const assert = require('node:assert/strict');
const { buildScheduleRule, getWallClockParts } = require('../src/services/scheduleRule');

test('buildScheduleRule returns Date for once', () => {
  const date = new Date('2030-01-01T10:15:00Z');
  const rule = buildScheduleRule('once', date, 'UTC');
  assert.equal(rule, date);
});

test('buildScheduleRule sets weekly day and time in UTC', () => {
  const date = new Date('2030-01-07T10:15:00Z');
  const rule = buildScheduleRule('weekly', date, 'UTC');
  assert.equal(rule.dayOfWeek, 1);
  assert.equal(rule.hour, 10);
  assert.equal(rule.minute, 15);
});

test('buildScheduleRule sets monthly date and time in UTC', () => {
  const date = new Date('2030-01-22T08:45:00Z');
  const rule = buildScheduleRule('monthly', date, 'UTC');
  assert.equal(rule.date, 22);
  assert.equal(rule.hour, 8);
  assert.equal(rule.minute, 45);
});

test('buildScheduleRule uses wall-clock hour/minute of the target timezone', () => {
  const date = new Date('2030-06-15T17:30:00Z');
  const rule = buildScheduleRule('daily', date, 'America/New_York');
  assert.equal(rule.tz, 'America/New_York');
  assert.equal(rule.hour, 13);
  assert.equal(rule.minute, 30);
});

test('getWallClockParts computes day-of-week in the target timezone', () => {
  const date = new Date('2030-01-07T04:00:00Z');
  const parts = getWallClockParts(date, 'America/Los_Angeles');
  assert.equal(parts.day, 6);
  assert.equal(parts.dayOfWeek, 0);
});
