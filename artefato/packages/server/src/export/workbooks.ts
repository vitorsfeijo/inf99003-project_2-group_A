import { DailyTeamRoute, Patient, Plan, Scenario, UsageStatistics, professionLabel, requiredProfessionCount,
  requiredProfessionIds, requiredStaffCount } from '@routing/core';
import { CellValue, Sheet } from './xlsx.js';

const STRATEGY_NAMES: Record<string, string> = {
  'main-heuristic': 'Busca mensal', 'urgency-baseline': 'Prioridade clínica', 'nearest-baseline': 'Vizinho mais próximo'
};

const ROUTE_HEADER = ['Data', 'Equipe', 'Ordem', 'Paciente', 'Início', 'Fim', 'Atendimento (min)', 'Folga (min)',
  'Caminhada desde o ponto anterior (min)', 'Distância desde o ponto anterior (km)', 'Obrigatória (prazo rígido)', 'Prazo rígido',
  'Categorias exigidas', 'Profissionais necessários', 'Latitude', 'Longitude'];

export function requirements(patient: Patient | undefined): string {
  if (!patient) return '';
  return requiredProfessionIds(patient).map(profession => {
    const count = requiredProfessionCount(patient, profession);
    return `${count > 1 ? `${count}× ` : ''}${professionLabel(profession)}`;
  }).join('; ');
}

function routeRows(scenario: Scenario, route: DailyTeamRoute): CellValue[][] {
  const team = scenario.teams.find(item => item.id === route.teamId)?.name ?? route.teamId;
  const patients = new Map(scenario.patients.map(patient => [patient.id, patient]));
  const rows: CellValue[][] = route.visits.map((visit, index) => {
    const patient = patients.get(visit.patientId);
    return [route.date, team, index + 1, patient?.code ?? visit.patientId, visit.estimatedStartTime, visit.estimatedEndTime,
      (visit.durationMinutes ?? 0) - (visit.bufferMinutes ?? 0), visit.bufferMinutes ?? 0, visit.travelTimeMinutesFromPrevious,
      visit.travelDistanceKmFromPrevious, visit.mandatory ? 'Sim' : 'Não', patient?.hardDeadline ?? '', requirements(patient),
      patient ? requiredStaffCount(patient) : 1, patient?.location.lat, patient?.location.lng];
  });
  const back = route.totalTravelTimeMinutes - route.visits.reduce((sum, visit) => sum + visit.travelTimeMinutesFromPrevious, 0);
  const backKm = route.totalDistanceKm - route.visits.reduce((sum, visit) => sum + visit.travelDistanceKmFromPrevious, 0);
  rows.push([route.date, team, route.visits.length + 1, `Retorno a ${scenario.healthCenter.name}`, '', '', '', '',
    Number(back.toFixed(1)), Number(backKm.toFixed(2)), '', '', '', '', scenario.healthCenter.location.lat, scenario.healthCenter.location.lng]);
  return rows;
}

/** Rota de uma equipe em um dia: a mesma informação do CSV, com cabeçalhos legíveis. */
export function routeWorkbook(scenario: Scenario, route: DailyTeamRoute): Sheet[] {
  const team = scenario.teams.find(item => item.id === route.teamId)?.name ?? route.teamId;
  return [
    { name: `Rota ${route.date}`, rows: [ROUTE_HEADER, ...routeRows(scenario, route)] },
    { name: 'Resumo', rows: [['Item', 'Valor'], ['Unidade', scenario.healthCenter.name], ['Equipe', team], ['Data', route.date],
      ['Visitas', route.visits.length], ['Caminhada total (min)', route.totalTravelTimeMinutes], ['Distância total (km)', route.totalDistanceKm],
      ['Atendimento + folga (min)', route.totalVisitTimeMinutes], ['Jornada usada (min)', route.totalWorkTimeMinutes],
      ['Jornada disponível (min)', scenario.teams.find(item => item.id === route.teamId)?.dailyWorkMinutes ?? '']] }
  ];
}

