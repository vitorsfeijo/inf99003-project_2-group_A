import { DailyTeamRoute, ProfessionId, Scenario, Team, VisitCandidate } from '../types/index.js';
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

export function isTeamAvailable(team: Team, date: string): boolean {
  return !team.availableDays || team.availableDays.length === 0 || team.availableDays.includes(date);
}

/** A equipe tem todas as categorias exigidas e respeita o vínculo do paciente. */
export function teamCanServe(team: Team, candidate: Pick<VisitCandidate, 'requiredProfessions' | 'assignedTeamId'>): boolean {
  if (candidate.assignedTeamId && candidate.assignedTeamId !== team.id) return false;
  const required = candidate.requiredProfessions ?? [];
  if (!required.length) return true;
  const available = new Set(teamProfessions(team));
  return required.every(profession => available.has(profession));
}

/**
 * Data permitida para a visita. Com prazo rígido, qualquer dia até o prazo serve;
 * sem ele, vale a antecipação máxima A em relação ao prazo de planejamento.
 */
export function isDateAllowed(candidate: VisitCandidate, date: string, scenario: Scenario): boolean {
  if (candidate.hardDeadline) return differenceInCalendarDays(date, candidate.hardDeadline) <= 0;
  return differenceInCalendarDays(candidate.targetDate, date) <= scenario.maxAnticipationDays;
}

/** Combina data, disponibilidade, categorias e vínculo para decidir se a rota pode receber a visita. */
export function canVisitOnRoute(candidate: VisitCandidate, route: DailyTeamRoute, team: Team, scenario: Scenario): boolean {
  return isTeamAvailable(team, route.date) && teamCanServe(team, candidate) && isDateAllowed(candidate, route.date, scenario);
}
