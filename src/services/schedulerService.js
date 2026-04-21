const schedule = require('node-schedule');
const { buildScheduleRule } = require('./scheduleRule');
const { synthesizeToFile } = require('./ttsService');
const { sendSms, placeCall, isConfigured } = require('./twilioService');

class SchedulerService {
  constructor(db) {
    this.db = db;
    this.jobs = new Map();
  }

  async restore() {
    const schedules = await this.db.all('SELECT * FROM schedules WHERE enabled = 1');
    for (const row of schedules) {
      this.scheduleRow(row);
    }
  }

  cancel(id) {
    const job = this.jobs.get(Number(id));
    if (job) {
      job.cancel();
      this.jobs.delete(Number(id));
    }
  }

  async refresh(id) {
    this.cancel(id);
    const row = await this.db.get('SELECT * FROM schedules WHERE id = ?', id);
    if (row && row.enabled) {
      this.scheduleRow(row);
    }
  }

  scheduleRow(row) {
    const scheduleId = Number(row.id);
    const scheduledAt = new Date(row.scheduled_at);
    const rule = buildScheduleRule(row.schedule_type, scheduledAt, row.timezone);

    const job = schedule.scheduleJob(rule, async () => {
      await this.executeSchedule(scheduleId);
    });

    if (job) {
      this.jobs.set(scheduleId, job);
    }
  }

  async executeSchedule(scheduleId) {
    const row = await this.db.get('SELECT * FROM schedules WHERE id = ? AND enabled = 1', scheduleId);
    if (!row) {
      this.cancel(scheduleId);
      return;
    }

    const now = new Date().toISOString();

    try {
      const audioFilename = `schedule-${scheduleId}-${Date.now()}.mp3`;
      await synthesizeToFile(row.message_text, audioFilename);

      if (row.sms_text) {
        await sendSms(row.phone_number, row.sms_text);
      }

      const call = await placeCall(row.phone_number, `/twiml/${scheduleId}?audio=${encodeURIComponent(audioFilename)}`, scheduleId);

      await this.db.run(
        'INSERT INTO call_logs (schedule_id, call_sid, status, error_message, created_at) VALUES (?, ?, ?, ?, ?)',
        scheduleId,
        call?.sid || null,
        call ? 'initiated' : isConfigured ? 'unknown' : 'skipped_unconfigured',
        null,
        now
      );

      await this.db.run('UPDATE schedules SET last_run_at = ?, updated_at = ? WHERE id = ?', now, now, scheduleId);

      if (row.schedule_type === 'once') {
        await this.db.run('UPDATE schedules SET enabled = 0, updated_at = ? WHERE id = ?', now, scheduleId);
        this.cancel(scheduleId);
      }
    } catch (error) {
      await this.db.run(
        'INSERT INTO call_logs (schedule_id, call_sid, status, error_message, created_at) VALUES (?, ?, ?, ?, ?)',
        scheduleId,
        null,
        'failed',
        error.message.slice(0, 500),
        now
      );
    }
  }
}

module.exports = { SchedulerService };
