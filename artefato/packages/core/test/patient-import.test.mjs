// Importação de pacientes de planilha (CSV/Excel convertido em linhas) e de JSON.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeImportedPatients, parseCsv, parseImportDate, patientImportTemplate, patientsFromJson, patientsFromTable,
  planScenario, verifyPlan } from '../dist/index.js';
import { STRATEGIES, lineMatrix, lineScenario, pendingOf, visitsOf } from './helpers.mjs';

const TEAMS = [
  { id: 'eq_a', name: 'Equipe Azul', dailyWorkMinutes: 480, availableDays: [],
    professions: ['acs', 'enfermagem', 'tecnico_enfermagem'], professionCounts: { tecnico_enfermagem: 2 } },
  { id: 'eq_b', name: 'Equipe Verde', dailyWorkMinutes: 480, availableDays: [], professions: ['acs'] }
];
const base = lineScenario([], { teams: TEAMS });
const context = (extra = {}) => ({ healthCenter: base.healthCenter, polygons: base.polygons, teams: TEAMS, startDate: base.startDate, ...extra });
const byCode = (result, code) => result.patients.find(patient => patient.code === code);
const issueAt = (issues, where) => issues.filter(issue => issue.where === where).map(issue => issue.message).join(' | ');

test('CSV do Excel em português: ";", vírgula decimal, BOM, CRLF, acentos no cabeçalho e aspas', () => {
  const csv = '﻿Código;Latitude;Longitude;Duração (min);Folga (min);Categorias;Equipe;Prazo rígido;Ausência início;Ausência fim;Ausência motivo\r\n'
    + 'A1;-30,0012;-51,0034;45;10;"Técnico(a) de enfermagem: 2; Enfermeiro(a)";Equipe Azul;10/10/2026;12/10/2026;14/10/2026;"Viagem; volta dia 15"\r\n'
    + 'A2;-30.002;-51.001;;;;;;;;\r\n\r\n';
  const rows = parseCsv(csv);
  assert.equal(rows[0][0], 'Código');
  const result = patientsFromTable(rows, context());
  assert.deepEqual(result.errors, []);
  assert.equal(result.rowsRead, 2);
  const a1 = byCode(result, 'A1');
  assert.deepEqual(a1.location, { lat: -30.0012, lng: -51.0034 });
  assert.equal(a1.defaultVisitDurationMinutes, 45);
  assert.equal(a1.visitBufferMinutes, 10);
  assert.deepEqual(a1.requiredProfessions, ['tecnico_enfermagem', 'enfermagem']);
  assert.deepEqual(a1.requiredProfessionCounts, { tecnico_enfermagem: 2 });
  assert.equal(a1.assignedTeamId, 'eq_a');
  assert.equal(a1.hardDeadline, '2026-10-10');
  assert.deepEqual(a1.unavailablePeriods, [{ start: '2026-10-12', end: '2026-10-14', kind: 'timeout', reason: 'Viagem; volta dia 15' }]);
  const a2 = byCode(result, 'A2');
  assert.equal(a2.defaultVisitDurationMinutes, 30);
  assert.deepEqual(a2.conditions, [{ conditionId: 'cond_principal', maxIntervalDays: 30, priorityWeight: 3, initialDueDate: '2026-10-08' }]);
  assert.equal(a2.visitBufferMinutes, undefined);
});

test('o leitor de CSV detecta vírgula e tabulação, aceita quebra de linha entre aspas e recusa aspas abertas', () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","linha 1\nlinha 2"'), [['a', 'b'], ['x, y', 'linha 1\nlinha 2']]);
  assert.deepEqual(parseCsv('a\tb\n1\t"dito ""assim"""'), [['a', 'b'], ['1', 'dito "assim"']]);
  assert.throws(() => parseCsv('a;b\n"aberto;2'), /aspas abertas/);
});

