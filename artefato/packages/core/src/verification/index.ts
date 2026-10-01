import { Scenario, Plan, VerificationResult } from '../types/index.js';
import { validateScenario } from '../validation/scenario.js';

/**
 * Verificador Formal de Restrições (Etapa 5 do Pipeline)
 * Garante que nenhuma rota violada seja aceita ou persistida.
 */
export function verifyPlan(scenario: Scenario, plan: Plan): VerificationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validation = validateScenario(scenario);
  if (!validation.isValid) {
    errors.push(...validation.errors);
  }

  const eligiblePatientIds = new Set(validation.eligiblePatients.map(p => p.id));
  const teamMap = new Map(scenario.teams.map(t => [t.id, t]));

  for (const route of plan.routes) {
    const team = teamMap.get(route.teamId);
    if (!team) {
      errors.push(`Rota do dia ${route.date} faz referência a uma equipe inexistente (id: ${route.teamId}).`);
      continue;
    }

    // 1. Verificação de disponibilidade da equipe
    if (team.availableDays && team.availableDays.length > 0 && !team.availableDays.includes(route.date)) {
      errors.push(`A equipe ${team.name} recebeu uma rota no dia ${route.date}, mas não está disponível nesta data.`);
    }

    // 2. Verificação de limite da jornada diária
    if (route.totalWorkTimeMinutes > team.dailyWorkMinutes) {
      errors.push(`A rota da equipe ${team.name} no dia ${route.date} excede a jornada diária (${route.totalWorkTimeMinutes} min > ${team.dailyWorkMinutes} min).`);
    }

    // 3. Verificação de unicidade e território dos pacientes na mesma rota
    const visitedPatientsToday = new Set<string>();
    for (const visit of route.visits) {
      if (visitedPatientsToday.has(visit.patientId)) {
        errors.push(`O paciente ${visit.patientId} foi visitado mais de uma vez no mesmo dia (${route.date}) pela equipe ${team.name}.`);
      }
      visitedPatientsToday.add(visit.patientId);

      if (!eligiblePatientIds.has(visit.patientId)) {
        errors.push(`O paciente ${visit.patientId} está fora do território e foi incluído na rota do dia ${route.date}.`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
