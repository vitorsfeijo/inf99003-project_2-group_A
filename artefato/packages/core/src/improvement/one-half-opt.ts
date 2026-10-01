import { DailyTeamRoute, CostMatrix, PlannedVisit } from '../types/index.js';

/**
 * Algoritmo 1.5-Opt para Otimização Intra-Rota (Etapa 5 do Pipeline)
 * Combina reinserção de um nó com inversão de sub-segmentos (operação 2-opt),
 * formando o 1.5-opt oficial do projeto,
 * visando reduzir o tempo/distância total de deslocamento dentro de uma mesma rota diária.
 */
export function apply1Point5Opt(route: DailyTeamRoute, costMatrix: CostMatrix): DailyTeamRoute {
  if (!route.visits || route.visits.length <= 2) {
    return route;
  }

  const nodeIndexMap = new Map(costMatrix.nodeIds.map((id, index) => [id, index]));
  const depotIdx = 0;

  let currentVisits = [...route.visits];
  let improved = true;

  const calculateRouteTime = (visits: PlannedVisit[]): number => {
    let time = 0;
    let prevIdx = depotIdx;

    for (const v of visits) {
      const currIdx = nodeIndexMap.get(v.patientId) ?? 0;
      time += costMatrix.timeMatrix[prevIdx][currIdx];
      time += v.durationMinutes || 0;
      prevIdx = currIdx;
    }

    time += costMatrix.timeMatrix[prevIdx][depotIdx];
    return time;
  };

  let bestTime = calculateRouteTime(currentVisits);

  while (improved) {
    improved = false;

    // --- PASSO 1: 1-Point Relocate (Mover um único nó para outra posição da rota) ---
    for (let i = 0; i < currentVisits.length; i++) {
      for (let j = 0; j <= currentVisits.length; j++) {
        if (j === i || j === i + 1) continue;

        const candidate = currentVisits[i];
        const tempVisits = currentVisits.filter((_, idx) => idx !== i);
        const insertPos = j > i ? j - 1 : j;
        tempVisits.splice(insertPos, 0, candidate);

        const newTime = calculateRouteTime(tempVisits);
        if (newTime < bestTime - 1e-4) {
          bestTime = newTime;
          currentVisits = tempVisits;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }

    if (improved) continue;

    // --- PASSO 2: Inversão de sub-segmentos ---
    for (let i = 0; i < currentVisits.length - 1; i++) {
      for (let k = i + 1; k < currentVisits.length; k++) {
        const tempVisits = [
          ...currentVisits.slice(0, i),
          ...currentVisits.slice(i, k + 1).reverse(),
          ...currentVisits.slice(k + 1)
        ];

        const newTime = calculateRouteTime(tempVisits);
        if (newTime < bestTime - 1e-4) {
          bestTime = newTime;
          currentVisits = tempVisits;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  // Recomputar distâncias e horários finais após otimização 1.5-opt
  let prevIdx = depotIdx;
  let accumulatedTimeMinutes = 0;
  let totalDistKm = 0;
  let totalTravelTimeMinutes = 0;
  let totalVisitTimeMinutes = 0;

  const updatedVisits: PlannedVisit[] = currentVisits.map(v => {
    const currIdx = nodeIndexMap.get(v.patientId) ?? 0;
    const travelDist = costMatrix.distanceMatrix[prevIdx][currIdx];
    const travelTime = costMatrix.timeMatrix[prevIdx][currIdx];

    totalDistKm += travelDist;
    totalTravelTimeMinutes += travelTime;
    totalVisitTimeMinutes += v.durationMinutes || 0;

    accumulatedTimeMinutes += travelTime;
    const startTimeStr = formatMinutesToTime(accumulatedTimeMinutes);
    accumulatedTimeMinutes += v.durationMinutes || 0;
    const endTimeStr = formatMinutesToTime(accumulatedTimeMinutes);

    prevIdx = currIdx;

    return {
      ...v,
      estimatedStartTime: startTimeStr,
      estimatedEndTime: endTimeStr,
      travelTimeMinutesFromPrevious: Number(travelTime.toFixed(1)),
      travelDistanceKmFromPrevious: Number(travelDist.toFixed(2))
    };
  });

  const returnDist = costMatrix.distanceMatrix[prevIdx][depotIdx];
  const returnTime = costMatrix.timeMatrix[prevIdx][depotIdx];
  totalDistKm += returnDist;
  totalTravelTimeMinutes += returnTime;

  return {
    ...route,
    visits: updatedVisits,
    totalDistanceKm: Number(totalDistKm.toFixed(2)),
    totalTravelTimeMinutes: Number(totalTravelTimeMinutes.toFixed(1)),
    totalVisitTimeMinutes,
    totalWorkTimeMinutes: Number((totalTravelTimeMinutes + totalVisitTimeMinutes).toFixed(1))
  };
}

function formatMinutesToTime(minutes: number): string {
  const startHour = 8;
  const totalMin = startHour * 60 + Math.round(minutes);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
