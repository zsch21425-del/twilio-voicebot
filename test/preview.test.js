const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

// Force a clean environment for these tests so the route's "not configured"
// branch is exercised deterministically.
process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
process.env.GOOGLE_CREDENTIALS_JSON = '';
process.env.TWILIO_ACCOUNT_SID = '';
process.env.TWILIO_AUTH_TOKEN = '';
process.env.TWILIO_PHONE_NUMBER = '';

const { createApp } = require('../src/app');

function makeStubDb(rows = []) {
  return {
    all: async () => rows,
    get: async (_sql, id) => rows.find((r) => r.id === Number(id)),
    run: async () => ({ lastID: 1 })
  };
}

function makeStubScheduler({ executeSpy } = {}) {
  return {
    getJob: () => null,
    refresh: async () => {},
    cancel: () => {},
    executeSchedule: async (id) => {
      if (executeSpy) executeSpy(id);
    }
  };
}

test('POST /tts/preview returns 400 when text is missing', async () => {
  const app = createApp({ db: makeStubDb(), scheduler: makeStubScheduler() });
  const res = await request(app).post('/tts/preview').send({});
  assert.equal(res.status, 400);
  assert.match(res.body.error || '', /required/i);
});

test('POST /tts/preview returns 400 when text strips to empty', async () => {
  const app = createApp({ db: makeStubDb(), scheduler: makeStubScheduler() });
  const res = await request(app)
    .post('/tts/preview')
    .send({ text: '<script></script>   ' });
  assert.equal(res.status, 400);
});

test('POST /tts/preview returns 503 when Google TTS not configured', async () => {
  const app = createApp({ db: makeStubDb(), scheduler: makeStubScheduler() });
  const res = await request(app)
    .post('/tts/preview')
    .send({ text: 'Hello there.' });
  assert.equal(res.status, 503);
  assert.match(res.body.error || '', /not configured/i);
});

test('POST /schedules/:id/run-now returns 400 for non-numeric id', async () => {
  const app = createApp({ db: makeStubDb(), scheduler: makeStubScheduler() });
  const res = await request(app).post('/schedules/abc/run-now');
  assert.equal(res.status, 400);
});

test('POST /schedules/:id/run-now returns 404 for unknown id', async () => {
  const app = createApp({ db: makeStubDb(), scheduler: makeStubScheduler() });
  const res = await request(app).post('/schedules/999/run-now');
  assert.equal(res.status, 404);
});

test('POST /schedules/:id/run-now triggers executeSchedule and redirects', async () => {
  let calledWith = null;
  const db = makeStubDb([{ id: 7, phone_number: '+14155551212', enabled: 1 }]);
  const scheduler = makeStubScheduler({
    executeSpy: (id) => {
      calledWith = id;
    }
  });
  const app = createApp({ db, scheduler });
  const res = await request(app).post('/schedules/7/run-now');
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, '/logs');
  // executeSchedule is fire-and-forget; give it a tick.
  await new Promise((r) => setImmediate(r));
  assert.equal(calledWith, 7);
});
