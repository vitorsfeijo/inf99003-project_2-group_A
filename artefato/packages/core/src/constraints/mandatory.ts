import { DailyTeamRoute, PlannedVisit, PlanningContext, RoutingStrategy, Team, UnallocatedVisit, VisitCandidate } from '../types/index.js';
import { differenceInCalendarDays } from '../demand/dates.js';
import { canVisitOnRoute, isPatientAvailable, teamCanServe } from './index.js';
import { nodeIndexByPatient, rebuildRoute, routeServiceMinutes, routeTravelMinutes, toPlannedVisit } from '../improvement/route-utils.js';

type RouteSolution = ReturnType<RoutingStrategy['solve']>;

export const DISPLACED_BY_MANDATORY_REASON = 'Deslocada para abrir espaço a uma visita com prazo rígido';

/** Peso clínico da condição principal do candidato (mínimo 1). */
export function candidatePriority(context: PlanningContext, candidate: VisitCandidate): number {
  const condition = context.scenario.patients.find(patient => patient.id === candidate.patientId)
    ?.conditions.find(item => item.conditionId === candidate.conditionId);
  return Math.max(1, condition?.priorityWeight ?? 1);
}

/** Prazo rígido que precisa ser cumprido dentro desta janela de planejamento. */
export function bindingDeadline(candidate: VisitCandidate, workingDays: string[]): string | undefined {
  if (!candidate.hardDeadline) return undefined;
  return differenceInCalendarDays(candidate.hardDeadline, workingDays[workingDays.length - 1]) <= 0 ? candidate.hardDeadline : undefined;
}

/**
 * Garante as visitas com prazo rígido (âncoras e prazos máximos) depois de qualquer estratégia.
 * Para cada uma, em ordem de prazo: mantém se já está numa rota permitida; senão insere na rota
 * permitida mais barata; se a jornada estiver cheia, retira as visitas sem prazo rígido de menor
 * prioridade e tenta realocá-las em outro dia. Quando nem assim cabe, a visita fica pendente com
 * o motivo explícito e o plano recebe um aviso. Sem visitas obrigatórias, devolve a solução intacta.
 */
