import { RoutingStrategy, PlanningContext, DailyTeamRoute, UnallocatedVisit, PlannedVisit } from '../types/index.js';
import { differenceInCalendarDays } from '../demand/dates.js';

/**
 * Baseline 2: Vizinho Mais Próximo Viável (Geográfico)
 * Constrói a rota diária adicionando iterativamente a visita pendente mais próxima da posição atual.
 */
export const NearestBaselineStrategy: RoutingStrategy = {
  id: 'nearest-baseline',
  name: 'Baseline Geográfico (Vizinho Próximo)',
  description: 'Construção gulosa de rotas priorizando a proximidade geográfica entre atendimentos.',

  solve(context: PlanningContext) {
    const { scenario, costMatrix, candidates, workingDays } = context;
    const nodeIndexMap = new Map(costMatrix.nodeIds.map((id, index) => [id, index]));
    const depotIdx = 0;

    const routes: DailyTeamRoute[] = [];
    const unassignedCandidates = [...candidates];
    const allocatedCandidateIds = new Set<string>();

    for (const day of workingDays) {
      const availableTeams = scenario.teams.filter(t => !t.availableDays || t.availableDays.length === 0 || t.availableDays.includes(day));

      for (const team of availableTeams) {
        let currentVisits: PlannedVisit[] = [];
        let currentWorkMinutes = 0;
        let currentDistKm = 0;
        let currentTravelMinutes = 0;
        let currentVisitMinutes = 0;
        let lastNodeIdx = depotIdx;

        let building = true;
        while (building) {
          // Candidatos pendentes elegíveis
          const eligibleNow = unassignedCandidates.filter(c =>
            !allocatedCandidateIds.has(c.id) && differenceInCalendarDays(c.dueDate, day) <= 0
          );

          if (eligibleNow.length === 0) {
            building = false;
            break;
          }

          // Encontrar o vizinho viável com menor tempo de deslocamento a partir de lastNodeIdx
          let bestCandidate: typeof eligibleNow[0] | null = null;
          let minTravelTime = Infinity;
          let bestNodeIdx = -1;

          for (const cand of eligibleNow) {
            const candNodeIdx = nodeIndexMap.get(cand.patientId);
            if (candNodeIdx === undefined) continue;

            const travelTime = costMatrix.timeMatrix[lastNodeIdx][candNodeIdx];
            const returnTime = costMatrix.timeMatrix[candNodeIdx][depotIdx];
            const visitDuration = cand.durationMinutes || 30;

            if (currentWorkMinutes + travelTime + visitDuration + returnTime <= team.dailyWorkMinutes) {
              if (travelTime < minTravelTime) {
                minTravelTime = travelTime;
                bestCandidate = cand;
                bestNodeIdx = candNodeIdx;
              }
            }
          }

          if (bestCandidate && bestNodeIdx !== -1) {
            const travelDist = costMatrix.distanceMatrix[lastNodeIdx][bestNodeIdx];
            const visitDuration = bestCandidate.durationMinutes || 30;

            currentVisits.push({
              visitCandidateId: bestCandidate.id,
              patientId: bestCandidate.patientId,
              conditionId: bestCandidate.conditionId,
              durationMinutes: visitDuration,
              estimatedStartTime: '',
              estimatedEndTime: '',
              travelTimeMinutesFromPrevious: Number(minTravelTime.toFixed(1)),
              travelDistanceKmFromPrevious: Number(travelDist.toFixed(2))
            });

            currentWorkMinutes += minTravelTime + visitDuration;
            currentTravelMinutes += minTravelTime;
            currentVisitMinutes += visitDuration;
            currentDistKm += travelDist;
            lastNodeIdx = bestNodeIdx;

            allocatedCandidateIds.add(bestCandidate.id);
          } else {
            building = false;
          }
        }

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
        reason: 'Sem capacidade ou fora de alcance geográfico viável na jornada'
      }));

    return {
      routes,
      unallocatedVisits
    };
  }
};
