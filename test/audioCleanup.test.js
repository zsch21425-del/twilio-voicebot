const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');

const { cleanupOldAudio, AUDIO_DIR } = require('../src/services/audioCleanup');

test('cleanupOldAudio removes stale mp3 files but keeps fresh ones', async () => {
  await fs.mkdir(AUDIO_DIR, { recursive: true });

  const stale = path.join(AUDIO_DIR, 'test-stale.mp3');
  const fresh = path.join(AUDIO_DIR, 'test-fresh.mp3');

  await fs.writeFile(stale, 'x');
  await fs.writeFile(fresh, 'y');

  const oldTime = new Date(Date.now() - 48 * 60 * 60 * 1000);
  await fs.utimes(stale, oldTime, oldTime);

  const { removed } = await cleanupOldAudio(24 * 60 * 60 * 1000);
  assert.ok(removed >= 1);

  await assert.rejects(fs.access(stale));
  await fs.access(fresh);

  await fs.unlink(fresh).catch(() => {});
});
