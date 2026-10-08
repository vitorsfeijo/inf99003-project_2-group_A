import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sampleTerritoryPatients, planScenario, verifyPlan, countWorkingDaysInNextMonth } from '../dist/index.js';

const base = JSON.parse(fs.readFileSync(new URL('../../../../experimentos/cenarios/geosaude_cf_santa_marta_20261042_30.json', import.meta.url)));

test('amostra GeoSaúde é reproduzível, fica no território e gera plano válido', () => {
  const first = sampleTerritoryPatients(base, 30, 42);
  const again = sampleTerritoryPatients(base, 30, 42);
  assert.deepEqual(first, again);
  assert.equal(first.polygons[0].vertices.length, base.polygons[0].vertices.length);
  const plan = planScenario(first, { strategyId: 'main-heuristic' });
  assert.equal(verifyPlan(first, plan).isValid, true);
  assert.equal(first.patients.length, 30);
});

test('matriz viária fornecida é usada no custo do cronograma', () => {
  const scenario = sampleTerritoryPatients(base, 1, 7);
  const nodes = [scenario.healthCenter.id, scenario.patients[0].id];
  const plan = planScenario(scenario, { strategyId: 'main-heuristic', costMatrix: {
    nodeIds: nodes,
    distanceMatrix: [[0, 3], [3, 0]],
    timeMatrix: [[0, 45], [45, 0]]
  } });
  assert.equal(plan.metrics.totalTravelDistanceKm, 6);
  assert.equal(verifyPlan(scenario, plan).isValid, true);
  assert.throws(() => planScenario(scenario, { strategyId: 'main-heuristic', costMatrix: {
    nodeIds: nodes.slice().reverse(), distanceMatrix: [[0, 3], [3, 0]], timeMatrix: [[0, 45], [45, 0]]
  } }), /Matriz viária incompatível/);
});

test('recortes internos não recebem pacientes sintéticos', () => {
  const polygon = {
    id: 'real', name: 'Área com recorte',
    vertices: [{ lat: -30.1, lng: -51.1 }, { lat: -30.1, lng: -50.9 }, { lat: -29.9, lng: -50.9 }, { lat: -29.9, lng: -51.1 }],
    holes: [[{ lat: -30.02, lng: -51.02 }, { lat: -30.02, lng: -50.98 }, { lat: -29.98, lng: -50.98 }, { lat: -29.98, lng: -51.02 }]]
  };
  const sample = sampleTerritoryPatients({ ...base, polygons: [polygon] }, 500, 123);
  assert.equal(sample.patients.length, 500);
  assert.equal(sample.patients.some(patient => patient.location.lat > -30.02 && patient.location.lat < -29.98 &&
    patient.location.lng > -51.02 && patient.location.lng < -50.98), false);
});

test('um mês iniciado em outubro de 2026 tem 22 dias úteis e permite plano mensal', () => {
  assert.equal(countWorkingDaysInNextMonth('2026-10-01'), 22);
  const scenario = sampleTerritoryPatients(base, 40, 20261008);
  scenario.planningHorizonDays = countWorkingDaysInNextMonth(scenario.startDate);
  const plan = planScenario(scenario, { strategyId: 'main-heuristic' });
  assert.equal(plan.routes.length, 22);
  assert.equal(verifyPlan(scenario, plan).isValid, true);
});