export function enforceMandatoryVisits(context: PlanningContext, solution: RouteSolution): RouteSolution & { warnings: string[] } {
  const { scenario, costMatrix, candidates, workingDays } = context;
  const mandatory = candidates.filter(candidate => bindingDeadline(candidate, workingDays));
  if (!mandatory.length) return { ...solution, warnings: [] };

  const nodeByPatient = nodeIndexByPatient(costMatrix);
  const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const teamById = new Map(scenario.teams.map(team => [team.id, team]));
  const routes: DailyTeamRoute[] = solution.routes.map(route => ({ ...route, visits: [...route.visits] }));
  let pending: UnallocatedVisit[] = [...solution.unallocatedVisits];
  const changed = new Set<number>();
  const warnings: string[] = [];
  const patientCode = (patientId: string) => scenario.patients.find(patient => patient.id === patientId)?.code ?? patientId;

  const teamOf = (route: DailyTeamRoute): Team => {
    const team = teamById.get(route.teamId);
    if (!team) throw new Error(`Equipe ${route.teamId} ausente do cenário.`);
    return team;
  };
  const fits = (route: DailyTeamRoute, visits: PlannedVisit[]) =>
    routeTravelMinutes(visits, costMatrix, nodeByPatient) + routeServiceMinutes(visits) <= teamOf(route).dailyWorkMinutes + 1e-6;

  /** Melhor posição (menor acréscimo de caminhada; empate pelo dia mais cedo) entre as rotas permitidas. */
  const cheapestInsertion = (candidate: VisitCandidate, routeIndexes: number[]) => {
    let best: { route: number; position: number; delta: number } | undefined;
    const visit = toPlannedVisit(candidate);
    for (const routeIndex of routeIndexes) {
      const route = routes[routeIndex];
      if (route.visits.some(item => item.patientId === candidate.patientId)) continue;
      const before = routeTravelMinutes(route.visits, costMatrix, nodeByPatient);
      for (let position = 0; position <= route.visits.length; position++) {
        const withVisit = [...route.visits];
        withVisit.splice(position, 0, visit);
        if (!fits(route, withVisit)) continue;
        const delta = routeTravelMinutes(withVisit, costMatrix, nodeByPatient) - before;
        if (!best || delta < best.delta - 1e-6 ||
            (Math.abs(delta - best.delta) <= 1e-6 && route.date < routes[best.route].date)) {
          best = { route: routeIndex, position, delta };
        }
      }
    }
    return best ? { ...best, visit } : undefined;
  };

  const allowedRoutes = (candidate: VisitCandidate) => routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => canVisitOnRoute(candidate, route, teamOf(route), scenario))
    .map(({ index }) => index);

  const ordered = [...mandatory].sort((a, b) => (a.hardDeadline ?? '').localeCompare(b.hardDeadline ?? '')
    || candidatePriority(context, b) - candidatePriority(context, a) || a.id.localeCompare(b.id));

  for (const candidate of ordered) {
    const routeIndex = routes.findIndex(route => route.visits.some(visit => visit.visitCandidateId === candidate.id));
    if (routeIndex >= 0) {
      const route = routes[routeIndex];
      if (canVisitOnRoute(candidate, route, teamOf(route), scenario)) {
        route.visits = route.visits.map(visit => visit.visitCandidateId === candidate.id ? { ...visit, mandatory: true } : visit);
        changed.add(routeIndex);
        continue;
      }
      route.visits = route.visits.filter(visit => visit.visitCandidateId !== candidate.id);
      changed.add(routeIndex);
    }
    pending = pending.filter(item => item.visitCandidateId !== candidate.id);

    const allowed = allowedRoutes(candidate);
    const direct = cheapestInsertion(candidate, allowed);
    if (direct) {
      routes[direct.route].visits.splice(direct.position, 0, direct.visit);
      changed.add(direct.route);
      continue;
    }

    // Abrir espaço: retirar visitas sem prazo rígido, das menos prioritárias para as mais prioritárias.
    let bestDisplacement: { route: number; removed: PlannedVisit[]; cost: number } | undefined;
    for (const index of allowed) {
      const route = routes[index];
      if (route.visits.some(item => item.patientId === candidate.patientId)) continue;
      const removable = route.visits
        .filter(visit => !candidateById.get(visit.visitCandidateId)?.hardDeadline)
        .sort((a, b) => {
          const first = candidateById.get(a.visitCandidateId);
          const second = candidateById.get(b.visitCandidateId);
          if (!first || !second) throw new Error('Visita planejada ausente da demanda.');
          return candidatePriority(context, first) - candidatePriority(context, second)
            || second.targetDate.localeCompare(first.targetDate) || a.visitCandidateId.localeCompare(b.visitCandidateId);
        });
      const removed: PlannedVisit[] = [];
      let remaining = [...route.visits];
      let placed = false;
      for (const visit of removable) {
        remaining = remaining.filter(item => item !== visit);
        removed.push(visit);
        const visitToAdd = toPlannedVisit(candidate);
        for (let position = 0; position <= remaining.length && !placed; position++) {
          const withVisit = [...remaining];
          withVisit.splice(position, 0, visitToAdd);
          placed = fits(route, withVisit);
        }
        if (placed) break;
      }
      if (!placed) continue;
      const cost = removed.reduce((sum, visit) => {
        const removedCandidate = candidateById.get(visit.visitCandidateId);
        if (!removedCandidate) throw new Error(`Visita ${visit.visitCandidateId} ausente da demanda.`);
        return sum + candidatePriority(context, removedCandidate) * 100 + 1;
      }, 0);
      if (!bestDisplacement || cost < bestDisplacement.cost) bestDisplacement = { route: index, removed, cost };
    }

    if (bestDisplacement) {
      const route = routes[bestDisplacement.route];
      route.visits = route.visits.filter(visit => !bestDisplacement.removed.includes(visit));
      const insertion = cheapestInsertion(candidate, [bestDisplacement.route]);
      if (!insertion) throw new Error(`Falha ao inserir a visita obrigatória ${candidate.id} após abrir espaço.`);
      route.visits.splice(insertion.position, 0, insertion.visit);
      changed.add(bestDisplacement.route);
      for (const displaced of bestDisplacement.removed) {
        const displacedCandidate = candidateById.get(displaced.visitCandidateId);
        if (!displacedCandidate) throw new Error(`Visita ${displaced.visitCandidateId} ausente da demanda.`);
        const reinsertion = cheapestInsertion(displacedCandidate, allowedRoutes(displacedCandidate));
        if (reinsertion) {
          routes[reinsertion.route].visits.splice(reinsertion.position, 0, reinsertion.visit);
          changed.add(reinsertion.route);
        } else {
          pending.push({ visitCandidateId: displacedCandidate.id, patientId: displacedCandidate.patientId,
            conditionId: displacedCandidate.conditionId, reason: DISPLACED_BY_MANDATORY_REASON });
        }
      }
      continue;
    }

    const anyTeam = scenario.teams.some(team => teamCanServe(team, candidate));
    const patientAway = !allowed.length && workingDays
      .filter(day => day <= (candidate.hardDeadline ?? day))
      .every(day => !isPatientAvailable(candidate, day));
    const reason = !anyTeam
      ? 'Prazo rígido sem equipe compatível (categorias exigidas, número de profissionais ou vínculo)'
      : patientAway
        ? `Prazo rígido até ${candidate.hardDeadline}, mas o paciente está indisponível em todos os dias até lá`
        : !allowed.length
          ? `Prazo rígido até ${candidate.hardDeadline} sem equipe disponível nesses dias`
          : `Prazo rígido até ${candidate.hardDeadline} não cabe na jornada, mesmo retirando visitas sem prazo rígido`;
    pending.push({ visitCandidateId: candidate.id, patientId: candidate.patientId, conditionId: candidate.conditionId,
      reason, mandatory: true });
    warnings.push(`Paciente ${patientCode(candidate.patientId)}: ${reason}.`);
  }

  for (const index of changed) {
    routes[index] = rebuildRoute(routes[index], routes[index].visits, costMatrix, nodeByPatient);
  }
  return { routes, unallocatedVisits: pending, warnings };
}
