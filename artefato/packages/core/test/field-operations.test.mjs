// Funcionalidades de uso em campo: duração/folga por paciente, retirar visita da rota,
// ausência programada e estatísticas de uso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyVisitResults, calculateUsageStatistics, isoWeekKey, markPatientUnavailable, planScenario, removeVisitFromPlan,
  verifyPlan } from '../dist/index.js';
import { STRATEGIES, dayOf, lineMatrix, lineScenario, pendingOf, visitsOf } from './helpers.mjs';

test('duração e folga só da próxima visita valem uma vez: somem ao concluir e ficam se a visita falhar', () => {
  const scenario = lineScenario([{ id: 'demorado', extra: { nextVisit: { durationMinutes: 50, bufferMinutes: 15 } } }],
    { teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 200, availableDays: [] }], visitBufferMinutes: 5 });
  for (const strategyId of STRATEGIES) {
    const visit = visitsOf(planScenario(scenario, { strategyId, costMatrix: lineMatrix(scenario) }))[0];
    assert.equal(visit.durationMinutes, 65, strategyId);
    assert.equal(visit.bufferMinutes, 15, strategyId);
    assert.equal(visit.estimatedEndTime, '08:51', strategyId); // 1 min de caminhada + 50 de atendimento
  }
  const state = { scenario, history: [], currentDate: '2026-10-08' };
  const done = applyVisitResults(state, [{ patientId: 'demorado', conditionId: 'c', date: '2026-10-08', status: 'completed' }]);
  assert.equal(done.scenario.patients[0].nextVisit, undefined);
  const missed = applyVisitResults(state, [{ patientId: 'demorado', conditionId: 'c', date: '2026-10-08', status: 'missed' }]);
  assert.deepEqual(missed.scenario.patients[0].nextVisit, { durationMinutes: 50, bufferMinutes: 15 });
});

test('folga própria do paciente substitui a folga geral, inclusive para zerá-la', () => {
  const scenario = lineScenario([
    { id: 'geral' }, { id: 'sem_folga', extra: { visitBufferMinutes: 0 } }, { id: 'folga_longa', extra: { visitBufferMinutes: 20 } }
  ], { teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 300, availableDays: [] }], visitBufferMinutes: 10 });
  const visits = visitsOf(planScenario(scenario, { strategyId: 'main-heuristic', costMatrix: lineMatrix(scenario) }));
  const buffer = id => visits.find(visit => visit.patientId === id).bufferMinutes ?? 0;
  assert.deepEqual([buffer('geral'), buffer('sem_folga'), buffer('folga_longa')], [10, 0, 20]);
});

test('retirar da rota, "só pular": os demais mantêm a ordem, os horários são refeitos e a visita volta para a fila', () => {
  const scenario = lineScenario([{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    { teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 200, availableDays: [] }] });
  const matrix = lineMatrix(scenario);
  const plan = planScenario(scenario, { strategyId: 'nearest-baseline', costMatrix: matrix });
  const route = plan.routes[0];
  assert.deepEqual(route.visits.map(visit => visit.patientId), ['a', 'b', 'c']);

  const updatedScenario = { ...markPatientUnavailable(scenario, 'b', { start: route.date, end: route.date, reason: 'Ligou avisando', kind: 'skip' }), version: 2 };
  const skipped = removeVisitFromPlan(updatedScenario, plan, { date: route.date, teamId: 'equipe', patientId: 'b', reason: 'Ligou avisando' }, matrix);
  const newRoute = skipped.routes[0];
  assert.deepEqual(newRoute.visits.map(visit => visit.patientId), ['a', 'c']);
  assert.equal(newRoute.visits[1].travelTimeMinutesFromPrevious, 2, 'a caminhada vai direto de a para c');
  assert.equal(newRoute.totalWorkTimeMinutes, 1 + 30 + 2 + 30 + 3);
  assert.equal(skipped.scenarioVersion, 2);
  assert.match(pendingOf(skipped, 'b').reason, /Retirado da rota de 2026-10-08: Ligou avisando/);
  assert.equal(verifyPlan(updatedScenario, skipped).isValid, true);
  // O plano antigo, agora com o paciente fora naquele dia, é recusado pelo verificador.
  assert.equal(verifyPlan(updatedScenario, plan).isValid, false);
  assert.throws(() => removeVisitFromPlan(updatedScenario, skipped, { date: route.date, teamId: 'equipe', patientId: 'b' }, matrix), /não está na rota/);
});

