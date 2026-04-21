const express = require('express');
const path = require('path');
const { createWebRouter } = require('./routes/web');

function createApp({ db, scheduler }) {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(process.cwd(), 'views'));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(path.join(process.cwd(), 'public')));

  app.use('/', createWebRouter(db, scheduler));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use((error, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(error);
    res.status(500).render('error', { pageTitle: 'Error' });
  });

  return app;
}

module.exports = { createApp };
