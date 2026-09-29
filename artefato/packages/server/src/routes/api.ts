import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/database.js';
import { planScenario, applyVisitResults, Scenario, Plan, VisitResult, PlanOptions, DailyTeamRoute } from '@routing/core';
import { generateRouteCsv } from '../export/csv.js';
import { generateRouteGpx } from '../export/gpx.js';

export async function registerApiRoutes(fastify: FastifyInstance) {

  // 1. Criar / Importar Cenário JSON
  fastify.post('/api/scenarios', async (request: FastifyRequest, reply: FastifyReply) => {
    const scenarioData = request.body as Scenario;
    if (!scenarioData || !scenarioData.id) {
      return reply.status(400).send({ error: 'Cenário inválido ou id ausente.' });
    }

    const version = scenarioData.version || 1;
    const name = scenarioData.healthCenter?.name || scenarioData.id;
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO scenarios (id, version, name, data_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(scenarioData.id, version, name, JSON.stringify(scenarioData), createdAt);

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
  fastify.post<{ Params: { id: string }; Body: PlanOptions }>('/api/scenarios/:id/plan', async (request: FastifyRequest<{ Params: { id: string }; Body: PlanOptions }>, reply: FastifyReply) => {
    const { id } = request.params;
    const options = request.body || { strategyId: 'main-heuristic' };

    const row = db.prepare('SELECT * FROM scenarios WHERE id = ? ORDER BY version DESC LIMIT 1').get(id);
    if (!row) {
      return reply.status(404).send({ error: 'Cenário não encontrado para planejamento.' });
    }

    const scenario: Scenario = JSON.parse((row as any).data_json);

    try {
      const plan = planScenario(scenario, options);
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
  fastify.post<{ Params: { id: string }; Body: { results: VisitResult[]; currentDate: string; options?: PlanOptions } }>(
    '/api/scenarios/:id/results',
    async (request: FastifyRequest<{ Params: { id: string }; Body: { results: VisitResult[]; currentDate: string; options?: PlanOptions } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { results, currentDate, options } = request.body;

      const row = db.prepare('SELECT * FROM scenarios WHERE id = ? ORDER BY version DESC LIMIT 1').get(id);
      if (!row) {
        return reply.status(404).send({ error: 'Cenário não encontrado.' });
      }

      const currentScenario: Scenario = JSON.parse((row as any).data_json);

      // Aplicar resultados via Core
      const newState = applyVisitResults(
        { scenario: currentScenario, history: [], currentDate },
        results
      );

      // Salvar nova versão do cenário
      const newVersion = newState.scenario.version;
      const createdAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO scenarios (id, version, name, data_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, newVersion, currentScenario.healthCenter.name, JSON.stringify(newState.scenario), createdAt);

      // Replanejar automaticamente com o novo estado
      const newPlan = planScenario(newState.scenario, options || { strategyId: 'main-heuristic' });

      db.prepare(`
        INSERT INTO plans (id, scenario_id, scenario_version, strategy_id, plan_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(newPlan.id, id, newVersion, newPlan.strategyId, JSON.stringify(newPlan), createdAt);

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
