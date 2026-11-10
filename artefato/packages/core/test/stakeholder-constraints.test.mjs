import test from 'node:test';
import assert from 'node:assert/strict';
import { applyVisitResults, planScenario, verifyPlan } from '../dist/index.js';

const STRATEGIES = ['main-heuristic', 'nearest-baseline', 'urgency-baseline'];

// Pacientes em linha a partir do posto; o custo entre dois nós é a diferença de posição.
function lineScenario(patients, overrides = {}) {
  return {
    id: 'restricoes', version: 1,
    healthCenter: { id: 'posto', name: 'Posto', location: { lat: -30, lng: -51 } },
    polygons: [{ id: 'area', name: 'Área', vertices: [
      { lat: -30.1, lng: -51.1 }, { lat: -30.1, lng: -50.9 },
      { lat: -29.9, lng: -50.9 }, { lat: -29.9, lng: -51.1 }
    ] }],
    patients: patients.map((patient, index) => ({
      code: patient.id.toUpperCase(), location: { lat: -30, lng: -51.001 - index * 0.001 },
      defaultVisitDurationMinutes: 30,
      conditions: [{ conditionId: 'c', initialDueDate: patient.due ?? '2026-10-08', maxIntervalDays: 30,
        priorityWeight: patient.weight ?? 3 }],
      ...patient.extra, id: patient.id
    })),
    teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 70, availableDays: [] }],
    startDate: '2026-10-08', planningHorizonDays: 3, maxAnticipationDays: 0,
    ...overrides
  };
}

function lineMatrix(scenario) {
  const ids = ['posto', ...scenario.patients.map(patient => patient.id)];
  const matrix = ids.map((_, from) => ids.map((__, to) => Math.abs(from - to)));
  return { nodeIds: ids, distanceMatrix: matrix, timeMatrix: matrix.map(row => [...row]) };
}

const dayOf = (plan, patientId) => plan.routes.find(route => route.visits.some(visit => visit.patientId === patientId))?.date;
const teamOf = (plan, patientId) => plan.routes.find(route => route.visits.some(visit => visit.patientId === patientId))?.teamId;

test('âncora entra na rota do dia mesmo sem prazo vencido e desloca a visita menos prioritária', () => {
  // Jornada de 70 min comporta duas visitas de 30 min; três já vencidas disputam o primeiro dia.
  const scenario = lineScenario([
    { id: 'a', weight: 5 }, { id: 'b', weight: 4 }, { id: 'c', weight: 1 },
    { id: 'ancora', due: '2026-12-01', weight: 1, extra: { hardDeadline: '2026-10-08' } }
  ]);
  for (const strategyId of STRATEGIES) {
    const plan = planScenario(scenario, { strategyId, costMatrix: lineMatrix(scenario) });
    assert.equal(dayOf(plan, 'ancora'), '2026-10-08', strategyId);
    assert.equal(plan.metrics.mandatoryVisitCount, 1);
    assert.equal(plan.metrics.mandatoryVisitsMetCount, 1);
    assert.ok(plan.routes.flatMap(route => route.visits).find(visit => visit.patientId === 'ancora').mandatory);
    assert.equal(verifyPlan(scenario, plan).isValid, true);
  }
});

test('prazo máximo de três dias é cumprido e não muda planos sem prazo rígido', () => {
  const base = lineScenario([{ id: 'a' }, { id: 'b' }, { id: 'x', due: '2026-12-01' }]);
  const withDeadline = { ...base, patients: base.patients.map(patient => patient.id === 'x'
    ? { ...patient, hardDeadline: '2026-10-12' } : patient) };
  const plain = planScenario(base, { strategyId: 'main-heuristic', costMatrix: lineMatrix(base) });
  assert.equal(dayOf(plain, 'x'), undefined, 'sem prazo rígido, a visita futura fica fora da janela');
  assert.equal(plain.metrics.mandatoryVisitCount, undefined);
  assert.equal(plain.warnings, undefined);
  for (const strategyId of STRATEGIES) {
    const plan = planScenario(withDeadline, { strategyId, costMatrix: lineMatrix(withDeadline) });
    assert.ok(dayOf(plan, 'x') <= '2026-10-12', strategyId);
  }
});

