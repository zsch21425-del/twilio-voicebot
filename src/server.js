const fs = require('fs/promises');
const path = require('path');
const schedule = require('node-schedule');
const { initDb } = require('./db');
const { createApp } = require('./app');
const { SchedulerService } = require('./services/schedulerService');
const { startAudioCleanup } = require('./services/audioCleanup');
const portfolioAnalysisScheduler = require('./services/portfolioAnalysisScheduler');
const { port } = require('./config');

async function bootstrap() {
  await fs.mkdir(path.join(process.cwd(), 'public', 'audio'), { recursive: true });

  const db = await initDb();
  const scheduler = new SchedulerService(db);
  await scheduler.restore();

  const cleanupTimer = startAudioCleanup();
  portfolioAnalysisScheduler.start(db);

  const app = createApp({ db, scheduler });
  const server = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\nReceived ${signal}, shutting down...`);
    clearInterval(cleanupTimer);
    portfolioAnalysisScheduler.stop();
    try {
      await schedule.gracefulShutdown();
      await new Promise((resolve) => server.close(resolve));
      await db.close();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error during shutdown:', error);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start app:', error);
  process.exit(1);
});
