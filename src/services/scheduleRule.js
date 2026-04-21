const schedule = require('node-schedule');

function buildScheduleRule(scheduleType, scheduledAt, timezone) {
  if (scheduleType === 'once') {
    return scheduledAt;
  }

  const rule = new schedule.RecurrenceRule();
  rule.tz = timezone || 'UTC';
  rule.hour = scheduledAt.getHours();
  rule.minute = scheduledAt.getMinutes();

  if (scheduleType === 'weekly') {
    rule.dayOfWeek = scheduledAt.getDay();
  } else if (scheduleType === 'monthly') {
    rule.date = scheduledAt.getDate();
  }

  return rule;
}

module.exports = { buildScheduleRule };
