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
    startDate: '2026-10-08', planningHorizonDays: 2, maxAnticipationDays: 0,
    costParameters: { travelSpeedKmh: 5 }
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
