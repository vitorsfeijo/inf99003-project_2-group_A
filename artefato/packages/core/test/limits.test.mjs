// Testes de limite: tentam forçar a falha do planejamento com as restrições atuais
// (prazo rígido, categorias e quantidades, número de profissionais, vínculo, ausências, folgas)
// e conferem que o plano nunca viola uma regra: ou cumpre, ou deixa pendente com o motivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkingDaysHorizon, planScenario, teamCanServe, verifyPlan, NO_COMPATIBLE_TEAM_REASON } from '../dist/index.js';
import { STRATEGIES, dayOf, lineMatrix, lineScenario, mulberry32, pendingOf, teamOf, visitsOf } from './helpers.mjs';

const plan = (scenario, strategyId, matrix = lineMatrix(scenario)) => planScenario(scenario, { strategyId, costMatrix: matrix });

test('mais âncoras do que cabem na jornada: entram as que cabem, as demais ficam pendentes com o motivo', () => {
  // Jornada de 70 min: duas visitas de 30 min cabem (1 + 30 + 1 + 30 + 2 = 64); a terceira não.
  const anchor = { hardDeadline: '2026-10-08' };
  const scenario = lineScenario(['a', 'b', 'c', 'd'].map(id => ({ id, due: '2026-12-01', extra: anchor })));
  for (const strategyId of STRATEGIES) {
    const result = plan(scenario, strategyId);
    const placed = visitsOf(result).filter(visit => visit.date === '2026-10-08');
    assert.equal(placed.length, 2, strategyId);
    const pending = result.unallocatedVisits.filter(item => item.mandatory);
    assert.equal(pending.length, 2, strategyId);
    for (const item of pending) assert.match(item.reason, /não cabe na jornada/, strategyId);
    assert.equal(visitsOf(result).every(visit => visit.date === '2026-10-08'), true, 'nenhuma âncora vai para depois do prazo');
    assert.equal(result.warnings.length, 2, strategyId);
    assert.equal(result.metrics.mandatoryVisitsMetCount, 2);
    assert.equal(verifyPlan(scenario, result).isValid, true, strategyId);
  }
});

test('âncora longe demais: ida, visita e volta passam da jornada mesmo com a rota vazia', () => {
  // Custo ×10: 10 de ida + 30 de visita + 10 de volta = 50 min > 40 min de jornada.
  const scenario = lineScenario([{ id: 'longe', extra: { hardDeadline: '2026-10-08' } }],
    { teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 40, availableDays: [] }] });
  for (const strategyId of STRATEGIES) {
    const result = plan(scenario, strategyId, lineMatrix(scenario, 10));
    assert.equal(dayOf(result, 'longe'), undefined, strategyId);
    assert.match(pendingOf(result, 'longe').reason, /não cabe na jornada/, strategyId);
    assert.equal(pendingOf(result, 'longe').mandatory, true);
  }
});

test('âncora num dia em que a única equipe não trabalha fica pendente e diz por quê', () => {
  const scenario = lineScenario([{ id: 'a', extra: { hardDeadline: '2026-10-08' } }],
    { teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 200, availableDays: ['2026-10-09', '2026-10-12'] }] });
  for (const strategyId of STRATEGIES) {
    const result = plan(scenario, strategyId);
    assert.equal(dayOf(result, 'a'), undefined, strategyId);
    assert.match(pendingOf(result, 'a').reason, /sem equipe disponível nesses dias/, strategyId);
  }
});

test('visita mais longa que a jornada inteira nunca entra e não derruba o plano', () => {
  const scenario = lineScenario([{ id: 'longa', extra: { defaultVisitDurationMinutes: 300 } }, { id: 'curta' }],
    { teams: [{ id: 'equipe', name: 'Equipe', dailyWorkMinutes: 240, availableDays: [] }] });
  for (const strategyId of STRATEGIES) {
    const result = plan(scenario, strategyId);
    assert.equal(dayOf(result, 'longa'), undefined, strategyId);
    assert.ok(pendingOf(result, 'longa'), strategyId);
    assert.ok(dayOf(result, 'curta'), strategyId);
    assert.equal(verifyPlan(scenario, result).isValid, true);
  }
});

test('cenário sem nenhuma equipe: tudo fica pendente, sem erro e com métricas finitas', () => {
  const scenario = lineScenario([{ id: 'a' }, { id: 'b', extra: { hardDeadline: '2026-10-08' } }], { teams: [] });
  for (const strategyId of STRATEGIES) {
    const result = plan(scenario, strategyId);
    assert.equal(visitsOf(result).length, 0, strategyId);
    assert.equal(pendingOf(result, 'a').reason, NO_COMPATIBLE_TEAM_REASON, strategyId);
    assert.equal(pendingOf(result, 'b').mandatory, true, strategyId);
    for (const [name, value] of Object.entries(result.metrics)) {
      if (typeof value === 'number') assert.ok(Number.isFinite(value), `${strategyId}: métrica ${name} = ${value}`);
    }
  }
});

