import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'routing.db');
export const db: Database.Database = new Database(dbPath);

// Habilitar chave estrangeira e WAL mode
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT NOT NULL,
      version INTEGER NOT NULL,
      name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (id, version)
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      scenario_version INTEGER NOT NULL,
      strategy_id TEXT NOT NULL,
      plan_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (scenario_id, scenario_version) REFERENCES scenarios (id, version) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS visit_results (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      condition_id TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);
}
