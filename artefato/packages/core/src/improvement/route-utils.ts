import { CostMatrix, DailyTeamRoute, PlannedVisit, VisitCandidate } from '../types/index.js';

/** Horário de saída do posto usado nas estimativas. */
const START_HOUR = 8;

export function formatTime(minutesFromStart: number): string {
  const minutes = START_HOUR * 60 + Math.round(minutesFromStart);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function nodeIndexByPatient(matrix: CostMatrix): Map<string, number> {
  return new Map(matrix.nodeIds.map((id, index) => [id, index]));
}

/** Visita planejada a partir do candidato, sem horários (preenchidos ao reconstruir a rota). */
export function toPlannedVisit(candidate: VisitCandidate): PlannedVisit {
  return {
    visitCandidateId: candidate.id, patientId: candidate.patientId, conditionId: candidate.conditionId,
    durationMinutes: candidate.durationMinutes,
    ...(candidate.bufferMinutes ? { bufferMinutes: candidate.bufferMinutes } : {}),
    ...(candidate.hardDeadline ? { mandatory: true } : {}),
    estimatedStartTime: '', estimatedEndTime: '',
    travelTimeMinutesFromPrevious: 0, travelDistanceKmFromPrevious: 0
  };
}

export function routeTravelMinutes(visits: PlannedVisit[], matrix: CostMatrix, nodeByPatient: Map<string, number>): number {
  let previous = 0;
  let total = 0;
  for (const visit of visits) {
    const node = nodeByPatient.get(visit.patientId);
    if (node === undefined) throw new Error(`Paciente ${visit.patientId} ausente da matriz viária.`);
    total += matrix.timeMatrix[previous][node];
    previous = node;
  }
  return total + matrix.timeMatrix[previous][0];
}

export function routeServiceMinutes(visits: PlannedVisit[]): number {
  return visits.reduce((sum, visit) => sum + (visit.durationMinutes ?? 30), 0);
}

/**
 * Recalcula trechos, totais e horários estimados da rota na ordem informada.
 * O horário de término exibido exclui a folga, que fica como intervalo antes do próximo trecho.
 */
export function rebuildRoute(route: DailyTeamRoute, visits: PlannedVisit[], matrix: CostMatrix,
  nodeByPatient: Map<string, number>): DailyTeamRoute {
  let previous = 0;
  let elapsed = 0;
  let distance = 0;
  let travel = 0;
  let service = 0;
  const updated = visits.map(visit => {
    const node = nodeByPatient.get(visit.patientId);
    if (node === undefined) throw new Error(`Paciente ${visit.patientId} ausente da matriz viária.`);
    const legMinutes = matrix.timeMatrix[previous][node];
    const legKm = matrix.distanceMatrix[previous][node];
    const duration = visit.durationMinutes ?? 30;
    travel += legMinutes;
    distance += legKm;
    elapsed += legMinutes;
    const start = formatTime(elapsed);
    const end = formatTime(elapsed + duration - (visit.bufferMinutes ?? 0));
    elapsed += duration;
    service += duration;
    previous = node;
    return { ...visit, estimatedStartTime: start, estimatedEndTime: end,
      travelTimeMinutesFromPrevious: Number(legMinutes.toFixed(1)), travelDistanceKmFromPrevious: Number(legKm.toFixed(2)) };
  });
  travel += matrix.timeMatrix[previous][0];
  distance += matrix.distanceMatrix[previous][0];
  return { ...route, visits: updated, totalTravelTimeMinutes: Number(travel.toFixed(1)),
    totalDistanceKm: Number(distance.toFixed(2)), totalVisitTimeMinutes: service,
    totalWorkTimeMinutes: Number((travel + service).toFixed(1)) };
}