test('quantidade por categoria: 2 técnicos de enfermagem não são atendidos por uma equipe com 1, mesmo com 4 pessoas', () => {
  const scenario = lineScenario([
    { id: 'curativo', extra: { requiredProfessionCounts: { tecnico_enfermagem: 2 } } },
    { id: 'tres', extra: { requiredProfessionCounts: { tecnico_enfermagem: 3 } } },
    { id: 'geral' }
  ], {
    teams: [
      { id: 'grande', name: 'Grande', professions: ['acs', 'tecnico_enfermagem'], professionCounts: { acs: 3 }, dailyWorkMinutes: 200, availableDays: [] },
      { id: 'dupla', name: 'Dupla', professions: ['tecnico_enfermagem'], professionCounts: { tecnico_enfermagem: 2 }, dailyWorkMinutes: 200, availableDays: [] }
    ]
  });
  for (const strategyId of STRATEGIES) {
    const result = plan(scenario, strategyId);
    assert.equal(teamOf(result, 'curativo'), 'dupla', strategyId);
    assert.equal(dayOf(result, 'tres'), undefined, strategyId);
    assert.equal(pendingOf(result, 'tres').reason, NO_COMPATIBLE_TEAM_REASON, strategyId);
    assert.equal(verifyPlan(scenario, result).isValid, true, strategyId);
  }
  const result = plan(scenario, 'nearest-baseline');
  const tampered = { ...result, routes: result.routes.map(route => ({ ...route, teamId: 'grande' })) };
  assert.ok(verifyPlan(scenario, tampered).errors.some(error => /exige 2 Técnico\(a\) de enfermagem e a equipe tem 1/.test(error)));
});

test('ausência programada por toda a janela: a pendência diz que o paciente está fora', () => {
  const scenario = lineScenario([{ id: 'ferias', extra: { unavailablePeriods: [{ start: '2026-10-01', end: '2026-10-30', reason: 'Férias' }] } }, { id: 'b' }]);
  for (const strategyId of STRATEGIES) {
    const result = plan(scenario, strategyId);
    assert.equal(dayOf(result, 'ferias'), undefined, strategyId);
    assert.match(pendingOf(result, 'ferias').reason, /indisponível durante toda a janela \(Férias\)/, strategyId);
    assert.ok(dayOf(result, 'b'), strategyId);
  }
});

test('ausência nos primeiros dias: a visita vai para o primeiro dia útil depois dela', () => {
  // Janela: 08/10 (qui), 09/10 (sex) e 12/10 (seg); o paciente viaja de 08 a 11/10.
  const scenario = lineScenario([{ id: 'viagem', extra: { unavailablePeriods: [{ start: '2026-10-08', end: '2026-10-11' }] } }]);
  for (const strategyId of STRATEGIES) {
    assert.equal(dayOf(plan(scenario, strategyId), 'viagem'), '2026-10-12', strategyId);
  }
});

test('âncora durante a ausência fica pendente, obrigatória e explicada', () => {
  const scenario = lineScenario([{ id: 'a', extra: { hardDeadline: '2026-10-08', unavailablePeriods: [{ start: '2026-10-08', end: '2026-10-12' }] } }]);
  for (const strategyId of STRATEGIES) {
    const pending = pendingOf(plan(scenario, strategyId), 'a');
    assert.equal(pending.mandatory, true, strategyId);
    assert.match(pending.reason, /indisponível em todos os dias/, strategyId);
  }
});

test('dados inválidos são recusados com a causa, nunca planejados em silêncio', () => {
  const cases = [
    [{ requiredStaffCount: 0 }, /número inválido de profissionais/],
    [{ requiredStaffCount: 1.5 }, /número inválido de profissionais/],
    [{ requiredProfessionCounts: { acs: 0 } }, /quantidade inválida de acs/],
    [{ unavailablePeriods: [{ start: '2026-10-12', end: '2026-10-08' }] }, /período de ausência inválido/],
    [{ unavailablePeriods: [{ start: 'amanhã', end: '2026-10-08' }] }, /período de ausência inválido/],
    [{ visitBufferMinutes: -5 }, /folga própria inválida/],
    [{ nextVisit: { durationMinutes: 0 } }, /duração da próxima visita inválida/],
    [{ assignedTeamId: 'inexistente' }, /equipe inexistente/]
  ];
  for (const [extra, message] of cases) {
    const scenario = lineScenario([{ id: 'a', extra }]);
    assert.throws(() => plan(scenario, 'main-heuristic'), message, JSON.stringify(extra));
  }
});

