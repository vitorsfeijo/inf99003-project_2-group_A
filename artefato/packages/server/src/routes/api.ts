import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/database.js';
import { planScenario, applyVisitResults, Scenario, Plan, VisitResult, PlanOptions, DailyTeamRoute } from '@routing/core';
import { generateRouteCsv } from '../export/csv.js';
import { generateRouteGpx } from '../export/gpx.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildWalkingCostMatrix } from './road-matrix.js';

const experimentalScenariosDirectories = [
  path.resolve(process.cwd(), 'experimentos/cenarios'),
  path.resolve(process.cwd(), '../../../experimentos/cenarios')
];

function getExperimentalScenariosDirectory(): string {
  return experimentalScenariosDirectories.find(directory => fs.existsSync(directory))
    || experimentalScenariosDirectories[0];
}

function readExperimentalScenario(id: string): Scenario | undefined {
  if (!/^[a-z0-9_-]+$/.test(id)) return undefined;
  const filePath = path.join(getExperimentalScenariosDirectory(), `${id}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Scenario;
}

export async function registerApiRoutes(fastify: FastifyInstance) {

  // Catálogo restrito aos territórios extraídos do GeoSaúde. Os pacientes
  // presentes nos arquivos são modelos sintéticos, não moradores cadastrados.
  fastify.get('/api/base-regions', async (_request, reply) => {
    const directory = getExperimentalScenariosDirectory();
    if (!fs.existsSync(directory)) return reply.status(404).send({ error: 'Territórios GeoSaúde não encontrados.' });
    return fs.readdirSync(directory)
      .filter(fileName => /^geosaude_[a-z0-9_-]+\.json$/.test(fileName))
      .map(fileName => readExperimentalScenario(fileName.slice(0, -5)))
      .filter((scenario): scenario is Scenario => Boolean(scenario?.polygons.length && scenario?.patients.length))
      .map(scenario => ({ id: scenario.id, name: scenario.polygons[0].name, polygonCount: scenario.polygons.length,
        healthCenterName: scenario.healthCenter.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  });

  fastify.get<{ Params: { id: string } }>('/api/base-regions/:id', async (request, reply) => {
    if (!request.params.id.startsWith('geosaude_')) return reply.status(404).send({ error: 'Região GeoSaúde não encontrada.' });
    const scenario = readExperimentalScenario(request.params.id);
    if (!scenario?.polygons.length || !scenario.patients.length) {
      return reply.status(404).send({ error: 'Região GeoSaúde não encontrada.' });
    }
    return scenario;
  });

  // A URL deve apontar para uma instância OSRM controlada pelo operador. Não
  // enviamos coordenadas de pacientes a um serviço público por padrão.
  fastify.get<{ Params: { planId: string }; Querystring: { date: string; teamId: string } }>(
    '/api/plans/:planId/road-route', async (request, reply) => {
      const baseUrl = process.env.OSRM_BASE_URL;
      if (!baseUrl) return reply.status(503).send({ error: 'OSRM_BASE_URL não configurada.' });
      const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(request.params.planId) as { plan_json: string } | undefined;
      if (!row) return reply.status(404).send({ error: 'Plano não encontrado.' });
      const plan = JSON.parse(row.plan_json) as Plan;
      const route = plan.routes.find(item => item.date === request.query.date && item.teamId === request.query.teamId);
      if (!route) return reply.status(404).send({ error: 'Rota não encontrada.' });
      const scenarioRow = db.prepare('SELECT data_json FROM scenarios WHERE id = ? AND version = ?')
        .get(plan.scenarioId, plan.scenarioVersion) as { data_json: string } | undefined;
      if (!scenarioRow) return reply.status(404).send({ error: 'Cenário não encontrado.' });
      const scenario = JSON.parse(scenarioRow.data_json) as Scenario;
      const locations = [scenario.healthCenter.location, ...route.visits.map(visit => {
        const patient = scenario.patients.find(item => item.id === visit.patientId);
        if (!patient) throw new Error(`Paciente ${visit.patientId} não encontrado no cenário.`);
        return patient.location;
      }), scenario.healthCenter.location];
      if (locations.length > 102) return reply.status(400).send({ error: 'Rota excede 100 visitas para consulta viária.' });
      const coordinates = locations.map(point => `${point.lng},${point.lat}`).join(';');
      const url = `${baseUrl.replace(/\/$/, '')}/route/v1/foot/${coordinates}?overview=full&geometries=geojson`;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`OSRM respondeu HTTP ${response.status}.`);
        const data = await response.json() as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
        const result = data.routes?.[0];
        if (data.code !== 'Ok' || !result) throw new Error(`OSRM não encontrou trajeto: ${data.code}.`);
        return { distanceKm: result.distance / 1000, durationMinutes: result.duration / 60,
          positions: result.geometry.coordinates.map(([lng, lat]) => [lat, lng]) };
      } catch (error) {
        return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
      }
    }
  );

  fastify.get('/api/routing-status', async () => {
    const baseUrl = process.env.OSRM_BASE_URL;
    if (!baseUrl) return { walkingNetworkConfigured: false };
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/nearest/v1/foot/-51.2177,-30.0346?number=1`,
        { signal: AbortSignal.timeout(3000) });
      if (!response.ok) return { walkingNetworkConfigured: false };
      const data = await response.json() as { code?: string; waypoints?: { distance: number }[] };
      return { walkingNetworkConfigured: data.code === 'Ok' && (data.waypoints?.[0]?.distance ?? Infinity) < 1000 };
    } catch {
      return { walkingNetworkConfigured: false };
    }
  });

  // Cenários JSON produzidos pela bancada experimental.
  fastify.get('/api/experimental-scenarios', async (_request, reply) => {
    const directory = getExperimentalScenariosDirectory();
    if (!fs.existsSync(directory)) {
      return reply.status(404).send({ error: 'Diretório de cenários experimentais não encontrado.' });
    }

    const scenarios = fs.readdirSync(directory)
      .filter(fileName => fileName.endsWith('.json'))
      .map(fileName => {
        const id = fileName.slice(0, -'.json'.length);
        const scenario = readExperimentalScenario(id);
        if (!scenario) return undefined;
        return {
          id: scenario.id,
          name: scenario.healthCenter.name,
          patientCount: scenario.patients.length,
          teamCount: scenario.teams.length,
          startDate: scenario.startDate,
          planningHorizonDays: scenario.planningHorizonDays
        };
      })
      .filter(Boolean);

    return scenarios;
  });

  fastify.get<{ Params: { id: string } }>('/api/experimental-scenarios/:id', async (request, reply) => {
    const scenario = readExperimentalScenario(request.params.id);
    if (!scenario) {
      return reply.status(404).send({ error: 'Cenário experimental não encontrado.' });
    }
    return scenario;
  });

  // 1. Criar / Importar Cenário JSON
  fastify.post('/api/scenarios', async (request: FastifyRequest, reply: FastifyReply) => {
    const scenarioData = request.body as Scenario;
    if (!scenarioData || !scenarioData.id) {
      return reply.status(400).send({ error: 'Cenário inválido ou id ausente.' });
    }

    const version = scenarioData.version || 1;
    const name = scenarioData.healthCenter?.name || scenarioData.id;
    const createdAt = new Date().toISOString();
    const dataJson = JSON.stringify(scenarioData);
    const existing = db.prepare('SELECT data_json FROM scenarios WHERE id = ? AND version = ?')
      .get(scenarioData.id, version) as { data_json: string } | undefined;

    if (!existing || existing.data_json !== dataJson) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO scenarios (id, version, name, data_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(scenarioData.id, version, name, dataJson, createdAt);
    }

    return { message: 'Cenário salvo com sucesso.', id: scenarioData.id, version };
  });

  // 2. Listar Cenários
  fastify.get('/api/scenarios', async () => {
    const rows = db.prepare(`
      SELECT id, version, name, created_at FROM scenarios ORDER BY created_at DESC
    `).all();
    return rows;
  });

  // 3. Obter Cenário Por ID
  fastify.get<{ Params: { id: string }; Querystring: { version?: number } }>('/api/scenarios/:id', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { version?: number } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const version = request.query.version;

    let row;
    if (version) {
      row = db.prepare('SELECT * FROM scenarios WHERE id = ? AND version = ?').get(id, version);
    } else {
      row = db.prepare('SELECT * FROM scenarios WHERE id = ? ORDER BY version DESC LIMIT 1').get(id);
    }

    if (!row) {
      return reply.status(404).send({ error: 'Cenário não encontrado.' });
    }

    return {
      ...(row as any),
      data: JSON.parse((row as any).data_json)
    };
  });

  // 4. Gerar Plano de Rotas para um Cenário
  fastify.post<{ Params: { id: string }; Body: Omit<PlanOptions, 'costMatrix'> & { scenarioVersion?: number } }>('/api/scenarios/:id/plan', async (request: FastifyRequest<{ Params: { id: string }; Body: Omit<PlanOptions, 'costMatrix'> & { scenarioVersion?: number } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const options = request.body || { strategyId: 'main-heuristic' };

    const row = options.scenarioVersion === undefined
      ? db.prepare('SELECT * FROM scenarios WHERE id = ? ORDER BY version DESC LIMIT 1').get(id)
      : db.prepare('SELECT * FROM scenarios WHERE id = ? AND version = ?').get(id, options.scenarioVersion);
    if (!row) {
      return reply.status(404).send({ error: 'Cenário não encontrado para planejamento.' });
    }

    const scenario: Scenario = JSON.parse((row as any).data_json);

    let costMatrix;
    try {
      costMatrix = await buildWalkingCostMatrix(scenario);
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
    try {
      const plan = planScenario(scenario, { ...options, costMatrix });
      const createdAt = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO plans (id, scenario_id, scenario_version, strategy_id, plan_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(plan.id, scenario.id, scenario.version, plan.strategyId, JSON.stringify(plan), createdAt);

      return plan;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Todos os métodos recebem a mesma amostra, versão e matriz de caminhada.
  fastify.post<{ Params: { id: string }; Body: { scenarioVersion: number } }>('/api/scenarios/:id/compare', async (request, reply) => {
    const version = request.body?.scenarioVersion;
    if (!Number.isInteger(version) || version < 1) return reply.status(400).send({ error: 'Versão do cenário inválida.' });
    const row = db.prepare('SELECT data_json FROM scenarios WHERE id = ? AND version = ?')
      .get(request.params.id, version) as { data_json: string } | undefined;
    if (!row) return reply.status(404).send({ error: 'Cenário não encontrado para comparação.' });
    const scenario = JSON.parse(row.data_json) as Scenario;
    let costMatrix;
    try {
      costMatrix = await buildWalkingCostMatrix(scenario);
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
    try {
      const strategies = ['main-heuristic', 'urgency-baseline', 'nearest-baseline'];
      const plans = strategies.map(strategyId => planScenario(scenario, { strategyId, enable1_5Opt: true, costMatrix }));
      const insert = db.prepare(`INSERT INTO plans (id, scenario_id, scenario_version, strategy_id, plan_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`);
      db.transaction(() => {
        for (const plan of plans) insert.run(plan.id, scenario.id, scenario.version, plan.strategyId, JSON.stringify(plan), plan.generatedAt);
      })();
      return { plans };
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // 5. Listar Planos Salvos de um Cenário
  fastify.get<{ Params: { id: string } }>('/api/scenarios/:id/plans', async (request: FastifyRequest<{ Params: { id: string } }>) => {
    const { id } = request.params;
    const rows = db.prepare('SELECT id, scenario_id, scenario_version, strategy_id, created_at FROM plans WHERE scenario_id = ? ORDER BY created_at DESC').all(id);
    return rows;
  });

  // 6. Obter Plano Específico
  fastify.get<{ Params: { planId: string } }>('/api/plans/:planId', async (request: FastifyRequest<{ Params: { planId: string } }>, reply: FastifyReply) => {
    const { planId } = request.params;
    const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
    if (!row) {
      return reply.status(404).send({ error: 'Plano não encontrado.' });
    }
    return JSON.parse((row as any).plan_json);
  });

  // 7. Registrar Resultados Reais e Replanejar
  fastify.post<{ Params: { id: string }; Body: { results: VisitResult[]; currentDate: string; scenarioVersion?: number; options?: Omit<PlanOptions, 'costMatrix'> } }>(
    '/api/scenarios/:id/results',
    async (request: FastifyRequest<{ Params: { id: string }; Body: { results: VisitResult[]; currentDate: string; scenarioVersion?: number; options?: Omit<PlanOptions, 'costMatrix'> } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { results, currentDate, scenarioVersion, options } = request.body;

      const row = scenarioVersion === undefined
        ? db.prepare('SELECT * FROM scenarios WHERE id = ? ORDER BY version DESC LIMIT 1').get(id)
        : db.prepare('SELECT * FROM scenarios WHERE id = ? AND version = ?').get(id, scenarioVersion);
      if (!row) {
        return reply.status(404).send({ error: 'Cenário não encontrado.' });
      }

      const currentScenario: Scenario = JSON.parse((row as any).data_json);

      // Aplicar resultados via Core
      const newState = applyVisitResults(
        { scenario: currentScenario, history: [], currentDate },
        results
      );
      const latest = db.prepare('SELECT MAX(version) AS version FROM scenarios WHERE id = ?').get(id) as { version: number };
      newState.scenario.version = latest.version + 1;

      let costMatrix;
      try {
        costMatrix = await buildWalkingCostMatrix(newState.scenario);
      } catch (error) {
        return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
      }
      let newPlan: Plan;
      try {
        newPlan = planScenario(newState.scenario, { ...(options || { strategyId: 'main-heuristic' }), costMatrix });
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
      }
      const newVersion = newState.scenario.version;
      const createdAt = new Date().toISOString();
      db.transaction(() => {
        db.prepare(`INSERT INTO scenarios (id, version, name, data_json, created_at) VALUES (?, ?, ?, ?, ?)`)
          .run(id, newVersion, currentScenario.healthCenter.name, JSON.stringify(newState.scenario), createdAt);
        const insertResult = db.prepare(`INSERT INTO visit_results
          (id, scenario_id, patient_id, condition_id, visit_date, status, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        for (const result of results) {
          insertResult.run(randomUUID(), id, result.patientId, result.conditionId, result.date,
            result.status, result.reason || null, createdAt);
        }
        db.prepare(`INSERT INTO plans (id, scenario_id, scenario_version, strategy_id, plan_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`)
          .run(newPlan.id, id, newVersion, newPlan.strategyId, JSON.stringify(newPlan), createdAt);
      })();

      return {
        message: 'Resultados registrados e replanejamento gerado com sucesso.',
        scenarioVersion: newVersion,
        plan: newPlan
      };
    }
  );

  // 8. Exportar Rota em CSV
  fastify.get<{ Querystring: { scenarioId: string; planId: string; date: string; teamId: string } }>(
    '/api/export/csv',
    async (request: FastifyRequest<{ Querystring: { scenarioId: string; planId: string; date: string; teamId: string } }>, reply: FastifyReply) => {
      const { scenarioId, planId, date, teamId } = request.query;

      const planRow = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
      if (!planRow) return reply.status(404).send({ error: 'Plano não encontrado.' });

      const plan: Plan = JSON.parse((planRow as any).plan_json);

      const scenRow = db.prepare('SELECT * FROM scenarios WHERE id = ? AND version = ?').get(scenarioId, plan.scenarioVersion);
      if (!scenRow) return reply.status(404).send({ error: 'Cenário correspondente não encontrado.' });

      const scenario: Scenario = JSON.parse((scenRow as any).data_json);
      const route = plan.routes.find((r: DailyTeamRoute) => r.date === date && r.teamId === teamId);

      if (!route) return reply.status(404).send({ error: 'Rota não encontrada para a data e equipe informadas.' });

      const csvContent = generateRouteCsv(scenario, route);

      reply.header('Content-Type', 'text/csv; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="rota_${teamId}_${date}.csv"`);
      return reply.send(csvContent);
    }
  );

  // 9. Exportar Rota em GPX
  fastify.get<{ Querystring: { scenarioId: string; planId: string; date: string; teamId: string } }>(
    '/api/export/gpx',
    async (request: FastifyRequest<{ Querystring: { scenarioId: string; planId: string; date: string; teamId: string } }>, reply: FastifyReply) => {
      const { scenarioId, planId, date, teamId } = request.query;

      const planRow = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
      if (!planRow) return reply.status(404).send({ error: 'Plano não encontrado.' });

      const plan: Plan = JSON.parse((planRow as any).plan_json);

      const scenRow = db.prepare('SELECT * FROM scenarios WHERE id = ? AND version = ?').get(scenarioId, plan.scenarioVersion);
      if (!scenRow) return reply.status(404).send({ error: 'Cenário correspondente não encontrado.' });

      const scenario: Scenario = JSON.parse((scenRow as any).data_json);
      const route = plan.routes.find((r: DailyTeamRoute) => r.date === date && r.teamId === teamId);

      if (!route) return reply.status(404).send({ error: 'Rota não encontrada para a data e equipe informadas.' });

      const gpxContent = generateRouteGpx(scenario, route);

      reply.header('Content-Type', 'application/gpx+xml; charset=utf-8');
      reply.header('Content-Disposition', `attachment; filename="rota_${teamId}_${date}.gpx"`);
      return reply.send(gpxContent);
    }
  );
}
