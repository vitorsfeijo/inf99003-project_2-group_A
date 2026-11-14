import { Scenario, Plan, VerificationResult } from '../types/index.js';
import { validateScenario } from '../validation/scenario.js';
import { differenceInCalendarDays, getWorkingDaysHorizon } from '../demand/dates.js';
import { isTeamAvailable, requiredStaffCount, teamCanServe, teamServiceGap, teamStaffCount, unavailablePeriodOn } from '../constraints/index.js';

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
  const patientById = new Map(scenario.patients.map(patient => [patient.id, patient]));
  const teamMap = new Map(scenario.teams.map(t => [t.id, t]));
  const firstWorkingDay = getWorkingDaysHorizon(scenario.startDate, 1)[0];
  const visitedMandatory = new Set<string>();

  for (const route of plan.routes) {
    const team = teamMap.get(route.teamId);
    if (!team) {
      errors.push(`Rota do dia ${route.date} faz referência a uma equipe inexistente (id: ${route.teamId}).`);
      continue;
    }

    // 1. Verificação de disponibilidade da equipe
    if (!isTeamAvailable(team, route.date)) {
      errors.push(`A equipe ${team.name} recebeu uma rota no dia ${route.date}, mas não está disponível nesta data.`);
    }

    // 2. Verificação de limite da jornada diária (inclui a folga reservada entre visitas)
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

      // 4. Categorias profissionais exigidas e vínculo com equipe
      const patient = patientById.get(visit.patientId);
      if (patient && !teamCanServe(team, patient)) {
        errors.push(patient.assignedTeamId && patient.assignedTeamId !== team.id
          ? `O paciente ${patient.code} é vinculado à equipe ${patient.assignedTeamId}, mas foi visitado pela equipe ${team.name} em ${route.date}.`
          : teamStaffCount(team) < requiredStaffCount(patient)
            ? `A equipe ${team.name} tem ${teamStaffCount(team)} profissional(is), mas o paciente ${patient.code} exige ${requiredStaffCount(patient)} em ${route.date}.`
            : `A equipe ${team.name} não reúne as categorias exigidas pelo paciente ${patient.code} em ${route.date}: ${teamServiceGap(team, patient)}.`);
      }

      // 5. O paciente não pode estar ausente (férias, viagem, aviso de que estaria fora)
      const away = patient ? unavailablePeriodOn(patient, route.date) : undefined;
      if (patient && away) {
        errors.push(`O paciente ${patient.code} está indisponível em ${route.date}${away.reason ? ` (${away.reason})` : ''}, mas foi agendado pela equipe ${team.name}.`);
      }

      // 6. Prazo rígido: um prazo já vencido vale para o primeiro dia útil da janela
      if (patient?.hardDeadline) {
        const deadline = patient.hardDeadline < firstWorkingDay ? firstWorkingDay : patient.hardDeadline;
        visitedMandatory.add(patient.id);
        if (differenceInCalendarDays(route.date, deadline) > 0) {
          errors.push(`O paciente ${patient.code} tem prazo rígido até ${deadline}, mas foi agendado para ${route.date}.`);
        }
      }
    }
  }

  for (const unallocated of plan.unallocatedVisits) {
    if (unallocated.mandatory && !visitedMandatory.has(unallocated.patientId)) {
      warnings.push(`Prazo rígido não cumprido para o paciente ${patientById.get(unallocated.patientId)?.code ?? unallocated.patientId}: ${unallocated.reason}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