test('categoria exigida só é atendida por equipe que a reúne; combinação ausente vira pendência explicada', () => {
  const scenario = lineScenario([
    { id: 'dente', extra: { requiredProfessions: ['odontologia'] } },
    { id: 'geral' },
    { id: 'duplo', extra: { requiredProfessions: ['odontologia', 'enfermagem'] } }
  ], {
    teams: [
      { id: 'acs', name: 'ACS', professions: ['acs'], dailyWorkMinutes: 200, availableDays: [] },
      { id: 'bucal', name: 'Saúde bucal', professions: ['odontologia', 'acs'], dailyWorkMinutes: 200, availableDays: [] }
    ]
  });
  for (const strategyId of STRATEGIES) {
    const plan = planScenario(scenario, { strategyId, costMatrix: lineMatrix(scenario) });
    assert.equal(teamOf(plan, 'dente'), 'bucal', strategyId);
    assert.ok(dayOf(plan, 'geral'), strategyId);
    assert.equal(dayOf(plan, 'duplo'), undefined, strategyId);
    assert.ok(plan.unallocatedVisits.some(item => item.patientId === 'duplo'));
  }
  // A verificação formal recusa uma rota com equipe incompatível.
  const plan = planScenario(scenario, { strategyId: 'nearest-baseline', costMatrix: lineMatrix(scenario) });
  const tampered = { ...plan, routes: plan.routes.map(route => ({ ...route, teamId: 'acs' })) };
  assert.equal(verifyPlan(scenario, tampered).isValid, false);
});

test('paciente que exige dois profissionais só vai para equipe com pessoas suficientes', () => {
  // A dupla tem 2 ACS (contagem por categoria); a equipe solo tem um enfermeiro.
  const scenario = lineScenario([
    { id: 'acamado', extra: { requiredStaffCount: 2 } },
    { id: 'geral' },
    { id: 'tres', extra: { requiredStaffCount: 3 } }
  ], {
    teams: [
      { id: 'solo', name: 'Solo', professions: ['enfermagem'], dailyWorkMinutes: 200, availableDays: [] },
      { id: 'dupla', name: 'Dupla', professions: ['acs'], professionCounts: { acs: 2 }, dailyWorkMinutes: 200, availableDays: [] }
    ]
  });
  for (const strategyId of STRATEGIES) {
    const plan = planScenario(scenario, { strategyId, costMatrix: lineMatrix(scenario) });
    assert.equal(teamOf(plan, 'acamado'), 'dupla', strategyId);
    assert.ok(dayOf(plan, 'geral'), strategyId);
    assert.equal(dayOf(plan, 'tres'), undefined, strategyId);
    assert.match(plan.unallocatedVisits.find(item => item.patientId === 'tres').reason, /número de profissionais/, strategyId);
    assert.equal(verifyPlan(scenario, plan).isValid, true, strategyId);
  }
  const plan = planScenario(scenario, { strategyId: 'main-heuristic', costMatrix: lineMatrix(scenario) });
  const tampered = { ...plan, routes: plan.routes.map(route => ({ ...route, teamId: 'solo' })) };
  const check = verifyPlan(scenario, tampered);
  assert.equal(check.isValid, false);
  assert.ok(check.errors.some(error => /exige 2/.test(error)));
});

test('prazo rígido sem equipe compatível não bloqueia o plano e gera aviso', () => {
  const scenario = lineScenario([
    { id: 'a' },
    { id: 'dente', extra: { requiredProfessions: ['odontologia'], hardDeadline: '2026-10-08' } }
  ]);
  const plan = planScenario(scenario, { strategyId: 'main-heuristic', costMatrix: lineMatrix(scenario) });
  const pending = plan.unallocatedVisits.find(item => item.patientId === 'dente');
  assert.equal(pending.mandatory, true);
  assert.match(pending.reason, /sem equipe compatível/);
  assert.equal(plan.warnings.length, 1);
  assert.equal(plan.metrics.mandatoryVisitsMetCount, 0);
});