test('datas em ISO, DD/MM/AAAA, DD/MM/AA e número de série do Excel; datas inexistentes são recusadas', () => {
  assert.equal(parseImportDate('2026-10-08'), '2026-10-08');
  assert.equal(parseImportDate('2026-10-08T00:00:00.000Z'), '2026-10-08');
  assert.equal(parseImportDate('8/10/2026'), '2026-10-08');
  assert.equal(parseImportDate('08-10-26'), '2026-10-08');
  assert.equal(parseImportDate(45658), '2025-01-01');
  assert.equal(parseImportDate(''), undefined);
  assert.throws(() => parseImportDate('31/02/2026'), /não existe/);
  assert.throws(() => parseImportDate('ontem'), /formato desconhecido/);
});

test('linhas com o mesmo código viram condições do mesmo paciente', () => {
  const rows = [
    ['codigo', 'latitude', 'longitude', 'condicao', 'prioridade', 'intervalo_max_dias', 'ultima_visita', 'duracao_min'],
    ['B1', -30.001, -51.001, 'hipertensao', 3, 30, '2026-09-20', 40],
    ['B1', '', '', 'diabetes', 5, 60, '', ''],
    ['B1', -30.5, -51.5, 'curativo', 4, 7, '', ''],
    ['B1', '', '', 'diabetes', 2, 10, '', '']
  ];
  const result = patientsFromTable(rows, context());
  assert.equal(result.patients.length, 1);
  const patient = result.patients[0];
  assert.deepEqual(patient.conditions.map(condition => condition.conditionId), ['hipertensao', 'diabetes', 'curativo']);
  assert.deepEqual(patient.conditions[0], { conditionId: 'hipertensao', maxIntervalDays: 30, priorityWeight: 3, lastVisitDate: '2026-09-20' });
  assert.equal(patient.defaultVisitDurationMinutes, 40);
  assert.deepEqual(patient.location, { lat: -30.001, lng: -51.001 });
  assert.match(issueAt(result.warnings, 'Linha 4'), /valem os da primeira linha/);
  assert.match(issueAt(result.errors, 'Linha 5'), /já tem a condição "diabetes"/);
});

test('cada linha com problema é recusada com o motivo, e as outras entram', () => {
  const rows = [
    ['codigo', 'latitude', 'longitude', 'prioridade', 'ultima_visita', 'categorias', 'equipe', 'profissionais', 'ausencia_inicio', 'ausencia_fim'],
    ['OK', -30.001, -51.001, '', '', '', '', '', '', ''],
    ['SEM_COORD', '', -51.001, '', '', '', '', '', '', ''],
    ['DATA', -30.001, -51.001, '', '31/02/2026', '', '', '', '', ''],
    ['CATEG', -30.001, -51.001, '', '', 'astronauta', '', '', '', ''],
    ['EQUIPE', -30.001, -51.001, '', '', '', 'Equipe Roxa', '', '', ''],
    ['TROCADO', -51.001, -30.001, '', '', '', '', '', '', ''],
    ['PRIOR', -30.001, -51.001, 7, '', '', '', '', '', ''],
    ['', -30.001, -51.001, '', '', '', '', '', '', ''],
    ['AUSENCIA', -30.001, -51.001, '', '', '', '', '', '2026-10-20', '2026-10-10'],
    ['PROF', -30.001, -51.001, '', '', 'enfermagem; tecnico_enfermagem x2', '', 2, '', '']
  ];
  const result = patientsFromTable(rows, context());
  assert.deepEqual(result.patients.map(patient => patient.code), ['OK', 'PROF']);
  assert.equal(result.rowsRead, 10);
  assert.match(issueAt(result.errors, 'Linha 3'), /latitude/);
  assert.match(issueAt(result.errors, 'Linha 4'), /Última visita não existe/);
  assert.match(issueAt(result.errors, 'Linha 5'), /Categoria desconhecida: "astronauta"/);
  assert.match(issueAt(result.errors, 'Linha 6'), /equipe "Equipe Roxa" não existe .*Equipe Azul, Equipe Verde/);
  assert.match(issueAt(result.errors, 'Linha 7'), /trocadas/);
  assert.match(issueAt(result.errors, 'Linha 8'), /Prioridade deve ser um número inteiro de 1 a 5/);
  assert.match(issueAt(result.errors, 'Linha 9'), /Falta o código/);
  assert.match(issueAt(result.errors, 'Linha 10'), /termina .* antes de começar/);
  assert.match(issueAt(result.warnings, 'Linha 11'), /exige 3 profissionais/);
  assert.deepEqual(byCode(result, 'PROF').requiredProfessionCounts, { tecnico_enfermagem: 2 });
});

