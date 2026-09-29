import { RoutingStrategy, PlanningContext, DailyTeamRoute, UnallocatedVisit, PlannedVisit } from '../types/index.js';
import { differenceInCalendarDays } from '../demand/dates.js';

/**
 * Baseline 1: Ordenação Cronológica por Urgência / Vencimento
 * Processa os dias em ordem; em cada dia, ordena visitas disponíveis por vencimento
 * e insere cada uma na equipe com menor custo adicional viável.
 */
export const UrgencyBaselineStrategy: RoutingStrategy = {
  id: 'urgency-baseline',
  name: 'Baseline por Urgência',
  description: 'Ordenação cronológica de visitas pendentes por data-limite e inserção na equipe de menor custo adicional.',

  solve(context: PlanningContext) {
    const { scenario, costMatrix, candidates, workingDays } = context;
    const nodeIndexMap = new Map(costMatrix.nodeIds.map((id, index) => [id, index]));
    const depotIdx = 0;

    const routes: DailyTeamRoute[] = [];
    const unassignedCandidates = [...candidates];
    const allocatedCandidateIds = new Set<string>();

    for (const day of workingDays) {
      // Filtrar equipes disponíveis neste dia
      const availableTeams = scenario.teams.filter(t => !t.availableDays || t.availableDays.length === 0 || t.availableDays.includes(day));

      for (const team of availableTeams) {
        let currentVisits: PlannedVisit[] = [];
        let currentWorkMinutes = 0;
        let currentDistKm = 0;
        let currentTravelMinutes = 0;
        let currentVisitMinutes = 0;
        let lastNodeIdx = depotIdx;

        // Candidatos elegíveis até o dia atual (vencidos ou vencem hoje)
        const eligibleNow = unassignedCandidates
          .filter(c => !allocatedCandidateIds.has(c.id) && differenceInCalendarDays(c.dueDate, day) <= 0)
          .sort((a, b) => b.priorityScore - a.priorityScore);

        for (const cand of eligibleNow) {
          const candidateNodeIdx = nodeIndexMap.get(cand.patientId);
          if (candidateNodeIdx === undefined) continue;

          // Custo de inserção: lastNode -> candidate + return to depot
          const travelTimeToAdd = costMatrix.timeMatrix[lastNodeIdx][candidateNodeIdx];
          const returnTimeToDepot = costMatrix.timeMatrix[candidateNodeIdx][depotIdx];
          const visitDuration = cand.durationMinutes || 30;

          const totalProjectedTime = currentWorkMinutes + travelTimeToAdd + visitDuration + returnTimeToDepot;

          if (totalProjectedTime <= team.dailyWorkMinutes) {
            const travelDistToAdd = costMatrix.distanceMatrix[lastNodeIdx][candidateNodeIdx];

            currentVisits.push({
              visitCandidateId: cand.id,
              patientId: cand.patientId,
              conditionId: cand.conditionId,
              durationMinutes: visitDuration,
              estimatedStartTime: '',
              estimatedEndTime: '',
              travelTimeMinutesFromPrevious: Number(travelTimeToAdd.toFixed(1)),
              travelDistanceKmFromPrevious: Number(travelDistToAdd.toFixed(2))
            });

            currentWorkMinutes += travelTimeToAdd + visitDuration;
            currentTravelMinutes += travelTimeToAdd;
            currentVisitMinutes += visitDuration;
            currentDistKm += travelDistToAdd;
            lastNodeIdx = candidateNodeIdx;

            allocatedCandidateIds.add(cand.id);
          }
        }

        // Adicionar retorno ao posto na rota final do dia
        const finalReturnTime = costMatrix.timeMatrix[lastNodeIdx][depotIdx];
        const finalReturnDist = costMatrix.distanceMatrix[lastNodeIdx][depotIdx];

        routes.push({
          date: day,
          teamId: team.id,
          visits: currentVisits,
          totalDistanceKm: Number((currentDistKm + finalReturnDist).toFixed(2)),
          totalTravelTimeMinutes: Number((currentTravelMinutes + finalReturnTime).toFixed(1)),
          totalVisitTimeMinutes: currentVisitMinutes,
          totalWorkTimeMinutes: Number((currentTravelMinutes + finalReturnTime + currentVisitMinutes).toFixed(1))
        });
      }
    }

    const unallocatedVisits: UnallocatedVisit[] = unassignedCandidates
      .filter(c => !allocatedCandidateIds.has(c.id))
      .map(c => ({
        visitCandidateId: c.id,
        patientId: c.patientId,
        conditionId: c.conditionId,
        reason: 'Capacidade insuficiente na jornada das equipes'
      }));

    return {
      routes,
      unallocatedVisits
    };
  }
};