/** Plano completo: todas as rotas da janela, as pendências com o motivo e as métricas. */
export function planWorkbook(scenario: Scenario, plan: Plan): Sheet[] {
  const patients = new Map(scenario.patients.map(patient => [patient.id, patient]));
  const routes = [...plan.routes].filter(route => route.visits.length)
    .sort((a, b) => a.date.localeCompare(b.date) || a.teamId.localeCompare(b.teamId));
  const metrics = plan.metrics;
  const metricRows: CellValue[][] = [
    ['Visitas agendadas', routes.reduce((sum, route) => sum + route.visits.length, 0)],
    ['Pendências', plan.unallocatedVisits.length],
    ['Cobertura (%)', metrics.coveragePercentage],
    ['Prioridade atendida a tempo (%)', metrics.priorityWeightedPromptCoveragePercentage],
    ['Atraso acionável ponderado (dias)', metrics.priorityWeightedActionableDelayDays],
    ['Distância total (km)', metrics.totalTravelDistanceKm],
    ['Caminhada total (min)', metrics.totalTravelTimeMinutes],
    ['Utilização média da jornada (%)', metrics.teamUtilizationPercentage],
    ...(metrics.mandatoryVisitCount !== undefined ? [['Prazos rígidos cumpridos', `${metrics.mandatoryVisitsMetCount} de ${metrics.mandatoryVisitCount}`] as CellValue[]] : [])
  ];
  return [
    { name: 'Rotas', rows: [ROUTE_HEADER, ...routes.flatMap(route => routeRows(scenario, route))] },
    { name: 'Pendências', rows: [['Paciente', 'Obrigatória (prazo rígido)', 'Motivo'],
      ...plan.unallocatedVisits.map(item => [patients.get(item.patientId)?.code ?? item.patientId, item.mandatory ? 'Sim' : 'Não', item.reason])] },
    { name: 'Métricas', rows: [['Indicador', 'Valor'], ['Unidade', scenario.healthCenter.name],
      ['Estratégia', STRATEGY_NAMES[plan.strategyId] ?? plan.strategyId], ['Versão do cenário', plan.scenarioVersion],
      ['Primeiro dia', scenario.startDate], ...metricRows] },
    ...(plan.warnings?.length ? [{ name: 'Avisos', rows: [['Aviso'], ...plan.warnings.map(warning => [warning])] }] : [])
  ];
}

/** Estatísticas de uso numa planilha por assunto. */
export function statisticsWorkbook(unitName: string, stats: UsageStatistics): Sheet[] {
  const periodLabel = { week: 'Semana', month: 'Mês', year: 'Ano' }[stats.period];
  return [
    { name: 'Visitas', rows: [['Indicador', 'Valor'], ['Unidade', unitName], ['Período', `${stats.from ?? 'início'} a ${stats.to ?? 'hoje'}`],
      ['Visitas registradas', stats.visits.attempted], ['Concluídas', stats.visits.completed], ['Não realizadas', stats.visits.missed],
      ['Não realizadas (%)', stats.visits.missedPercentage], ['Retiradas da rota por aviso do paciente', stats.visits.removedFromRoute],
      ['Transferências enviadas', stats.transfers.out], ['Transferências recebidas', stats.transfers.in]] },
    { name: 'Motivos de falha', rows: [['Motivo', 'Visitas', '% das não realizadas'],
      ...stats.visits.missedByReason.map(item => [item.reason, item.count, item.percentage])] },
    { name: 'Atendimentos por equipe', rows: [['Equipe', periodLabel, 'Visitas concluídas', 'Pacientes atendidos'],
      ...stats.teams.flatMap(team => team.buckets.map(bucket => [team.teamName, bucket.period, bucket.completedVisits, bucket.patientsServed]))] },
    { name: 'Áreas', rows: [['Área', 'Pacientes', 'Âncoras', 'Prazo rígido', 'Com folga própria', 'Com ausência programada', 'Exigem 2+ profissionais'],
      ...stats.areas.map(area => [area.areaName, area.patients, area.anchors, area.hardDeadlines, area.withBuffer, area.withTimeout, area.needsMultipleStaff])] }
  ];
}