test('o verificador recusa planos adulterados', () => {
  const base = lineScenario([{ id: 'a' }, { id: 'b', due: '2026-10-09' }]);
  const result = plan(base, 'nearest-baseline');
  const routeA = result.routes.findIndex(route => route.visits.some(visit => visit.patientId === 'a'));
  const withRoute = (index, change) => ({ ...result, routes: result.routes.map((route, i) => i === index ? change(route) : route) });
  const errors = (scenario, candidate) => verifyPlan(scenario, candidate).errors.join('\n');

  assert.match(errors(base, withRoute(routeA, route => ({ ...route, totalWorkTimeMinutes: 999 }))), /excede a jornada/);
  assert.match(errors(base, withRoute(routeA, route => ({ ...route, visits: [...route.visits, route.visits[0]] }))), /mais de uma vez/);
  const away = { ...base, patients: base.patients.map(patient => patient.id === 'a'
    ? { ...patient, unavailablePeriods: [{ start: '2026-10-08', end: '2026-10-08', reason: 'Consulta médica' }] } : patient) };
  assert.match(errors(away, result), /indisponível em 2026-10-08 \(Consulta médica\)/);
  const late = { ...base, patients: base.patients.map(patient => patient.id === 'b' ? { ...patient, hardDeadline: '2026-10-08' } : patient) };
  assert.match(errors(late, result), /prazo rígido até 2026-10-08, mas foi agendado para 2026-10-09/);
  const offDuty = { ...base, teams: [{ ...base.teams[0], availableDays: ['2026-12-01'] }] };
  assert.match(errors(offDuty, result), /não está disponível nesta data/);
  const moved = { ...base, patients: base.patients.map(patient => patient.id === 'a' ? { ...patient, location: { lat: -31, lng: -52 } } : patient) };
  assert.match(errors(moved, result), /fora do território/);
});

// ---------------------------------------------------------------------------------------------
// Teste aleatório (fuzz): centenas de cenários com restrições sorteadas, inclusive combinações
// impossíveis. Para cada um e para cada estratégia, o plano precisa sair sem erro e respeitar
// todas as regras. A semente é fixa: uma falha se reproduz com o mesmo número.
// ---------------------------------------------------------------------------------------------

const POOL = ['acs', 'enfermagem', 'tecnico_enfermagem', 'medicina', 'odontologia'];

function randomScenario(seed) {
  const random = mulberry32(seed);
  const int = (min, max) => min + Math.floor(random() * (max - min + 1));
  const chance = p => random() < p;
  const pick = list => list[int(0, list.length - 1)];
  const subset = list => list.filter(() => chance(0.4));
  const shift = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };

  const startDate = '2026-10-08';
  const planningHorizonDays = int(1, 5);
  const days = getWorkingDaysHorizon(startDate, planningHorizonDays);
  const teams = Array.from({ length: int(0, 3) }, (_, index) => {
    const professions = subset(POOL);
    const counts = Object.fromEntries(professions.filter(() => chance(0.4)).map(profession => [profession, int(1, 3)]));
    return {
      id: `t${index}`, name: `Equipe ${index}`, professions, ...(Object.keys(counts).length ? { professionCounts: counts } : {}),
      dailyWorkMinutes: int(20, 300), availableDays: chance(0.3) ? days.filter(() => chance(0.5)) : []
    };
  });
  const patients = Array.from({ length: int(1, 14) }, (_, index) => {
    const patient = {
      id: `p${index}`, code: `P${index}`, location: { lat: -30 + random() * 0.09 - 0.045, lng: -51 + random() * 0.09 - 0.045 },
      defaultVisitDurationMinutes: int(10, 90),
      conditions: [{ conditionId: 'c', initialDueDate: shift(startDate, int(-10, 10)), maxIntervalDays: int(7, 60), priorityWeight: int(1, 5) }]
    };
    if (chance(0.15)) patient.hardDeadline = chance(0.3) ? shift(startDate, -int(1, 5)) : pick(days);
    if (chance(0.2)) patient.requiredProfessions = [...new Set([pick(POOL), pick(POOL)])];
    if (chance(0.1)) patient.requiredProfessionCounts = { [pick(POOL)]: int(1, 3) };
    if (chance(0.1)) patient.requiredStaffCount = int(1, 4);
    if (teams.length && chance(0.1)) patient.assignedTeamId = pick(teams).id;
    if (chance(0.15)) { const start = shift(startDate, int(-3, 8)); patient.unavailablePeriods = [{ start, end: shift(start, int(0, 6)), reason: 'sorteio' }]; }
    if (chance(0.1)) patient.visitBufferMinutes = int(0, 30);
    if (chance(0.1)) patient.nextVisit = { durationMinutes: int(10, 120), bufferMinutes: int(0, 20) };
    if (chance(0.05)) patient.transfer = { toRegionId: 'outra', toHealthCenterName: 'Outra', date: startDate };
    return patient;
  });
  const scenario = {
    id: `fuzz_${seed}`, version: 1,
    healthCenter: { id: 'posto', name: 'Posto', location: { lat: -30, lng: -51 } },
    polygons: [{ id: 'area', name: 'Área', vertices: [{ lat: -30.1, lng: -51.1 }, { lat: -30.1, lng: -50.9 }, { lat: -29.9, lng: -50.9 }, { lat: -29.9, lng: -51.1 }] }],
    patients, teams, startDate, planningHorizonDays, maxAnticipationDays: int(0, 5),
    ...(chance(0.3) ? { visitBufferMinutes: int(0, 20) } : {}),
    ...(chance(0.3) ? { deadlineSafetyMarginDays: int(0, 3) } : {})
  };
  // Custos euclidianos (respeitam a desigualdade triangular): ~1,1 min por 100 m a pé.
  const nodes = [scenario.healthCenter, ...patients.filter(patient => !patient.transfer)];
  const km = (a, b) => Math.hypot((a.location.lat - b.location.lat) * 111, (a.location.lng - b.location.lng) * 96);
  const distanceMatrix = nodes.map(a => nodes.map(b => km(a, b)));
  return { scenario, matrix: { nodeIds: nodes.map(node => node.id), distanceMatrix, timeMatrix: distanceMatrix.map(row => row.map(value => value * 12)) } };
}