test('retirar da rota, "recalcular": o novo plano não usa aquele dia para o paciente', () => {
  const scenario = lineScenario([{ id: 'a' }, { id: 'b' }], { teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 200, availableDays: [] }] });
  const marked = markPatientUnavailable(scenario, 'a', { start: '2026-10-08', end: '2026-10-08', kind: 'skip' });
  for (const strategyId of STRATEGIES) {
    const plan = planScenario(marked, { strategyId, costMatrix: lineMatrix(marked) });
    assert.equal(dayOf(plan, 'a'), '2026-10-09', strategyId);
    assert.equal(dayOf(plan, 'b'), '2026-10-08', strategyId);
  }
  assert.throws(() => markPatientUnavailable(scenario, 'x', { start: '2026-10-08', end: '2026-10-08' }), /não encontrado/);
});

test('semana ISO usada nas estatísticas', () => {
  assert.equal(isoWeekKey('2026-01-01'), '2026-S01');
  assert.equal(isoWeekKey('2026-10-08'), '2026-S41');
  assert.equal(isoWeekKey('2026-12-31'), '2026-S53');
  assert.equal(isoWeekKey('2027-01-03'), '2026-S53');
});

test('estatísticas de uso: falhas por motivo, atendimentos por equipe e período, transferências e áreas', () => {
  const scenario = lineScenario([
    { id: 'a', extra: { hardDeadline: '2026-10-08' } },
    { id: 'b', extra: { visitBufferMinutes: 15, requiredStaffCount: 2 } },
    { id: 'c', extra: { unavailablePeriods: [{ start: '2026-10-20', end: '2026-10-30', reason: 'Férias' }] } },
    { id: 'fora', extra: { location: { lat: -31, lng: -52 }, territoryOverride: 'include', hardDeadline: '2026-10-15' } }
  ], { teams: [{ id: 'equipe', name: 'Equipe A', dailyWorkMinutes: 200, availableDays: [] }] });
  const stats = calculateUsageStatistics({
    scenario, period: 'week',
    visits: [
      { patientId: 'a', date: '2026-10-08', status: 'completed', teamId: 'equipe' },
      { patientId: 'b', date: '2026-10-08', status: 'missed', reason: ' paciente ausente ', teamId: 'equipe' },
      { patientId: 'b', date: '2026-10-09', status: 'completed', teamId: 'equipe' },
      { patientId: 'c', date: '2026-10-13', status: 'missed', reason: 'Paciente ausente', teamId: 'equipe' },
      { patientId: 'a', date: '2026-10-14', status: 'completed', teamId: 'equipe' },
      { patientId: 'c', date: '2026-10-15', status: 'missed', teamId: 'equipe' },
      { patientId: 'a', date: '2026-09-01', status: 'completed', teamId: 'equipe' }
    ],
    transfers: [{ date: '2026-10-09', direction: 'out' }, { date: '2026-10-10', direction: 'in' }, { date: '2026-10-11', direction: 'out' }],
    removals: [{ date: '2026-10-08', patientId: 'c', mode: 'skip' }],
    from: '2026-10-01', to: '2026-10-31'
  });
  assert.deepEqual(stats.visits, {
    attempted: 6, completed: 3, missed: 3, missedPercentage: 50,
    missedByReason: [{ reason: 'Paciente ausente', count: 2, percentage: 66.7 }, { reason: 'Sem motivo informado', count: 1, percentage: 33.3 }],
    removedFromRoute: 1
  });
  assert.equal(stats.teams.length, 1);
  assert.equal(stats.teams[0].teamName, 'Equipe A');
  assert.equal(stats.teams[0].completedVisits, 3);
  assert.equal(stats.teams[0].patientsServed, 2);
  assert.deepEqual(stats.teams[0].buckets, [
    { period: '2026-S41', completedVisits: 2, patientsServed: 2 },
    { period: '2026-S42', completedVisits: 1, patientsServed: 1 }
  ]);
  assert.deepEqual(stats.transfers, { out: 2, in: 1 });
  const area = stats.areas.find(item => item.areaId === 'area');
  assert.deepEqual({ ...area }, { areaId: 'area', areaName: 'Área', patients: 3, anchors: 1, hardDeadlines: 1, withBuffer: 1, withTimeout: 1, needsMultipleStaff: 1 });
  const outside = stats.areas.find(item => item.areaId === 'fora_do_contorno');
  assert.equal(outside.patients, 1);
  assert.equal(outside.hardDeadlines, 1);
  assert.equal(outside.anchors, 0);
  const monthly = calculateUsageStatistics({ scenario, period: 'month', visits: [{ patientId: 'a', date: '2026-10-08', status: 'completed', teamId: 'equipe' }], transfers: [], removals: [] });
  assert.equal(monthly.teams[0].buckets[0].period, '2026-10');
});
