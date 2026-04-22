const express = require('express');
const rateLimit = require('express-rate-limit');
const twilio = require('twilio');
const { validateSchedulePayload, sanitizeText } = require('../utils/validation');
const {
  rateLimitMaxRequests,
  rateLimitWindowMs,
  publicBaseUrl,
  twilioAuthToken,
  googleCredentialsPath,
  alpacaAutoExecuteMaxUsd,
  alpacaAutoExecuteEnabled
} = require('../config');
const { isConfigured: twilioConfigured } = require('../services/twilioService');
const ttsService = require('../services/ttsService');
const alpaca = require('../services/alpacaService');
const { fetchSnapshot } = require('../services/portfolioSnapshot');
const orderPolicy = require('../services/orderPolicy');
const strategist = require('../services/strategist');
const { DEFAULT_MASTER_PROMPT } = require('../services/masterPrompt');

function createWebRouter(db, scheduler) {
  const router = express.Router();

  const publicEndpointLimiter = rateLimit({
    windowMs: rateLimitWindowMs,
    limit: rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false
  });

  router.use(publicEndpointLimiter);

  const configStatus = {
    twilio: twilioConfigured,
    google: Boolean(googleCredentialsPath),
    alpaca: alpaca.isConfigured,
    alpacaMode: alpaca.isPaper ? 'paper' : 'live',
    autoExecEnabled: alpacaAutoExecuteEnabled,
    autoExecCapUsd: alpacaAutoExecuteMaxUsd,
    anthropic: strategist.isConfigured
  };

  router.use((req, res, next) => {
    res.locals.configStatus = configStatus;
    next();
  });

  router.get('/', async (_req, res) => {
    res.render('index', {
      pageTitle: 'Schedule Voice Calls',
      errors: [],
      formData: {},
      success: null
    });
  });

  router.get('/schedules', async (_req, res) => {
    const schedules = await db.all('SELECT * FROM schedules ORDER BY created_at DESC');
    const enriched = schedules.map((job) => {
      const live = scheduler.getJob(job.id);
      const nextInvocation = live?.nextInvocation?.();
      return {
        ...job,
        next_run_at: nextInvocation ? nextInvocation.toISOString() : null
      };
    });
    res.render('schedules', {
      pageTitle: 'Scheduled Jobs',
      schedules: enriched
    });
  });

  router.post('/schedules', async (req, res) => {
    const { errors, value } = validateSchedulePayload(req.body);

    if (errors.length > 0) {
      return res.status(400).render('index', {
        pageTitle: 'Schedule Voice Calls',
        errors,
        formData: req.body,
        success: null
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

    return res.redirect(`/schedules?created=${result.lastID}`);
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
    await db.run(
      'UPDATE schedules SET enabled = ?, updated_at = ? WHERE id = ?',
      enabled,
      new Date().toISOString(),
      id
    );
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

  router.post('/schedules/:id/run-now', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).send('Invalid schedule ID');
    }

    const row = await db.get('SELECT id FROM schedules WHERE id = ?', id);
    if (!row) {
      return res.status(404).send('Schedule not found');
    }

    Promise.resolve()
      .then(() => scheduler.executeSchedule(id))
      .catch((error) => {
        console.error(`run-now for schedule ${id} failed:`, error);
      });

    return res.redirect('/logs');
  });

  router.get('/logs', async (_req, res) => {
    const logs = await db.all(`
      SELECT l.id, l.schedule_id, l.call_sid, l.status, l.error_message, l.created_at,
             s.phone_number, s.schedule_type
      FROM call_logs l
      LEFT JOIN schedules s ON s.id = l.schedule_id
      ORDER BY l.created_at DESC
      LIMIT 200
    `);
    res.render('logs', {
      pageTitle: 'Call Logs',
      logs
    });
  });

  router.get('/twiml/:id', async (req, res) => {
    const id = Number(req.params.id);
    const audio = String(req.query.audio || '').replace(/[^a-zA-Z0-9._-]/g, '');

    const scheduleRow = await db.get('SELECT id FROM schedules WHERE id = ?', id);
    if (!scheduleRow || !audio) {
      return res.status(404).send('Not found');
    }

    const base = publicBaseUrl || `${req.protocol}://${req.get('host')}`;
    res.type('text/xml');
    return res.send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Play>${base}/audio/${audio}</Play></Response>`
    );
  });

  router.get('/debug/audio', async (_req, res) => {
    const fs = require('fs/promises');
    const path = require('path');
    const audioDir = path.join(process.cwd(), 'public', 'audio');
    let entries = [];
    let dirExists = false;
    let err = null;
    try {
      const names = await fs.readdir(audioDir);
      dirExists = true;
      entries = await Promise.all(
        names.map(async (name) => {
          try {
            const stat = await fs.stat(path.join(audioDir, name));
            return { name, size: stat.size, mtime: stat.mtime.toISOString() };
          } catch (e) {
            return { name, error: e.message };
          }
        })
      );
    } catch (e) {
      err = e.message;
    }
    res.json({
      cwd: process.cwd(),
      audioDir,
      publicBaseUrl: publicBaseUrl || null,
      dirExists,
      entries,
      err
    });
  });

  router.post('/tts/preview', async (req, res, next) => {
    try {
      const text = sanitizeText(req.body?.text || '', 1000);
      if (!text) {
        return res.status(400).json({ error: 'Text is required (1-1000 chars after sanitization).' });
      }
      if (!googleCredentialsPath) {
        return res.status(503).json({ error: 'Google TTS not configured. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CREDENTIALS_JSON.' });
      }

      const voice = typeof req.body?.voice === 'string' ? req.body.voice.slice(0, 64) : undefined;
      const language = typeof req.body?.language === 'string' ? req.body.language.slice(0, 16) : undefined;

      const buffer = await ttsService.synthesizeToBuffer(text, { voice, language });
      res.set('Content-Type', 'audio/mpeg');
      res.set('Cache-Control', 'no-store');
      res.set('Content-Length', String(buffer.length));
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/portfolio', async (_req, res, next) => {
    try {
      if (!alpaca.isConfigured) {
        return res.render('portfolio', {
          pageTitle: 'Portfolio',
          snapshot: null,
          pendingOrders: [],
          recentOrders: [],
          error: 'Alpaca not configured. Set ALPACA_KEY_ID and ALPACA_SECRET_KEY in .env.'
        });
      }
      const snapshot = await fetchSnapshot();
      const pendingOrders = await db.all(
        `SELECT * FROM portfolio_orders WHERE status = 'pending_approval' ORDER BY created_at DESC`
      );
      const recentOrders = await db.all(
        `SELECT * FROM portfolio_orders WHERE status != 'pending_approval' ORDER BY created_at DESC LIMIT 20`
      );
      return res.render('portfolio', {
        pageTitle: 'Portfolio',
        snapshot,
        pendingOrders,
        recentOrders,
        error: null
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/portfolio/snapshot.json', async (_req, res, next) => {
    try {
      if (!alpaca.isConfigured) {
        return res.status(503).json({ error: 'Alpaca not configured.' });
      }
      const snapshot = await fetchSnapshot();
      return res.json(snapshot);
    } catch (error) {
      return next(error);
    }
  });

  router.post('/portfolio/orders', async (req, res, next) => {
    try {
      if (!alpaca.isConfigured) {
        return res.status(503).json({ error: 'Alpaca not configured.' });
      }
      const { symbol, side, qty, notional, refPrice, orderType, timeInForce, source } = req.body || {};
      if (!symbol || !side) {
        return res.status(400).json({ error: 'symbol and side are required' });
      }
      const result = await orderPolicy.createOrder(db, {
        symbol: String(symbol).toUpperCase().slice(0, 16),
        side: side === 'sell' ? 'sell' : 'buy',
        qty: qty != null ? Number(qty) : null,
        notional: notional != null ? Number(notional) : null,
        refPrice: refPrice != null ? Number(refPrice) : null,
        orderType: orderType || 'market',
        timeInForce: timeInForce || 'day'
      }, { source: source || 'manual' });
      return res.status(201).json(result);
    } catch (error) {
      return next(error);
    }
  });

  router.post('/portfolio/orders/:id/approve', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).send('Invalid order ID');
      await orderPolicy.approve(db, id);
      return res.redirect('/portfolio');
    } catch (error) {
      return next(error);
    }
  });

  router.post('/portfolio/orders/:id/reject', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).send('Invalid order ID');
      await orderPolicy.reject(db, id);
      return res.redirect('/portfolio');
    } catch (error) {
      return next(error);
    }
  });

  router.get('/portfolio/analyses', async (_req, res, next) => {
    try {
      const analyses = await db.all(
        `SELECT id, model, source, created_at, error_message,
                input_tokens, output_tokens,
                cache_read_input_tokens, cache_creation_input_tokens,
                substr(response_text, 1, 400) AS preview
         FROM portfolio_analyses
         ORDER BY id DESC
         LIMIT 50`
      );
      const settings = await strategist.loadSettings(db);
      return res.render('analyses', {
        pageTitle: 'Portfolio Analyses',
        analyses,
        settings,
        defaultMasterPrompt: DEFAULT_MASTER_PROMPT,
        strategistConfigured: strategist.isConfigured
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/portfolio/analyses/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).send('Invalid analysis ID');
      const row = await db.get('SELECT * FROM portfolio_analyses WHERE id = ?', id);
      if (!row) return res.status(404).send('Not found');
      return res.render('analysis', {
        pageTitle: `Analysis #${row.id}`,
        analysis: row
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/portfolio/analyze', async (req, res, next) => {
    try {
      if (!alpaca.isConfigured) {
        return res.status(503).json({ error: 'Alpaca not configured.' });
      }
      if (!strategist.isConfigured) {
        return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured.' });
      }
      const snapshot = await fetchSnapshot();
      const extra = typeof req.body?.instruction === 'string' ? req.body.instruction.slice(0, 1000) : '';
      const result = await strategist.analyze({ db, snapshot, extraInstruction: extra, source: 'manual' });
      return res.redirect(`/portfolio/analyses/${result.id}`);
    } catch (error) {
      return next(error);
    }
  });

  router.post('/portfolio/settings', async (req, res, next) => {
    try {
      const profileJson = typeof req.body?.profile === 'string' ? req.body.profile.slice(0, 10000) : '';
      const masterPrompt = typeof req.body?.master_prompt === 'string' ? req.body.master_prompt.slice(0, 20000) : '';
      const now = new Date().toISOString();
      await db.run(
        `INSERT INTO portfolio_settings (id, profile_json, master_prompt, updated_at)
         VALUES (1, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           profile_json = excluded.profile_json,
           master_prompt = excluded.master_prompt,
           updated_at = excluded.updated_at`,
        profileJson || null,
        masterPrompt || null,
        now
      );
      return res.redirect('/portfolio/analyses');
    } catch (error) {
      return next(error);
    }
  });

  router.post(
    '/webhooks/call-status',
    (req, res, next) => {
      if (!twilioAuthToken) return next();
      const signature = req.header('X-Twilio-Signature');
      const fullUrl = `${publicBaseUrl}${req.originalUrl}`;
      const valid = signature
        ? twilio.validateRequest(twilioAuthToken, signature, fullUrl, req.body)
        : false;
      if (!valid) {
        return res.status(403).send('Invalid Twilio signature');
      }
      return next();
    },
    async (req, res) => {
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
    }
  );

  return router;
}

module.exports = { createWebRouter };
