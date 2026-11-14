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

    CREATE TABLE IF NOT EXISTS patient_transfers (
      id TEXT PRIMARY KEY,
      from_scenario_id TEXT NOT NULL,
      from_region_id TEXT NOT NULL,
      from_health_center_name TEXT NOT NULL,
      to_region_id TEXT NOT NULL,
      patient_json TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );

    -- Edições em andamento: o cenário de trabalho de cada unidade fica salvo no servidor
    -- a cada alteração, para que recarregar a página não perca o que foi feito.
    CREATE TABLE IF NOT EXISTS scenario_drafts (
      region_id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      scenario_json TEXT NOT NULL,
      strategy_id TEXT,
      selected_date TEXT,
      updated_at TEXT NOT NULL
    );

    -- Visitas retiradas de uma rota já planejada (o paciente avisou que estaria fora).
    CREATE TABLE IF NOT EXISTS route_removals (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      region_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      mode TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);
  // Bancos criados antes desta versão não têm a equipe nem a unidade em visit_results.
  const columns = (db.prepare('PRAGMA table_info(visit_results)').all() as { name: string }[]).map(column => column.name);
  if (!columns.includes('team_id')) db.exec('ALTER TABLE visit_results ADD COLUMN team_id TEXT');
  if (!columns.includes('region_id')) db.exec('ALTER TABLE visit_results ADD COLUMN region_id TEXT');
}

/** Território GeoSaúde de origem de um cenário amostrado (`<região>_amostra_<semente>_...`). */
export function regionOfScenario(scenarioId: string): string {
  const index = scenarioId.indexOf('_amostra_');
  return index > 0 ? scenarioId.slice(0, index) : scenarioId;
}
