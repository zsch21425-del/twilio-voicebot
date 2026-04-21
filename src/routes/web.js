const express = require('express');
const rateLimit = require('express-rate-limit');
const { validateSchedulePayload } = require('../utils/validation');
const { rateLimitMaxRequests, rateLimitWindowMs } = require('../config');

function createWebRouter(db, scheduler) {
  const router = express.Router();

  const createScheduleLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false
  });

  router.get('/', async (req, res) => {
    res.render('index', {
      pageTitle: 'Schedule Voice Calls',
      errors: [],
      formData: {}
    });
  });

  router.get('/schedules', async (req, res) => {
    const schedules = await db.all('SELECT * FROM schedules ORDER BY created_at DESC');
    res.render('schedules', {
      pageTitle: 'Scheduled Jobs',
      schedules
    });
  });

  router.post('/schedules', createScheduleLimiter, async (req, res) => {
    const { errors, value } = validateSchedulePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).render('index', {
        pageTitle: 'Schedule Voice Calls',
        errors,
        formData: req.body
      });
    }

    const now = new Date().toISOString();

    const result = await db.run(
      `INSERT INTO schedules (
        phone_number,
        message_text,
        sms_text,
        schedule_type,
        scheduled_at,
        timezone,
        enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      value.phoneNumber,
      value.messageText,
      value.smsText || null,
      value.scheduleType,
      value.scheduledAt.toISOString(),
      value.timezone,
      now,
      now
    );

    await scheduler.refresh(result.lastID);

    return res.redirect('/schedules');
  });

  router.post('/schedules/:id/toggle', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).send('Invalid schedule ID');
    }

    const row = await db.get('SELECT enabled FROM schedules WHERE id = ?', id);
    if (!row) {
      return res.status(404).send('Schedule not found');
    }

    const enabled = row.enabled ? 0 : 1;
    await db.run('UPDATE schedules SET enabled = ?, updated_at = ? WHERE id = ?', enabled, new Date().toISOString(), id);
    await scheduler.refresh(id);

    return res.redirect('/schedules');
  });

  router.post('/schedules/:id/delete', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).send('Invalid schedule ID');
    }

    await db.run('DELETE FROM schedules WHERE id = ?', id);
    scheduler.cancel(id);

    return res.redirect('/schedules');
  });

  router.get('/twiml/:id', async (req, res) => {
    const id = Number(req.params.id);
    const audio = String(req.query.audio || '').replace(/[^a-zA-Z0-9._-]/g, '');

    const scheduleRow = await db.get('SELECT id FROM schedules WHERE id = ?', id);
    if (!scheduleRow || !audio) {
      return res.status(404).send('Not found');
    }

    res.type('text/xml');
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Play>${req.protocol}://${req.get('host')}/audio/${audio}</Play></Response>`);
  });

  router.post('/webhooks/call-status', async (req, res) => {
    const scheduleId = Number(req.query.scheduleId);
    const status = String(req.body.CallStatus || 'unknown').slice(0, 64);
    const callSid = String(req.body.CallSid || '').slice(0, 128) || null;
    const now = new Date().toISOString();

    await db.run(
      'INSERT INTO call_logs (schedule_id, call_sid, status, error_message, created_at) VALUES (?, ?, ?, ?, ?)',
      Number.isInteger(scheduleId) ? scheduleId : null,
      callSid,
      status,
      null,
      now
    );

    res.sendStatus(204);
  });

  return router;
}

module.exports = { createWebRouter };
