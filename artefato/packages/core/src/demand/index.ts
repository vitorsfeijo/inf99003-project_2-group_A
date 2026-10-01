import { Patient, VisitCandidate, Scenario } from '../types/index.js';
import { addCalendarDays, differenceInCalendarDays, getWorkingDaysHorizon } from './dates.js';

export interface DemandGenerationResult {
  candidates: VisitCandidate[];
  workingDays: string[];
}

/**
 * Motor de Geração de Demanda:
 * 1. Calcula o prazo (dueDate) de cada condição por paciente (em dias corridos).
 * 2. Agrupa condições atendidas na mesma visita (priorizando a condição com prazo mais urgente).
 * 3. Classifica visitas como vencidas, devidas hoje ou futuras.
 * 4. Aplica a limitação de antecipação máxima (A) em dias corridos.
 */
export function generateDemandCandidates(
  scenario: Scenario,
  eligiblePatients: Patient[]
): DemandGenerationResult {
  const workingDays = getWorkingDaysHorizon(scenario.startDate, scenario.planningHorizonDays);
  const lastWorkingDay = workingDays[workingDays.length - 1];
  const maxAnticipatedDate = addCalendarDays(lastWorkingDay, scenario.maxAnticipationDays);

  const candidates: VisitCandidate[] = [];

  for (const patient of eligiblePatients) {
    if (!patient.conditions || patient.conditions.length === 0) {
      continue;
    }

    // 1. Determinar o prazo de cada condição do paciente
    const conditionPrazos = patient.conditions.map(cond => {
      let dueDateStr: string;

      if (cond.lastVisitDate) {
        dueDateStr = addCalendarDays(cond.lastVisitDate, cond.maxIntervalDays);
      } else if (cond.initialDueDate) {
        dueDateStr = cond.initialDueDate;
      } else {
        dueDateStr = scenario.startDate;
      }

      const overdueDays = Math.max(0, differenceInCalendarDays(scenario.startDate, dueDateStr));
      // Pontuação de urgência: atraso em dias * 10 + peso da condição * 5
      const priorityScore = (overdueDays * 10) + (cond.priorityWeight * 5);

      return {
        conditionId: cond.conditionId,
        dueDate: dueDateStr,
        priorityScore,
        overdueDays,
        priorityWeight: cond.priorityWeight
      };
    });

    // 2. Agrupar condições: escolher a condição mais urgente como principal para o paciente
    conditionPrazos.sort((a, b) => {
      const diffDue = differenceInCalendarDays(a.dueDate, b.dueDate);
      if (diffDue !== 0) return diffDue; // Mais antiga primeiro
      return b.priorityScore - a.priorityScore; // Maior pontuação primeiro
    });

    const primaryCondition = conditionPrazos[0];

    // 3. Verificar se a visita entra na janela aceitável (vencida, vence hoje ou dentro da antecipação A)
    const daysUntilDue = differenceInCalendarDays(primaryCondition.dueDate, scenario.startDate);
    const isWithinAnticipationLimit = differenceInCalendarDays(primaryCondition.dueDate, maxAnticipatedDate) <= 0;

    if (daysUntilDue <= 0 || isWithinAnticipationLimit) {
      candidates.push({
        id: `cand_${patient.id}_${primaryCondition.conditionId}`,
        patientId: patient.id,
        conditionId: primaryCondition.conditionId,
        dueDate: primaryCondition.dueDate,
        priorityScore: primaryCondition.priorityScore,
        durationMinutes: patient.defaultVisitDurationMinutes || 30,
        isConditional: false
      });
    }
  }

  // Ordenar candidatos por urgência decrescente (maior prioridade primeiro)
  candidates.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    candidates,
    workingDays
  };
}