test('vínculo com equipe, transferência e inclusão manual no território', () => {
  const scenario = lineScenario([
    { id: 'vinculado', extra: { assignedTeamId: 'segunda' } },
    { id: 'transferido', extra: { transfer: { toRegionId: 'geosaude_outra', toHealthCenterName: 'US Outra', date: '2026-10-07' } } },
    { id: 'fora', extra: { location: { lat: -31, lng: -52 }, territoryOverride: 'include' } }
  ], {
    teams: [
      { id: 'primeira', name: 'Primeira', dailyWorkMinutes: 200, availableDays: [] },
      { id: 'segunda', name: 'Segunda', dailyWorkMinutes: 200, availableDays: [] }
    ]
  });
  // A matriz cobre apenas os pacientes elegíveis (o transferido sai da otimização).
  const eligible = { ...scenario, patients: scenario.patients.filter(patient => patient.id !== 'transferido') };
  for (const strategyId of STRATEGIES) {
    const plan = planScenario(scenario, { strategyId, costMatrix: lineMatrix(eligible) });
    assert.equal(teamOf(plan, 'vinculado'), 'segunda', strategyId);
    assert.equal(dayOf(plan, 'transferido'), undefined, strategyId);
    assert.ok(dayOf(plan, 'fora'), strategyId);
  }
});

test('folga entre visitas reduz a capacidade e o horário de término exclui a folga', () => {
  const scenario = lineScenario([{ id: 'a' }, { id: 'b' }], { planningHorizonDays: 1, visitBufferMinutes: 10 });
  const plan = planScenario(scenario, { strategyId: 'nearest-baseline', costMatrix: lineMatrix(scenario) });
  // 1 + 30 + 10 + 1 + 30 + 10 + 2 = 84 min > 70: só uma visita cabe com folga.
  assert.equal(plan.routes[0].visits.length, 1);
  const [visit] = plan.routes[0].visits;
  assert.equal(visit.bufferMinutes, 10);
  assert.equal(visit.estimatedStartTime, '08:01');
  assert.equal(visit.estimatedEndTime, '08:31');
  assert.equal(plan.routes[0].totalWorkTimeMinutes, 42);
});

test('margem de segurança antecipa visitas que venceriam no fim da janela', () => {
  const scenario = lineScenario([{ id: 'a', due: '2026-10-12' }], { planningHorizonDays: 3, maxAnticipationDays: 0 });
  const plain = planScenario(scenario, { strategyId: 'nearest-baseline', costMatrix: lineMatrix(scenario) });
  assert.equal(dayOf(plain, 'a'), '2026-10-12');
  const safe = { ...scenario, deadlineSafetyMarginDays: 4 };
  const plan = planScenario(safe, { strategyId: 'nearest-baseline', costMatrix: lineMatrix(safe) });
  assert.equal(dayOf(plan, 'a'), '2026-10-08');
  assert.equal(plan.metrics.onTimeCoveragePercentage, 100, 'o cumprimento segue o prazo real');
});

test('visita concluída cumpre o prazo rígido; não realizada o mantém para o dia útil seguinte', () => {
  const scenario = lineScenario([{ id: 'a', extra: { hardDeadline: '2026-10-08' } }, { id: 'b', extra: { hardDeadline: '2026-10-08' } }]);
  const state = applyVisitResults({ scenario, history: [], currentDate: '2026-10-08' }, [
    { patientId: 'a', conditionId: 'c', date: '2026-10-08', status: 'completed' },
    { patientId: 'b', conditionId: 'c', date: '2026-10-08', status: 'missed' }
  ]);
  assert.equal(state.scenario.patients.find(patient => patient.id === 'a').hardDeadline, undefined);
  assert.equal(state.scenario.patients.find(patient => patient.id === 'b').hardDeadline, '2026-10-08');
  // No dia seguinte, o prazo vencido vale para o primeiro dia útil da nova janela.
  const nextDay = { ...state.scenario, startDate: '2026-10-09' };
  const plan = planScenario(nextDay, { strategyId: 'main-heuristic', costMatrix: lineMatrix(nextDay) });
  assert.equal(dayOf(plan, 'b'), '2026-10-09');
});
