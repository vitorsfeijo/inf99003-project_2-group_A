import { RoutingStrategy, PlanningContext, DailyTeamRoute, UnallocatedVisit, PlannedVisit } from '../types/index.js';
import { differenceInCalendarDays } from '../demand/dates.js';

/**
 * Heurística Principal de Roteamento com Antecipação (horizonte móvel N e limite A)
 */
export const MainHeuristicStrategy: RoutingStrategy = {
  id: 'main-heuristic',
  name: 'Heurística Principal (Custo Incremental e Antecipação)',
  description: 'Selecção por urgência e prazo futuro com inserção de menor custo incremental e limite de antecipação (A).',

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

        let insertionPossible = true;

        while (insertionPossible) {
          // Candidatos elegíveis (atrasados/hoje OU futuros dentro do limite A)
          const eligibleCandidates = unassignedCandidates.filter(c => {
            if (allocatedCandidateIds.has(c.id)) return false;
            const daysDiff = differenceInCalendarDays(c.dueDate, day);
            // Vencidos (daysDiff <= 0) ou Futuros antecipáveis (0 < daysDiff <= maxAnticipationDays)
            return daysDiff <= scenario.maxAnticipationDays;
          });

          if (eligibleCandidates.length === 0) {
            insertionPossible = false;
            break;
          }

          let bestCandidate: typeof eligibleCandidates[0] | null = null;
          let bestInsertIndex = -1;
          let bestScore = -Infinity;
          let bestTravelTimeToAdd = 0;
          let bestTravelDistToAdd = 0;

          for (const cand of eligibleCandidates) {
            const candNodeIdx = nodeIndexMap.get(cand.patientId);
            if (candNodeIdx === undefined) continue;

            const daysDiff = differenceInCalendarDays(cand.dueDate, day);
            const isOverdue = daysDiff <= 0;
            const overdueDays = Math.max(0, -daysDiff);

            // Bônus de urgência alto para vencidos (impede que futuras furem a fila sem justificativa)
            const urgencyScore = isOverdue ? (1000 + overdueDays * 100 + cand.priorityScore) : (cand.priorityScore - daysDiff * 10);

            const visitDuration = cand.durationMinutes || 30;

            // Testar todas as posições de inserção possíveis na rota atual (0 até visits.length)
            for (let pos = 0; pos <= currentVisits.length; pos++) {
              const prevNodeIdx = pos === 0 ? depotIdx : (nodeIndexMap.get(currentVisits[pos - 1].patientId) ?? depotIdx);
              const nextNodeIdx = pos === currentVisits.length ? depotIdx : (nodeIndexMap.get(currentVisits[pos].patientId) ?? depotIdx);

              // Custo incremental = d(prev, cand) + d(cand, next) - d(prev, next)
              const timePrevToCand = costMatrix.timeMatrix[prevNodeIdx][candNodeIdx];
              const timeCandToNext = costMatrix.timeMatrix[candNodeIdx][nextNodeIdx];
              const timePrevToNext = costMatrix.timeMatrix[prevNodeIdx][nextNodeIdx];

              const incrementalTime = timePrevToCand + timeCandToNext - timePrevToNext;

              if (currentWorkMinutes + incrementalTime + visitDuration <= team.dailyWorkMinutes) {
                // Função de pontuação: Urgência - Custo Incremental (ponderado)
                const score = urgencyScore - (incrementalTime * 2.0);

                if (score > bestScore) {
                  bestScore = score;
                  bestCandidate = cand;
                  bestInsertIndex = pos;
                  bestTravelTimeToAdd = incrementalTime;

                  const distPrevToCand = costMatrix.distanceMatrix[prevNodeIdx][candNodeIdx];
                  const distCandToNext = costMatrix.distanceMatrix[candNodeIdx][nextNodeIdx];
                  const distPrevToNext = costMatrix.distanceMatrix[prevNodeIdx][nextNodeIdx];
                  bestTravelDistToAdd = distPrevToCand + distCandToNext - distPrevToNext;
                }
              }
            }
          }

          if (bestCandidate && bestInsertIndex !== -1) {
            const visitDuration = bestCandidate.durationMinutes || 30;

            const newVisit: PlannedVisit = {
              visitCandidateId: bestCandidate.id,
              patientId: bestCandidate.patientId,
              conditionId: bestCandidate.conditionId,
              durationMinutes: visitDuration,
              estimatedStartTime: '',
              estimatedEndTime: '',
              travelTimeMinutesFromPrevious: 0,
              travelDistanceKmFromPrevious: 0
            };

            currentVisits.splice(bestInsertIndex, 0, newVisit);
            currentWorkMinutes += bestTravelTimeToAdd + visitDuration;
            currentTravelMinutes += bestTravelTimeToAdd;
            currentVisitMinutes += visitDuration;
            currentDistKm += bestTravelDistToAdd;

            allocatedCandidateIds.add(bestCandidate.id);
          } else {
            insertionPossible = false;
          }
        }

        // Recomputar tempos/distâncias exatos da sequência final da rota
        let prevNode = depotIdx;
        let routeDist = 0;
        let routeTravelTime = 0;

        const updatedVisits: PlannedVisit[] = currentVisits.map(v => {
          const currNode = nodeIndexMap.get(v.patientId) ?? depotIdx;
          const dist = costMatrix.distanceMatrix[prevNode][currNode];
          const time = costMatrix.timeMatrix[prevNode][currNode];

          routeDist += dist;
          routeTravelTime += time;
          prevNode = currNode;

          return {
            ...v,
            travelTimeMinutesFromPrevious: Number(time.toFixed(1)),
            travelDistanceKmFromPrevious: Number(dist.toFixed(2))
          };
        });

        // Retorno ao posto
        const returnDist = costMatrix.distanceMatrix[prevNode][depotIdx];
        const returnTime = costMatrix.timeMatrix[prevNode][depotIdx];
        routeDist += returnDist;
        routeTravelTime += returnTime;

        routes.push({
          date: day,
          teamId: team.id,
          visits: updatedVisits,
          totalDistanceKm: Number(routeDist.toFixed(2)),
          totalTravelTimeMinutes: Number(routeTravelTime.toFixed(1)),
          totalVisitTimeMinutes: currentVisitMinutes,
          totalWorkTimeMinutes: Number((routeTravelTime + currentVisitMinutes).toFixed(1))
        });
      }
    }

    const unallocatedVisits: UnallocatedVisit[] = unassignedCandidates
      .filter(c => !allocatedCandidateIds.has(c.id))
      .map(c => ({
        visitCandidateId: c.id,
        patientId: c.patientId,
        conditionId: c.conditionId,
        reason: 'Não coube na capacidade da janela sem violar limite de antecipação ou limite de jornada'
      }));

    return {
      routes,
      unallocatedVisits
    };
  }
};
