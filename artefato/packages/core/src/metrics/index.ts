import { DailyTeamRoute, UnallocatedVisit, VisitCandidate, PlanMetrics, Scenario } from '../types/index.js';
import { differenceInCalendarDays } from '../demand/dates.js';

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
      const candidate = candidates.find(c => c.id === visit.visitCandidateId);
      if (candidate) {
        const overdue = Math.max(0, differenceInCalendarDays(route.date, candidate.dueDate));
        totalOverdueDays += overdue;
      }
    }
  }

  // Soma dos atrasos de visitas que ficaram sem alocação no final da janela
  for (const unallocated of unallocatedVisits) {
    const candidate = candidates.find(c => c.id === unallocated.visitCandidateId);
    if (candidate) {
      const lastDay = scenario.startDate;
      const overdue = Math.max(0, differenceInCalendarDays(lastDay, candidate.dueDate));
      totalOverdueDays += overdue;
    }
  }

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
    totalOverdueDays,
    totalTravelDistanceKm: Number(totalTravelDistanceKm.toFixed(2)),
    totalTravelTimeMinutes: Number(totalTravelTimeMinutes.toFixed(2)),
    teamUtilizationPercentage: Number(teamUtilizationPercentage.toFixed(2)),
    teamWorkloadImbalance: Number(teamWorkloadImbalance.toFixed(2))
  };
}
