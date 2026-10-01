import { DailyTeamRoute, Scenario, Patient, Team, PlannedVisit } from '@routing/core';

/**
 * Gerador de arquivo GPX padrão XML para uma Rota Diária de Equipe
 */
export function generateRouteGpx(scenario: Scenario, route: DailyTeamRoute): string {
  const team = scenario.teams.find((t: Team) => t.id === route.teamId);
  const teamName = team ? team.name : route.teamId;
  const patientMap = new Map<string, Patient>(scenario.patients.map((p: Patient) => [p.id, p]));
  const healthCenter = scenario.healthCenter;

  const waypointsXml: string[] = [];

  // 1. Waypoint do Posto (Partida)
  waypointsXml.push(`
  <wpt lat="${healthCenter.location.lat}" lon="${healthCenter.location.lng}">
    <name>00. Posto: ${healthCenter.name}</name>
    <desc>Ponto de Partida da Equipe ${teamName}</desc>
    <sym>Hospital</sym>
  </wpt>`);

  // 2. Waypoints dos Pacientes na Ordem da Rota
  route.visits.forEach((visit: PlannedVisit, index: number) => {
    const patient = patientMap.get(visit.patientId);
    const code = patient ? patient.code : visit.patientId;
    const lat = patient ? patient.location.lat : 0;
    const lng = patient ? patient.location.lng : 0;
    const numStr = String(index + 1).padStart(2, '0');

    waypointsXml.push(`
  <wpt lat="${lat}" lon="${lng}">
    <name>${numStr}. Paciente: ${code}</name>
    <desc>Horário estimado: ${visit.estimatedStartTime} - ${visit.estimatedEndTime} | Duração: ${visit.durationMinutes || 0} min</desc>
    <sym>Home</sym>
  </wpt>`);
  });

  // 3. Waypoint do Posto (Retorno)
  const returnNumStr = String(route.visits.length + 1).padStart(2, '0');
  waypointsXml.push(`
  <wpt lat="${healthCenter.location.lat}" lon="${healthCenter.location.lng}">
    <name>${returnNumStr}. Retorno: ${healthCenter.name}</name>
    <desc>Ponto de Retorno da Equipe ${teamName}</desc>
    <sym>Hospital</sym>
  </wpt>`);

  // Track points (Segmentos ordenados)
  const trackpointsXml: string[] = [];
  trackpointsXml.push(`    <trkpt lat="${healthCenter.location.lat}" lon="${healthCenter.location.lng}"></trkpt>`);
  route.visits.forEach((visit: PlannedVisit) => {
    const patient = patientMap.get(visit.patientId);
    if (patient) {
      trackpointsXml.push(`    <trkpt lat="${patient.location.lat}" lon="${patient.location.lng}"></trkpt>`);
    }
  });
  trackpointsXml.push(`    <trkpt lat="${healthCenter.location.lat}" lon="${healthCenter.location.lng}"></trkpt>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FrameworkRoteamentoTS" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Rota Equipe ${teamName} - ${route.date}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  ${waypointsXml.join('')}
  <trk>
    <name>Traçado Rota ${teamName}</name>
    <trkseg>
  ${trackpointsXml.join('\n')}
    </trkseg>
  </trk>
</gpx>`;
}
