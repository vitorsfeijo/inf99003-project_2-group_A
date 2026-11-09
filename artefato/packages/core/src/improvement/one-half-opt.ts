import { DailyTeamRoute, CostMatrix, PlannedVisit } from '../types/index.js';
import { nodeIndexByPatient, rebuildRoute } from './route-utils.js';

/**
 * Algoritmo 1.5-Opt para Otimização Intra-Rota (Etapa 5 do Pipeline)
 * Combina reinserção de um nó com inversão de sub-segmentos (operação 2-opt),
 * formando o 1.5-opt oficial do projeto,
 * visando reduzir o tempo/distância total de deslocamento dentro de uma mesma rota diária.
 */
export function apply1Point5Opt(route: DailyTeamRoute, costMatrix: CostMatrix): DailyTeamRoute {
  const nodeIndexMap = nodeIndexByPatient(costMatrix);
  // Com até duas visitas não há reordenação útil; apenas preenche horários e totais.
  if (!route.visits || route.visits.length <= 2) {
    return rebuildRoute(route, route.visits ?? [], costMatrix, nodeIndexMap);
  }

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
  return rebuildRoute(route, currentVisits, costMatrix, nodeIndexMap);
}
