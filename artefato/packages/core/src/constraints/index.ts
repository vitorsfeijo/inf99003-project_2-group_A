import { DailyTeamRoute, Patient, ProfessionId, Scenario, Team, UnavailablePeriod, VisitCandidate } from '../types/index.js';
import { differenceInCalendarDays } from '../demand/dates.js';

/**
 * Catálogo de categorias profissionais da Atenção Primária usadas na interface.
 * O ACS (Agente Comunitário de Saúde) é o profissional de referência das visitas
 * de acompanhamento no território; visitas sem exigência podem ser feitas por qualquer equipe.
 */
export const PROFESSIONS: { id: ProfessionId; label: string }[] = [
  { id: 'acs', label: 'Agente Comunitário de Saúde (ACS)' },
  { id: 'enfermagem', label: 'Enfermeiro(a)' },
  { id: 'tecnico_enfermagem', label: 'Técnico(a) de enfermagem' },
  { id: 'medicina', label: 'Médico(a)' },
  { id: 'odontologia', label: 'Cirurgião(ã)-dentista' },
  { id: 'saude_bucal', label: 'Técnico(a)/auxiliar de saúde bucal' },
  { id: 'servico_social', label: 'Assistente social' },
  { id: 'psicologia', label: 'Psicólogo(a)' },
  { id: 'fisioterapia', label: 'Fisioterapeuta' },
  { id: 'nutricao', label: 'Nutricionista' }
];

export function professionLabel(id: ProfessionId): string {
  return PROFESSIONS.find(profession => profession.id === id)?.label ?? id;
}

/** Categorias da equipe; equipes antigas, sem a lista, derivam dos nomes cadastrados. */
export function teamProfessions(team: Team): ProfessionId[] {
  if (team.professions) return team.professions;
  const derived: ProfessionId[] = [];
  if (team.doctorName) derived.push('medicina');
  if (team.nurseName) derived.push('enfermagem');
  if (team.socialWorkerName) derived.push('servico_social');
  return derived;
}

/** Profissionais de uma categoria na equipe (0 se a categoria não está presente). */
export function professionCount(team: Team, profession: ProfessionId): number {
  if (!teamProfessions(team).includes(profession)) return 0;
  const count = team.professionCounts?.[profession];
  return count !== undefined && Number.isFinite(count) && count >= 1 ? Math.floor(count) : 1;
}

/** Total de profissionais que saem juntos na equipe; toda equipe tem ao menos uma pessoa. */
export function teamStaffCount(team: Team): number {
  return Math.max(1, teamProfessions(team).reduce((sum, profession) => sum + professionCount(team, profession), 0));
}

/** Profissionais exigidos pela visita (padrão 1). */
export function requiredStaffCount(item: Pick<Patient, 'requiredStaffCount'>): number {
  const count = item.requiredStaffCount;
  return count !== undefined && Number.isFinite(count) && count > 1 ? Math.floor(count) : 1;
}

/**
 * Mínimo de profissionais da categoria exigido pela visita: 0 se a categoria não é exigida,
 * 1 se é exigida sem quantidade e a quantidade informada nos demais casos.
 */
export function requiredProfessionCount(item: Pick<Patient, 'requiredProfessions' | 'requiredProfessionCounts'>, profession: ProfessionId): number {
  const count = item.requiredProfessionCounts?.[profession];
  if (count !== undefined && Number.isFinite(count) && count >= 1) return Math.floor(count);
  return (item.requiredProfessions ?? []).includes(profession) ? 1 : 0;
}

/** Categorias exigidas pela visita, pela lista ou por uma quantidade mínima. */
export function requiredProfessionIds(item: Pick<Patient, 'requiredProfessions' | 'requiredProfessionCounts'>): ProfessionId[] {
  const ids = new Set(item.requiredProfessions ?? []);
  for (const [profession, count] of Object.entries(item.requiredProfessionCounts ?? {})) {
    if (count !== undefined && count >= 1) ids.add(profession);
  }
  return [...ids];
}

