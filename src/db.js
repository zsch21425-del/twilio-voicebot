const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DB_PATH = path.join(process.cwd(), 'data.sqlite');

async function initDb() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      message_text TEXT NOT NULL,
      sms_text TEXT,
      schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'daily', 'weekly', 'monthly')),
      scheduled_at TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER,
      call_sid TEXT,
      status TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS portfolio_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('buy','sell')),
      qty REAL,
      notional REAL,
      order_type TEXT NOT NULL DEFAULT 'market',
      time_in_force TEXT NOT NULL DEFAULT 'day',
      est_notional REAL NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending_approval','auto_executed','submitted','rejected','cancelled','failed')),
      reason TEXT,
      broker_order_id TEXT,
      broker_status TEXT,
      error_message TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      decided_at TEXT
    );
  `);

  return db;
}

module.exports = { initDb };
