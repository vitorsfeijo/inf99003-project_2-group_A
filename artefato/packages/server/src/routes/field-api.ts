import { FastifyInstance, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { Plan, Scenario, StatisticsPeriod, calculateUsageStatistics, markPatientUnavailable, planScenario,
  removeVisitFromPlan } from '@routing/core';
import { db, regionOfScenario } from '../db/database.js';
import { buildScenarioCostMatrix } from './routing-provider.js';
import { buildXlsx, XLSX_CONTENT_TYPE } from '../export/xlsx.js';
import { planWorkbook, routeWorkbook, statisticsWorkbook } from '../export/workbooks.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function loadScenario(id: string, version: number): Scenario | undefined {
  const row = db.prepare('SELECT data_json FROM scenarios WHERE id = ? AND version = ?').get(id, version) as { data_json: string } | undefined;
  return row ? JSON.parse(row.data_json) as Scenario : undefined;
}

function loadPlan(planId: string): Plan | undefined {
  const row = db.prepare('SELECT plan_json FROM plans WHERE id = ?').get(planId) as { plan_json: string } | undefined;
  return row ? JSON.parse(row.plan_json) as Plan : undefined;
}

function nextScenarioVersion(id: string): number {
  const row = db.prepare('SELECT MAX(version) AS version FROM scenarios WHERE id = ?').get(id) as { version: number | null };
  return (row.version ?? 0) + 1;
}

function sendXlsx(reply: FastifyReply, fileName: string, sheets: Parameters<typeof buildXlsx>[0]) {
  reply.header('Content-Type', XLSX_CONTENT_TYPE);
  reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
  return reply.send(buildXlsx(sheets));
}

/** Estatísticas de uso de uma unidade a partir do histórico gravado no banco. */
function statisticsFor(regionId: string, period: StatisticsPeriod, from?: string, to?: string) {
  const prefix = `${regionId}_amostra_%`;
  // Cadastro atual: o mais recente entre o rascunho em edição e a última versão gravada no banco.
  const draft = db.prepare('SELECT scenario_json, updated_at FROM scenario_drafts WHERE region_id = ?').get(regionId) as
    { scenario_json: string; updated_at: string } | undefined;
  const latest = db.prepare(`SELECT data_json, created_at FROM scenarios WHERE id = ? OR id LIKE ? ORDER BY created_at DESC LIMIT 1`)
    .get(regionId, prefix) as { data_json: string; created_at: string } | undefined;
  const useDraft = draft && (!latest || draft.updated_at >= latest.created_at);
  const scenario = useDraft ? JSON.parse(draft.scenario_json) as Scenario : latest ? JSON.parse(latest.data_json) as Scenario : undefined;
  const visits = (db.prepare(`SELECT patient_id, visit_date, status, reason, team_id FROM visit_results
    WHERE region_id = ? OR (region_id IS NULL AND (scenario_id = ? OR scenario_id LIKE ?))`).all(regionId, regionId, prefix) as
    { patient_id: string; visit_date: string; status: 'completed' | 'missed'; reason: string | null; team_id: string | null }[])
    .map(row => ({ patientId: row.patient_id, date: row.visit_date, status: row.status, reason: row.reason ?? undefined, teamId: row.team_id ?? undefined }));
  const transfers = [
    ...(db.prepare('SELECT created_at FROM patient_transfers WHERE from_region_id = ?').all(regionId) as { created_at: string }[])
      .map(row => ({ date: row.created_at.slice(0, 10), direction: 'out' as const })),
    ...(db.prepare('SELECT created_at FROM patient_transfers WHERE to_region_id = ?').all(regionId) as { created_at: string }[])
      .map(row => ({ date: row.created_at.slice(0, 10), direction: 'in' as const }))
  ];
  const removals = (db.prepare('SELECT patient_id, team_id, visit_date, mode, reason FROM route_removals WHERE region_id = ?').all(regionId) as
    { patient_id: string; team_id: string; visit_date: string; mode: 'skip' | 'replan'; reason: string | null }[])
    .map(row => ({ patientId: row.patient_id, teamId: row.team_id, date: row.visit_date, mode: row.mode, reason: row.reason ?? undefined }));
  return { scenario, stats: calculateUsageStatistics({ scenario, visits, transfers, removals, period, from, to }) };
}

