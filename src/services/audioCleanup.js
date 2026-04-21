const fs = require('fs/promises');
const path = require('path');

const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio');

async function cleanupOldAudio(maxAgeMs = 24 * 60 * 60 * 1000) {
  let entries;
  try {
    entries = await fs.readdir(AUDIO_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') return { removed: 0 };
    throw error;
  }

  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  await Promise.all(
    entries
      .filter((name) => name.endsWith('.mp3'))
      .map(async (name) => {
        const filePath = path.join(AUDIO_DIR, name);
        try {
          const stat = await fs.stat(filePath);
          if (stat.mtimeMs < cutoff) {
            await fs.unlink(filePath);
            removed += 1;
          }
        } catch {
          // ignore missing/locked files
        }
      })
  );

  return { removed };
}

function startAudioCleanup({ intervalMs = 60 * 60 * 1000, maxAgeMs } = {}) {
  const timer = setInterval(() => {
    cleanupOldAudio(maxAgeMs).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Audio cleanup failed:', error);
    });
  }, intervalMs);
  timer.unref?.();
  return timer;
}

module.exports = { cleanupOldAudio, startAudioCleanup, AUDIO_DIR };
