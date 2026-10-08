import test from 'node:test';
import assert from 'node:assert/strict';
import { planScenario, verifyPlan } from '../dist/index.js';

test('troca mensal atende maior prioridade antes e reduz caminhada sem perder cobertura', () => {
  const scenario = {
    id: 'troca_mensal', version: 1,
    healthCenter: { id: 'posto', name: 'Posto', location: { lat: -30, lng: -51 } },
    polygons: [{ id: 'area', name: 'Área', vertices: [
      { lat: -30.1, lng: -51.1 }, { lat: -30.1, lng: -50.9 },
      { lat: -29.9, lng: -50.9 }, { lat: -29.9, lng: -51.1 }
    ] }],
    patients: [
      { id: 'b', code: 'B', location: { lat: -30, lng: -51.001 }, defaultVisitDurationMinutes: 20,
        conditions: [{ conditionId: 'c', initialDueDate: '2026-10-08', maxIntervalDays: 30, priorityWeight: 1 }] },
      { id: 'a', code: 'A', location: { lat: -30, lng: -51.002 }, defaultVisitDurationMinutes: 20,
        conditions: [{ conditionId: 'c', initialDueDate: '2026-10-08', maxIntervalDays: 30, priorityWeight: 2 }] },
      { id: 'c', code: 'C', location: { lat: -30, lng: -51.004 }, defaultVisitDurationMinutes: 20,
        conditions: [{ conditionId: 'c', initialDueDate: '2026-10-08', maxIntervalDays: 30, priorityWeight: 5 }] }
    ],
    teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 50, availableDays: [] }],
    startDate: '2026-10-08', planningHorizonDays: 2, maxAnticipationDays: 0
  };
  const positions = [0, 1, 2, 4];
  const matrix = positions.map(from => positions.map(to => Math.abs(from - to)));
  const costMatrix = { nodeIds: ['posto', 'b', 'a', 'c'], distanceMatrix: matrix,
    timeMatrix: matrix.map(row => row.map(value => value)) };
  const nearest = planScenario(scenario, { strategyId: 'nearest-baseline', costMatrix });
  const improved = planScenario(scenario, { strategyId: 'main-heuristic', costMatrix });

  assert.equal(verifyPlan(scenario, improved).isValid, true);
  assert.equal(improved.metrics.coveragePercentage, nearest.metrics.coveragePercentage);
  assert.ok(improved.metrics.totalTravelDistanceKm < nearest.metrics.totalTravelDistanceKm);
  assert.ok(improved.metrics.priorityWeightedPromptCoveragePercentage > nearest.metrics.priorityWeightedPromptCoveragePercentage);
  assert.ok(improved.metrics.priorityWeightedActionableDelayDays < nearest.metrics.priorityWeightedActionableDelayDays);
  assert.deepEqual(new Set(improved.routes.flatMap(route => route.visits.map(visit => visit.patientId))), new Set(['a', 'b', 'c']));
  const longScenarioIdPlan = planScenario({ ...scenario, id: 'regiao_'.repeat(30) },
    { strategyId: 'nearest-baseline', costMatrix });
  assert.ok(longScenarioIdPlan.id.length < 100, 'o ID do plano deve caber na rota HTTP');
});

test('antecipa visita pendente para um dia livre e aumenta cobertura', () => {
  const scenario = {
    id: 'antecipacao_pendente', version: 1,
    healthCenter: { id: 'posto', name: 'Posto', location: { lat: -30, lng: -51 } },
    polygons: [{ id: 'area', name: 'Área', vertices: [
      { lat: -30.01, lng: -51.01 }, { lat: -30.01, lng: -50.99 },
      { lat: -29.99, lng: -50.99 }, { lat: -29.99, lng: -51.01 }
    ] }],
    patients: ['a', 'b'].map((id, index) => ({
      id, code: id, location: { lat: -30, lng: -51.001 - index * 0.001 },
      defaultVisitDurationMinutes: 30,
      conditions: [{ conditionId: 'c', initialDueDate: '2026-10-12',
        maxIntervalDays: 60, priorityWeight: 3 }]
    })),
    teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 35, availableDays: [] }],
    startDate: '2026-10-08', planningHorizonDays: 3, maxAnticipationDays: 4
  };
  const matrix = [[0, 1, 2], [1, 0, 1], [2, 1, 0]];
  const costMatrix = { nodeIds: ['posto', 'a', 'b'], distanceMatrix: matrix, timeMatrix: matrix };
  const nearest = planScenario(scenario, { strategyId: 'nearest-baseline', costMatrix });
  const improved = planScenario(scenario, { strategyId: 'main-heuristic', costMatrix });
  assert.equal(nearest.unallocatedVisits.length, 1);
  assert.equal(improved.unallocatedVisits.length, 0);
  assert.equal(improved.metrics.coveragePercentage, 100);
  assert.equal(verifyPlan(scenario, improved).isValid, true);
  assert.ok(improved.routes.some(route => route.date < '2026-10-12' && route.visits.length));
});

test('substitui visita menos prioritária quando a jornada está cheia sem aumentar percurso', () => {
  const scenario = {
    id: 'troca_pendente', version: 1,
    healthCenter: { id: 'posto', name: 'Posto', location: { lat: -30, lng: -51 } },
    polygons: [{ id: 'area', name: 'Área', vertices: [
      { lat: -30.01, lng: -51.01 }, { lat: -30.01, lng: -50.99 },
      { lat: -29.99, lng: -50.99 }, { lat: -29.99, lng: -51.01 }
    ] }],
    patients: [
      { id: 'baixa', code: 'B', location: { lat: -30, lng: -51.001 }, defaultVisitDurationMinutes: 30,
        conditions: [{ conditionId: 'c', initialDueDate: '2026-10-08', maxIntervalDays: 60, priorityWeight: 1 }] },
      { id: 'alta', code: 'A', location: { lat: -30, lng: -51.002 }, defaultVisitDurationMinutes: 30,
        conditions: [{ conditionId: 'c', initialDueDate: '2026-10-08', maxIntervalDays: 60, priorityWeight: 5 }] }
    ],
    teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 35, availableDays: [] }],
    startDate: '2026-10-08', planningHorizonDays: 1, maxAnticipationDays: 0
  };
  const matrix = [[0, 1, 2], [4, 0, 1], [2, 1, 0]];
  const costMatrix = { nodeIds: ['posto', 'baixa', 'alta'], distanceMatrix: matrix, timeMatrix: matrix };
  const nearest = planScenario(scenario, { strategyId: 'nearest-baseline', costMatrix });
  const improved = planScenario(scenario, { strategyId: 'main-heuristic', costMatrix });
  assert.equal(nearest.routes[0].visits[0].patientId, 'baixa');
  assert.equal(improved.routes[0].visits[0].patientId, 'alta');
  assert.equal(improved.unallocatedVisits.length, 1);
  assert.equal(improved.metrics.coveragePercentage, nearest.metrics.coveragePercentage);
  assert.ok(improved.metrics.priorityWeightedCoveragePercentage > nearest.metrics.priorityWeightedCoveragePercentage);
  assert.ok(improved.metrics.totalTravelDistanceKm <= nearest.metrics.totalTravelDistanceKm);
  assert.equal(verifyPlan(scenario, improved).isValid, true);
});