test('fuzz: 300 cenários aleatórios × 3 estratégias nunca violam uma regra', () => {
  let scheduled = 0;
  let pendingMandatory = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const { scenario, matrix } = randomScenario(seed);
    const node = new Map(matrix.nodeIds.map((id, index) => [id, index]));
    const patientById = new Map(scenario.patients.map(patient => [patient.id, patient]));
    for (const strategyId of STRATEGIES) {
      const where = `semente ${seed}, ${strategyId}`;
      let result;
      assert.doesNotThrow(() => { result = planScenario(scenario, { strategyId, costMatrix: matrix }); }, where);
      const check = verifyPlan(scenario, result);
      assert.equal(check.isValid, true, `${where}: ${check.errors.join(' | ')}`);

      const seen = new Set();
      for (const route of result.routes) {
        const team = scenario.teams.find(item => item.id === route.teamId);
        let previous = 0;
        let work = 0;
        let lastStart = '';
        for (const visit of route.visits) {
          assert.ok(!seen.has(visit.visitCandidateId), `${where}: ${visit.visitCandidateId} agendada duas vezes`);
          seen.add(visit.visitCandidateId);
          assert.ok(teamCanServe(team, patientById.get(visit.patientId)), `${where}: equipe incompatível`);
          assert.ok(visit.estimatedStartTime > lastStart, `${where}: horários fora de ordem`);
          lastStart = visit.estimatedStartTime;
          work += matrix.timeMatrix[previous][node.get(visit.patientId)] + visit.durationMinutes;
          previous = node.get(visit.patientId);
        }
        work += matrix.timeMatrix[previous][0];
        // Os totais da rota batem com a matriz (nenhuma etapa deixa um total desatualizado).
        assert.ok(Math.abs(work - route.totalWorkTimeMinutes) < 0.25, `${where}: total ${route.totalWorkTimeMinutes} ≠ ${work.toFixed(2)}`);
        assert.ok(route.totalWorkTimeMinutes <= team.dailyWorkMinutes + 1e-6, `${where}: jornada excedida`);
        scheduled += route.visits.length;
      }
      for (const item of result.unallocatedVisits) {
        assert.ok(!seen.has(item.visitCandidateId), `${where}: ${item.visitCandidateId} agendada e pendente ao mesmo tempo`);
        assert.ok(item.reason, `${where}: pendência sem motivo`);
        if (item.mandatory) pendingMandatory++;
      }
      // Todo paciente com prazo rígido na janela está agendado até o prazo ou pendente como obrigatório.
      for (const patient of scenario.patients.filter(item => item.hardDeadline && !item.transfer)) {
        const visit = visitsOf(result).find(item => item.patientId === patient.id);
        const pending = result.unallocatedVisits.find(item => item.patientId === patient.id);
        assert.ok(visit || pending?.mandatory, `${where}: prazo rígido de ${patient.id} sumiu do plano`);
      }
      for (const [name, value] of Object.entries(result.metrics)) {
        if (typeof value === 'number') assert.ok(Number.isFinite(value), `${where}: métrica ${name} = ${value}`);
      }
    }
  }
  // O sorteio exercita os dois lados: visitas agendadas e prazos rígidos impossíveis.
  assert.ok(scheduled > 1000, `apenas ${scheduled} visitas agendadas`);
  assert.ok(pendingMandatory > 20, `apenas ${pendingMandatory} prazos rígidos pendentes`);
});