test('sem as colunas obrigatórias nada é importado; colunas desconhecidas são avisadas', () => {
  const result = patientsFromTable([['nome', 'rua', 'latitude'], ['Maria', 'Rua A', -30]], context());
  assert.equal(result.patients.length, 0);
  assert.match(issueAt(result.errors, 'Cabeçalho'), /Faltam as colunas obrigatórias: codigo, longitude/);
  assert.match(issueAt(result.warnings, 'Cabeçalho'), /"nome" não é reconhecida/);
});

test('categorias por código, nome ou plural, com a quantidade antes ou depois', () => {
  const rows = [['codigo', 'latitude', 'longitude', 'categorias'],
    ['C1', -30.001, -51.001, '2 técnicos de enfermagem | Médico'],
    ['C2', -30.001, -51.001, 'ACS, assistente social (2)']];
  const result = patientsFromTable(rows, context());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(byCode(result, 'C1').requiredProfessions, ['tecnico_enfermagem', 'medicina']);
  assert.deepEqual(byCode(result, 'C1').requiredProfessionCounts, { tecnico_enfermagem: 2 });
  assert.deepEqual(byCode(result, 'C2').requiredProfessions, ['acs', 'servico_social']);
  assert.deepEqual(byCode(result, 'C2').requiredProfessionCounts, { servico_social: 2 });
});

test('fora do contorno do GeoSaúde: o paciente da lista da unidade é incluído e avisado', () => {
  const rows = [['codigo', 'latitude', 'longitude'], ['DENTRO', -30.001, -51.001], ['FORA', -30.15, -51.001]];
  const result = patientsFromTable(rows, context());
  assert.equal(byCode(result, 'DENTRO').territoryOverride, undefined);
  assert.equal(byCode(result, 'FORA').territoryOverride, 'include');
  assert.match(issueAt(result.warnings, 'Arquivo'), /1 paciente\(s\) ficam fora do contorno.*FORA/);
});

test('JSON: pacientes do aplicativo, cenário exportado e lista de objetos com as colunas da planilha', () => {
  const appPatient = { id: 'x', code: 'J1', location: { lat: -30.001, lng: -51.001 }, defaultVisitDurationMinutes: 25,
    conditions: [{ conditionId: 'c', maxIntervalDays: 15, priorityWeight: 2, lastVisitDate: '2026-09-30' }], assignedTeamId: 'eq_b' };
  const fromScenario = patientsFromJson({ ...base, patients: [appPatient] }, context());
  assert.deepEqual(fromScenario.errors, []);
  assert.equal(byCode(fromScenario, 'J1').assignedTeamId, 'eq_b');
  assert.equal(byCode(fromScenario, 'J1').id, 'imp_j1');
  assert.match(issueAt(fromScenario.warnings, 'Arquivo'), /só os pacientes foram importados/);

  const mixed = patientsFromJson([
    { codigo: 'J2', latitude: '-30,002', longitude: -51.002, categorias: ['enfermagem'] },
    appPatient,
    { ...appPatient, conditions: [] },
    { codigo: 'J3', latitude: -30.002 },
    42
  ], context());
  assert.deepEqual(mixed.patients.map(patient => patient.code).sort(), ['J1', 'J2']);
  assert.deepEqual(byCode(mixed, 'J2').requiredProfessions, ['enfermagem']);
  assert.match(issueAt(mixed.errors, 'Item 3'), /mais de uma vez|conditions/);
  assert.match(issueAt(mixed.errors, 'Item 4'), /longitude/);
  assert.match(issueAt(mixed.errors, 'Item 5'), /Não é um objeto/);

  assert.match(issueAt(patientsFromJson({ nome: 'x' }, context()).errors, 'Arquivo'), /lista de pacientes/);
  const unknownTeam = patientsFromJson([{ ...appPatient, assignedTeamId: 'nao_existe' }], context());
  assert.match(issueAt(unknownTeam.errors, 'Item 1'), /equipe "nao_existe" não existe/);
});

