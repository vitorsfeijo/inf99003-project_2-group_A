import { DailyTeamRoute, UnallocatedVisit, VisitCandidate, PlanMetrics, Scenario } from '../types/index.js';
import { differenceInCalendarDays, getWorkingDaysHorizon } from '../demand/dates.js';

/**
 * Calculador de Métricas do Plano (Etapa 6 do Pipeline)
 */
export function calculatePlanMetrics(
  scenario: Scenario,
  routes: DailyTeamRoute[],
  unallocatedVisits: UnallocatedVisit[],
  candidates: VisitCandidate[]
): PlanMetrics {
  const totalCandidates = candidates.length;
  const totalAllocated = totalCandidates - unallocatedVisits.length;
  const coveragePercentage = totalCandidates > 0 ? (totalAllocated / totalCandidates) * 100 : 100;
  const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const priorityByCandidate = new Map(candidates.map(candidate => {
    const condition = scenario.patients.find(patient => patient.id === candidate.patientId)
      ?.conditions.find(item => item.conditionId === candidate.conditionId);
    return [candidate.id, Math.max(1, condition?.priorityWeight ?? 1)] as const;
  }));
  const totalPriority = candidates.reduce((sum, candidate) => sum + (priorityByCandidate.get(candidate.id) ?? 1), 0);
  const workingDays = getWorkingDaysHorizon(scenario.startDate, scenario.planningHorizonDays);
  const lastDay = workingDays[workingDays.length - 1];
  const delayBuckets = { onTime: 0, oneToTwoDays: 0, threeToSevenDays: 0, overSevenDays: 0, unallocated: unallocatedVisits.length };
  const allocatedDelays: number[] = [];
  let timelyPriority = 0;
  let promptPriority = 0;
  let allocatedPriority = 0;
  let weightedDelay = 0;
  let weightedActionableDelay = 0;

  let totalTravelDistanceKm = 0;
  let totalTravelTimeMinutes = 0;
  let totalOverdueDays = 0;

  const teamWorkMinutes: number[] = [];
  const teamMaxMinutes: number[] = [];

  for (const route of routes) {
    totalTravelDistanceKm += route.totalDistanceKm;
    totalTravelTimeMinutes += route.totalTravelTimeMinutes;

    const team = scenario.teams.find(t => t.id === route.teamId);
    if (team) {
      teamWorkMinutes.push(route.totalWorkTimeMinutes);
      teamMaxMinutes.push(team.dailyWorkMinutes);
    }

    for (const visit of route.visits) {
      const candidate = candidateById.get(visit.visitCandidateId);
      if (candidate) {
        const overdue = Math.max(0, differenceInCalendarDays(route.date, candidate.dueDate));
        totalOverdueDays += overdue;
        const priority = priorityByCandidate.get(candidate.id) ?? 1;
        allocatedPriority += priority;
        weightedDelay += priority * overdue;
        const actionableDelay = Math.max(0, differenceInCalendarDays(route.date,
          candidate.dueDate < scenario.startDate ? scenario.startDate : candidate.dueDate));
        weightedActionableDelay += priority * actionableDelay;
        if (actionableDelay === 0) promptPriority += priority;
        allocatedDelays.push(overdue);
        if (overdue === 0) {
          delayBuckets.onTime++;
          timelyPriority += priorityByCandidate.get(candidate.id) ?? 1;
        } else if (overdue <= 2) delayBuckets.oneToTwoDays++;
        else if (overdue <= 7) delayBuckets.threeToSevenDays++;
        else delayBuckets.overSevenDays++;
      }
    }
  }

  // Soma dos atrasos de visitas que ficaram sem alocação no final da janela
  for (const unallocated of unallocatedVisits) {
    const candidate = candidateById.get(unallocated.visitCandidateId);
    if (candidate) {
      const overdue = Math.max(0, differenceInCalendarDays(lastDay, candidate.dueDate));
      totalOverdueDays += overdue;
      weightedDelay += (priorityByCandidate.get(candidate.id) ?? 1) * overdue;
      weightedActionableDelay += (priorityByCandidate.get(candidate.id) ?? 1) * Math.max(0,
        differenceInCalendarDays(lastDay, candidate.dueDate < scenario.startDate ? scenario.startDate : candidate.dueDate));
    }
  }

  allocatedDelays.sort((a, b) => a - b);
  const p90AllocatedDelayDays = allocatedDelays.length
    ? allocatedDelays[Math.ceil(allocatedDelays.length * 0.9) - 1] : 0;
  const onTimeCoveragePercentage = totalCandidates ? delayBuckets.onTime / totalCandidates * 100 : 100;
  const priorityWeightedCoveragePercentage = totalPriority ? allocatedPriority / totalPriority * 100 : 100;
  const priorityWeightedOnTimeCoveragePercentage = totalPriority ? timelyPriority / totalPriority * 100 : 100;
  const priorityWeightedPromptCoveragePercentage = totalPriority ? promptPriority / totalPriority * 100 : 100;
  const priorityWeightedAverageDelayDays = totalPriority ? weightedDelay / totalPriority : 0;
  const priorityWeightedActionableDelayDays = totalPriority ? weightedActionableDelay / totalPriority : 0;
  const distancePerAllocatedVisitKm = totalAllocated > 0 ? totalTravelDistanceKm / totalAllocated : 0;
  const travelTimePerAllocatedVisitMinutes = totalAllocated > 0 ? totalTravelTimeMinutes / totalAllocated : 0;
  const timelyPriorityPointsPerKm = totalTravelDistanceKm > 0 ? timelyPriority / totalTravelDistanceKm : 0;
  const priorityPointsPerKm = totalTravelDistanceKm > 0 ? allocatedPriority / totalTravelDistanceKm : 0;

  // Utilização média das equipes
  let teamUtilizationPercentage = 0;
  if (teamWorkMinutes.length > 0) {
    const utilizations = teamWorkMinutes.map((work, idx) => (work / (teamMaxMinutes[idx] || 1)) * 100);
    teamUtilizationPercentage = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
  }

  // Desequilíbrio de carga (Desvio Padrão do tempo de trabalho)
  let teamWorkloadImbalance = 0;
  if (teamWorkMinutes.length > 1) {
    const mean = teamWorkMinutes.reduce((a, b) => a + b, 0) / teamWorkMinutes.length;
    const variance = teamWorkMinutes.reduce((sum, val) => sum + (val - mean) ** 2, 0) / teamWorkMinutes.length;
    teamWorkloadImbalance = Math.sqrt(variance);
  }

  return {
    coveragePercentage: Number(coveragePercentage.toFixed(2)),
    onTimeCoveragePercentage: Number(onTimeCoveragePercentage.toFixed(2)),
    priorityWeightedCoveragePercentage: Number(priorityWeightedCoveragePercentage.toFixed(2)),
    priorityWeightedOnTimeCoveragePercentage: Number(priorityWeightedOnTimeCoveragePercentage.toFixed(2)),
    priorityWeightedPromptCoveragePercentage: Number(priorityWeightedPromptCoveragePercentage.toFixed(2)),
    priorityWeightedAverageDelayDays: Number(priorityWeightedAverageDelayDays.toFixed(2)),
    priorityWeightedActionableDelayDays: Number(priorityWeightedActionableDelayDays.toFixed(2)),
    p90AllocatedDelayDays,
    delayBuckets,
    distancePerAllocatedVisitKm: Number(distancePerAllocatedVisitKm.toFixed(2)),
    travelTimePerAllocatedVisitMinutes: Number(travelTimePerAllocatedVisitMinutes.toFixed(2)),
    timelyPriorityPointsPerKm: Number(timelyPriorityPointsPerKm.toFixed(2)),
    priorityPointsPerKm: Number(priorityPointsPerKm.toFixed(2)),
    totalOverdueDays,
    totalTravelDistanceKm: Number(totalTravelDistanceKm.toFixed(2)),
    totalTravelTimeMinutes: Number(totalTravelTimeMinutes.toFixed(2)),
    teamUtilizationPercentage: Number(teamUtilizationPercentage.toFixed(2)),
    teamWorkloadImbalance: Number(teamWorkloadImbalance.toFixed(2))
  };
}
