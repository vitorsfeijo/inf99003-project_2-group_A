import { DailyTeamRoute, Scenario, Patient, Team, PlannedVisit } from '@routing/core';

/**
 * Gerador de CSV para uma Rota Diária de Equipe
 */
export function generateRouteCsv(scenario: Scenario, route: DailyTeamRoute): string {
  const team = scenario.teams.find((t: Team) => t.id === route.teamId);
  const teamName = team ? team.name : route.teamId;

  const header = [
    'ordem',
    'tipo',
    'id_paciente_ou_posto',
    'nome_paciente_ou_posto',
    'horario_inicio',
    'horario_fim',
    'duracao_atendimento_min',
    'tempo_viagem_anterior_min',
    'distancia_anterior_km',
    'latitude',
    'longitude',
    'equipe',
    'data_atendimento'
  ].join(',');

  const rows: string[] = [];

  // Ponto de Origem: Posto de Saúde (Ordem 0)
  const healthCenter = scenario.healthCenter;
  rows.push([
    0,
    'POSTO_ORIGEM',
    `"${healthCenter.id}"`,
    `"${healthCenter.name}"`,
    '"08:00"',
    '"08:00"',
    0,
    0,
    0,
    healthCenter.location.lat,
    healthCenter.location.lng,
    `"${teamName}"`,
    `"${route.date}"`
  ].join(','));

  // Atendimentos em Ordem
  const patientMap = new Map<string, Patient>(scenario.patients.map((p: Patient) => [p.id, p]));

  route.visits.forEach((visit: PlannedVisit, index: number) => {
    const patient = patientMap.get(visit.patientId);
    const patientCode = patient ? patient.code : visit.patientId;
    const lat = patient ? patient.location.lat : 0;
    const lng = patient ? patient.location.lng : 0;

    rows.push([
      index + 1,
      'VISITA_PACIENTE',
      `"${visit.patientId}"`,
      `"${patientCode}"`,
      `"${visit.estimatedStartTime}"`,
      `"${visit.estimatedEndTime}"`,
      visit.durationMinutes || 0,
      visit.travelTimeMinutesFromPrevious,
      visit.travelDistanceKmFromPrevious,
      lat,
      lng,
      `"${teamName}"`,
      `"${route.date}"`
    ].join(','));
  });

  // Ponto de Retorno: Posto de Saúde (Última Ordem)
  const lastOrder = route.visits.length + 1;
  rows.push([
    lastOrder,
    'POSTO_RETORNO',
    `"${healthCenter.id}"`,
    `"${healthCenter.name}"`,
    '""',
    '""',
    0,
    0,
    0,
    healthCenter.location.lat,
    healthCenter.location.lng,
    `"${teamName}"`,
    `"${route.date}"`
  ].join(','));

  return `${header}\n${rows.join('\n')}`;
}
