const schedule = require('node-schedule');

function getWallClockParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short'
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((p) => [p.type, p.value])
  );

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    dayOfWeek: weekdayMap[parts.weekday]
  };
}

function buildScheduleRule(scheduleType, scheduledAt, timezone) {
  if (scheduleType === 'once') {
    return scheduledAt;
  }

  const tz = timezone || 'UTC';
  const parts = getWallClockParts(scheduledAt, tz);

  const rule = new schedule.RecurrenceRule();
  rule.tz = tz;
  rule.hour = parts.hour;
  rule.minute = parts.minute;

  if (scheduleType === 'weekly') {
    rule.dayOfWeek = parts.dayOfWeek;
  } else if (scheduleType === 'monthly') {
    rule.date = parts.day;
  }

  return rule;
}

module.exports = { buildScheduleRule, getWallClockParts };
