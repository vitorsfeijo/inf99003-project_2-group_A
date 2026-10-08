import test from 'node:test';
import assert from 'node:assert/strict';
import { planScenario, verifyPlan } from '../dist/index.js';

function scenario(dailyWorkMinutes) {
  return {
    id: 'metrics_backlog', version: 1,
    healthCenter: { id: 'ub', name: 'UBS', location: { lat: -30, lng: -51 } },
    polygons: [{ id: 'territorio', name: 'Território', vertices: [
      { lat: -30.1, lng: -51.1 }, { lat: -30.1, lng: -50.9 },
      { lat: -29.9, lng: -50.9 }, { lat: -29.9, lng: -51.1 }
    ] }],
    patients: [
      { id: 'urgent', code: 'U', location: { lat: -30, lng: -51 }, defaultVisitDurationMinutes: 30,
        conditions: [{ conditionId: 'c', initialDueDate: '2026-10-01', maxIntervalDays: 14, priorityWeight: 5 }] },
      { id: 'routine', code: 'R', location: { lat: -30, lng: -51 }, defaultVisitDurationMinutes: 30,
        conditions: [{ conditionId: 'c', initialDueDate: '2026-10-01', maxIntervalDays: 14, priorityWeight: 1 }] }
    ],
    teams: [{ id: 'team', name: 'Equipe', dailyWorkMinutes, availableDays: [] }],
    startDate: '2026-10-08', planningHorizonDays: 5, maxAnticipationDays: 2,
    costParameters: { travelSpeedKmh: 20 }
  };
}

test('a demanda já vencida atendida no primeiro dia conta como resposta pronta', () => {
  const input = scenario(60);
  const plan = planScenario(input, { strategyId: 'main-heuristic' });
  assert.equal(verifyPlan(input, plan).isValid, true);
  assert.equal(plan.metrics.coveragePercentage, 100);
  assert.equal(plan.metrics.priorityWeightedOnTimeCoveragePercentage, 0);
  assert.equal(plan.metrics.priorityWeightedPromptCoveragePercentage, 100);
  assert.equal(plan.metrics.priorityWeightedActionableDelayDays, 0);
  assert.equal(plan.metrics.totalOverdueDays, 14);
});

test('pendência entra no denominador e acumula atraso até o fim da janela', () => {
  const input = scenario(30);
  input.teams[0].availableDays = ['2026-10-08'];
  const plan = planScenario(input, { strategyId: 'main-heuristic' });
  assert.equal(verifyPlan(input, plan).isValid, true);
  assert.equal(plan.metrics.coveragePercentage, 50);
  assert.equal(plan.metrics.priorityWeightedCoveragePercentage, 83.33);
  assert.equal(plan.metrics.priorityWeightedPromptCoveragePercentage, 83.33);
  assert.equal(plan.metrics.priorityWeightedActionableDelayDays, 1);
  assert.equal(plan.metrics.totalOverdueDays, 20);
  assert.deepEqual(plan.metrics.delayBuckets, {
    onTime: 0, oneToTwoDays: 0, threeToSevenDays: 1,
    overSevenDays: 0, unallocated: 1
  });
});
