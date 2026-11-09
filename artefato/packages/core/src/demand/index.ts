import { Patient, VisitCandidate, Scenario } from '../types/index.js';
import { addCalendarDays, differenceInCalendarDays, getWorkingDaysHorizon } from './dates.js';

export interface DemandGenerationResult {
  candidates: VisitCandidate[];
  workingDays: string[];
}

/** Condição usada quando um paciente só tem prazo rígido, sem condição clínica cadastrada. */
export const HARD_DEADLINE_CONDITION_ID = 'prazo_rigido';

/**
 * Motor de Geração de Demanda:
 * 1. Calcula o prazo (dueDate) de cada condição por paciente (em dias corridos).
 * 2. Agrupa condições atendidas na mesma visita (priorizando a condição com prazo mais urgente).
 * 3. Classifica visitas como vencidas, devidas hoje ou futuras.
 * 4. Aplica a limitação de antecipação máxima (A) em dias corridos.
 * 5. Aplica a margem de segurança (prazo de planejamento), a folga entre visitas e o prazo rígido.
 */
export function generateDemandCandidates(
  scenario: Scenario,
  eligiblePatients: Patient[]
): DemandGenerationResult {
  const workingDays = getWorkingDaysHorizon(scenario.startDate, scenario.planningHorizonDays);
  const lastWorkingDay = workingDays[workingDays.length - 1];
  const maxAnticipatedDate = addCalendarDays(lastWorkingDay, scenario.maxAnticipationDays);
  const safetyMarginDays = Math.max(0, scenario.deadlineSafetyMarginDays ?? 0);
  const bufferMinutes = Math.max(0, scenario.visitBufferMinutes ?? 0);

  const candidates: VisitCandidate[] = [];

  for (const patient of eligiblePatients) {
    const conditions = patient.conditions?.length
      ? patient.conditions
      : patient.hardDeadline
        ? [{ conditionId: HARD_DEADLINE_CONDITION_ID, initialDueDate: patient.hardDeadline, maxIntervalDays: 0, priorityWeight: 1 }]
        : [];
    if (conditions.length === 0) {
      continue;
    }

    // 1. Determinar o prazo de cada condição do paciente
    const conditionPrazos = conditions.map(cond => {
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

    // A margem de segurança antecipa o prazo usado no planejamento; as métricas seguem o prazo real.
    const targetDate = safetyMarginDays ? addCalendarDays(primaryCondition.dueDate, -safetyMarginDays) : primaryCondition.dueDate;
    // Um prazo rígido já vencido passa a valer para o primeiro dia útil da janela.
    const hardDeadline = patient.hardDeadline
      ? (differenceInCalendarDays(patient.hardDeadline, workingDays[0]) < 0 ? workingDays[0] : patient.hardDeadline)
      : undefined;

    // 3. Verificar se a visita entra na janela aceitável (vencida, vence hoje, dentro da antecipação A ou com prazo rígido)
    const daysUntilDue = differenceInCalendarDays(targetDate, scenario.startDate);
    const isWithinAnticipationLimit = differenceInCalendarDays(targetDate, maxAnticipatedDate) <= 0;

    if (daysUntilDue <= 0 || isWithinAnticipationLimit || hardDeadline) {
      candidates.push({
        id: `cand_${patient.id}_${primaryCondition.conditionId}`,
        patientId: patient.id,
        conditionId: primaryCondition.conditionId,
        dueDate: primaryCondition.dueDate,
        targetDate,
        priorityScore: primaryCondition.priorityScore,
        durationMinutes: (patient.defaultVisitDurationMinutes || 30) + bufferMinutes,
        ...(bufferMinutes ? { bufferMinutes } : {}),
        ...(hardDeadline ? { hardDeadline } : {}),
        ...(patient.requiredProfessions?.length ? { requiredProfessions: [...patient.requiredProfessions] } : {}),
        ...(patient.assignedTeamId ? { assignedTeamId: patient.assignedTeamId } : {}),
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