export function isTeamAvailable(team: Team, date: string): boolean {
  return !team.availableDays || team.availableDays.length === 0 || team.availableDays.includes(date);
}

/** Período de indisponibilidade do paciente que contém a data, se houver. */
export function unavailablePeriodOn(item: Pick<Patient, 'unavailablePeriods'>, date: string): UnavailablePeriod | undefined {
  return item.unavailablePeriods?.find(period => period.start <= date && date <= period.end);
}

/** O paciente pode ser visitado na data (sem ausência programada nem aviso de que estaria fora). */
export function isPatientAvailable(item: Pick<Patient, 'unavailablePeriods'>, date: string): boolean {
  return !unavailablePeriodOn(item, date);
}

type ServiceRequirements = Pick<VisitCandidate, 'requiredProfessions' | 'requiredProfessionCounts' | 'requiredStaffCount' | 'assignedTeamId'>;

/** A equipe tem todas as categorias exigidas (na quantidade exigida), profissionais suficientes e respeita o vínculo. */
export function teamCanServe(team: Team, candidate: ServiceRequirements): boolean {
  if (candidate.assignedTeamId && candidate.assignedTeamId !== team.id) return false;
  if (teamStaffCount(team) < requiredStaffCount(candidate)) return false;
  return requiredProfessionIds(candidate).every(profession => professionCount(team, profession) >= requiredProfessionCount(candidate, profession));
}

/** Explica, em uma frase, por que a equipe não atende a visita (ou undefined se atende). */
export function teamServiceGap(team: Team, candidate: ServiceRequirements): string | undefined {
  if (candidate.assignedTeamId && candidate.assignedTeamId !== team.id) return `o paciente é vinculado a outra equipe (${candidate.assignedTeamId})`;
  if (teamStaffCount(team) < requiredStaffCount(candidate)) {
    return `a equipe tem ${teamStaffCount(team)} profissional(is) e a visita exige ${requiredStaffCount(candidate)}`;
  }
  for (const profession of requiredProfessionIds(candidate)) {
    const needed = requiredProfessionCount(candidate, profession);
    const present = professionCount(team, profession);
    if (present < needed) {
      return present === 0
        ? `falta ${professionLabel(profession)}`
        : `a visita exige ${needed} ${professionLabel(profession)} e a equipe tem ${present}`;
    }
  }
  return undefined;
}

/**
 * Data permitida para a visita. Com prazo rígido, qualquer dia até o prazo serve;
 * sem ele, vale a antecipação máxima A em relação ao prazo de planejamento.
 * Em nenhum caso o paciente pode estar indisponível na data.
 */
export function isDateAllowed(candidate: VisitCandidate, date: string, scenario: Scenario): boolean {
  if (!isPatientAvailable(candidate, date)) return false;
  if (candidate.hardDeadline) return differenceInCalendarDays(date, candidate.hardDeadline) <= 0;
  return differenceInCalendarDays(candidate.targetDate, date) <= scenario.maxAnticipationDays;
}

/**
 * Duração e folga efetivas da próxima visita: o ajuste pontual vale sobre o valor permanente
 * do paciente, que vale sobre a folga geral do cenário.
 */
export function effectiveVisitTimes(patient: Pick<Patient, 'defaultVisitDurationMinutes' | 'visitBufferMinutes' | 'nextVisit'>,
  scenarioBufferMinutes = 0): { durationMinutes: number; bufferMinutes: number } {
  const durationMinutes = patient.nextVisit?.durationMinutes ?? (patient.defaultVisitDurationMinutes || 30);
  const bufferMinutes = Math.max(0, patient.nextVisit?.bufferMinutes ?? patient.visitBufferMinutes ?? scenarioBufferMinutes);
  return { durationMinutes, bufferMinutes };
}

/** Combina data, disponibilidade, categorias e vínculo para decidir se a rota pode receber a visita. */
export function canVisitOnRoute(candidate: VisitCandidate, route: DailyTeamRoute, team: Team, scenario: Scenario): boolean {
  return isTeamAvailable(team, route.date) && teamCanServe(team, candidate) && isDateAllowed(candidate, route.date, scenario);
}
