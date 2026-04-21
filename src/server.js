const { initDb } = require('./db');
const { createApp } = require('./app');
const { SchedulerService } = require('./services/schedulerService');
const { port } = require('./config');

async function bootstrap() {
  const db = await initDb();
  const scheduler = new SchedulerService(db);
  await scheduler.restore();

  const app = createApp({ db, scheduler });
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
  });
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start app:', error);
  process.exit(1);
});