test('o mesmo código atualiza o cadastro e mantém identificador, transferência, ajuste da próxima visita e ausências', () => {
  const current = [
    { id: 'manual_1', code: 'P1', location: { lat: -30.001, lng: -51.001 }, defaultVisitDurationMinutes: 30,
      conditions: [{ conditionId: 'c', maxIntervalDays: 30, priorityWeight: 3 }], nextVisit: { durationMinutes: 60 },
      unavailablePeriods: [{ start: '2026-10-09', end: '2026-10-09', kind: 'skip' }] },
    { id: 'manual_2', code: 'P2', location: { lat: -30.002, lng: -51.002 }, defaultVisitDurationMinutes: 30,
      conditions: [{ conditionId: 'c', maxIntervalDays: 30, priorityWeight: 3 }] }
  ];
  const rows = [['codigo', 'latitude', 'longitude', 'prioridade', 'ausencia_inicio'], ['p1', -30.003, -51.003, 5, '2026-10-20'], ['P9', -30.004, -51.004, 1, '']];
  const imported = patientsFromTable(rows, context({ existingPatients: current }));
  assert.equal(byCode(imported, 'p1').id, 'manual_1');

  const added = mergeImportedPatients(current, imported.patients, 'add');
  assert.deepEqual([added.added, added.updated, added.removed], [1, 1, 0]);
  assert.deepEqual(added.patients.map(patient => patient.id), ['manual_1', 'manual_2', 'imp_p9']);
  const p1 = added.patients[0];
  assert.equal(p1.conditions[0].priorityWeight, 5);
  assert.deepEqual(p1.nextVisit, { durationMinutes: 60 });
  assert.deepEqual(p1.unavailablePeriods.map(period => period.start), ['2026-10-09', '2026-10-20']);

  const replaced = mergeImportedPatients(current, imported.patients, 'replace');
  assert.deepEqual([replaced.added, replaced.updated, replaced.removed], [1, 1, 1]);
  assert.deepEqual(replaced.patients.map(patient => patient.id), ['manual_1', 'imp_p9']);
});

test('o modelo de planilha importa sem erros e gera planos válidos nas três estratégias', () => {
  const template = patientImportTemplate(base.healthCenter.location, base.startDate);
  const imported = patientsFromTable(template, context());
  assert.deepEqual(imported.errors, []);
  assert.deepEqual(imported.patients.map(patient => patient.code), ['P001', 'P002', 'P003']);
  assert.equal(imported.patients[1].conditions.length, 2);
  const scenario = { ...base, patients: imported.patients, planningHorizonDays: 10 };
  for (const strategyId of STRATEGIES) {
    const plan = planScenario(scenario, { strategyId, costMatrix: lineMatrix(scenario) });
    assert.equal(verifyPlan(scenario, plan).isValid, true, strategyId);
    const p002 = visitsOf(plan).filter(visit => visit.patientId === 'imp_p002');
    assert.ok(p002.length && p002.every(visit => visit.teamId === 'eq_a' && visit.date <= '2026-10-10'), `${strategyId}: P002 só cabe na Equipe Azul, até o prazo rígido`);
    const p003 = visitsOf(plan).find(visit => visit.patientId === 'imp_p003');
    assert.ok(!p003 || p003.date > '2026-10-11', `${strategyId}: P003 está internado até 11/10`);
    assert.equal(pendingOf(plan, 'imp_p002'), undefined, strategyId);
  }
});