export async function registerFieldRoutes(fastify: FastifyInstance) {
  // --- Edições em andamento guardadas no servidor ---
  fastify.put<{ Params: { regionId: string }; Body: { scenario: Scenario; strategyId?: string; selectedDate?: string } }>(
    '/api/drafts/:regionId', async (request, reply) => {
      const { scenario, strategyId, selectedDate } = request.body ?? {};
      if (!scenario?.id || !Array.isArray(scenario.patients)) return reply.status(400).send({ error: 'Rascunho inválido: envie o cenário completo.' });
      const updatedAt = new Date().toISOString();
      db.prepare(`INSERT INTO scenario_drafts (region_id, scenario_id, scenario_json, strategy_id, selected_date, updated_at)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(region_id) DO UPDATE SET scenario_id = excluded.scenario_id,
        scenario_json = excluded.scenario_json, strategy_id = excluded.strategy_id, selected_date = excluded.selected_date,
        updated_at = excluded.updated_at`).run(request.params.regionId, scenario.id, JSON.stringify(scenario),
        strategyId ?? null, selectedDate ?? null, updatedAt);
      return { savedAt: updatedAt };
    });

  // Último trabalho salvo (de qualquer unidade) e os planos já gerados para aquela versão do cenário.
  fastify.get('/api/drafts/latest', async (_request, reply) => {
    const row = db.prepare('SELECT * FROM scenario_drafts ORDER BY updated_at DESC LIMIT 1').get() as
      { region_id: string; scenario_json: string; strategy_id: string | null; selected_date: string | null; updated_at: string } | undefined;
    if (!row) return reply.status(404).send({ error: 'Nenhuma edição salva.' });
    const scenario = JSON.parse(row.scenario_json) as Scenario;
    const plans = (db.prepare(`SELECT plan_json FROM plans WHERE scenario_id = ? AND scenario_version = ? ORDER BY created_at DESC`)
      .all(scenario.id, scenario.version) as { plan_json: string }[]).map(item => JSON.parse(item.plan_json) as Plan);
    // Um plano por estratégia: o mais recente (a lista vem do mais novo para o mais antigo).
    const latestPerStrategy = plans.filter((plan, index) => plans.findIndex(other => other.strategyId === plan.strategyId) === index);
    return { regionId: row.region_id, scenario, strategyId: row.strategy_id ?? undefined, selectedDate: row.selected_date ?? undefined,
      updatedAt: row.updated_at, plans: latestPerStrategy };
  });

  fastify.delete<{ Params: { regionId: string } }>('/api/drafts/:regionId', async request => {
    const result = db.prepare('DELETE FROM scenario_drafts WHERE region_id = ?').run(request.params.regionId);
    return { removed: result.changes > 0 };
  });

  // --- Retirar uma visita de uma rota já planejada ---
  fastify.post<{ Params: { planId: string }; Body: { date: string; teamId: string; patientId: string; reason?: string;
    mode: 'skip' | 'replan' } }>('/api/plans/:planId/remove-visit', async (request, reply) => {
    const { date, teamId, patientId, reason, mode } = request.body ?? {} as never;
    if (!DATE.test(date ?? '') || !teamId || !patientId || !['skip', 'replan'].includes(mode)) {
      return reply.status(400).send({ error: 'Informe data, equipe, paciente e o modo (skip ou replan).' });
    }
    const plan = loadPlan(request.params.planId);
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado.' });
    const current = loadScenario(plan.scenarioId, plan.scenarioVersion);
    if (!current) return reply.status(404).send({ error: 'Cenário do plano não encontrado.' });
    const route = plan.routes.find(item => item.date === date && item.teamId === teamId);
    if (!route?.visits.some(visit => visit.patientId === patientId)) {
      return reply.status(404).send({ error: 'Esse paciente não está nessa rota.' });
    }

    // O paciente fica indisponível naquele dia: o replanejamento não o devolve à mesma data.
    const scenario: Scenario = {
      ...markPatientUnavailable(current, patientId, { start: date, end: date, kind: 'skip', ...(reason ? { reason } : {}) }),
      version: nextScenarioVersion(current.id)
    };
    let costMatrix;
    try {
      costMatrix = await buildScenarioCostMatrix(scenario);
    } catch (error) {
      return reply.status(502).send({ error: error instanceof Error ? error.message : String(error) });
    }
    let newPlan: Plan;
    try {
      newPlan = mode === 'skip'
        ? removeVisitFromPlan(scenario, plan, { date, teamId, patientId, reason }, costMatrix)
        : planScenario(scenario, { strategyId: plan.strategyId, enable1_5Opt: true, costMatrix });
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : String(error) });
    }
    const createdAt = new Date().toISOString();
    db.transaction(() => {
      db.prepare('INSERT INTO scenarios (id, version, name, data_json, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(scenario.id, scenario.version, scenario.healthCenter.name, JSON.stringify(scenario), createdAt);
      db.prepare('INSERT INTO plans (id, scenario_id, scenario_version, strategy_id, plan_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(newPlan.id, scenario.id, scenario.version, newPlan.strategyId, JSON.stringify(newPlan), createdAt);
      db.prepare(`INSERT INTO route_removals (id, scenario_id, region_id, plan_id, patient_id, team_id, visit_date, mode, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), scenario.id, regionOfScenario(scenario.id), plan.id, patientId,
        teamId, date, mode, reason ?? null, createdAt);
    })();
    return { scenario, plan: newPlan };
  });

  // --- Estatísticas de uso ---
  fastify.get<{ Querystring: { regionId?: string; period?: StatisticsPeriod; from?: string; to?: string } }>('/api/statistics', async (request, reply) => {
    const { regionId, period = 'month', from, to } = request.query;
    if (!regionId) return reply.status(400).send({ error: 'Informe a unidade (regionId).' });
    if (!['week', 'month', 'year'].includes(period)) return reply.status(400).send({ error: 'Período inválido: use week, month ou year.' });
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) return reply.status(400).send({ error: 'Datas devem estar no formato AAAA-MM-DD.' });
    return statisticsFor(regionId, period, from || undefined, to || undefined).stats;
  });

  fastify.get<{ Querystring: { regionId?: string; period?: StatisticsPeriod; from?: string; to?: string } }>('/api/export/statistics-xlsx', async (request, reply) => {
    const { regionId, period = 'month', from, to } = request.query;
    if (!regionId || !['week', 'month', 'year'].includes(period)) return reply.status(400).send({ error: 'Informe a unidade e um período válido.' });
    const { scenario, stats } = statisticsFor(regionId, period, from || undefined, to || undefined);
    return sendXlsx(reply, `estatisticas_${regionId}.xlsx`, statisticsWorkbook(scenario?.healthCenter.name ?? regionId, stats));
  });

  // --- Exportação para Excel ---
  fastify.get<{ Querystring: { planId: string; date: string; teamId: string } }>('/api/export/xlsx', async (request, reply) => {
    const { planId, date, teamId } = request.query;
    const plan = loadPlan(planId);
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado.' });
    const scenario = loadScenario(plan.scenarioId, plan.scenarioVersion);
    if (!scenario) return reply.status(404).send({ error: 'Cenário correspondente não encontrado.' });
    const route = plan.routes.find(item => item.date === date && item.teamId === teamId);
    if (!route) return reply.status(404).send({ error: 'Rota não encontrada para a data e equipe informadas.' });
    return sendXlsx(reply, `rota_${teamId}_${date}.xlsx`, routeWorkbook(scenario, route));
  });

  fastify.get<{ Querystring: { planId: string } }>('/api/export/plan-xlsx', async (request, reply) => {
    const plan = loadPlan(request.query.planId);
    if (!plan) return reply.status(404).send({ error: 'Plano não encontrado.' });
    const scenario = loadScenario(plan.scenarioId, plan.scenarioVersion);
    if (!scenario) return reply.status(404).send({ error: 'Cenário correspondente não encontrado.' });
    return sendXlsx(reply, `plano_${scenario.startDate}_${plan.strategyId}.xlsx`, planWorkbook(scenario, plan));
  });
}
