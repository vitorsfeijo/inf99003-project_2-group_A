import { CostMatrix, DailyTeamRoute, PlannedVisit, PlanningContext, RoutingStrategy, VisitCandidate } from '../types/index.js';
import { differenceInCalendarDays } from '../demand/dates.js';
import { apply1Point5Opt } from '../improvement/one-half-opt.js';
import { NearestBaselineStrategy } from './baseline-nearest.js';

// Uma unidade de prioridade clínica atrasada por um dia equivale a 12 minutos
// no objetivo de busca. É um parâmetro explícito, não uma métrica de resultado.
const MINUTES_PER_PRIORITY_DELAY_DAY = 12;
// Na segunda busca, responder prontamente a um ponto de prioridade vale 24
// minutos equivalentes, aproximadamente uma visita curta.
const MINUTES_PER_PROMPT_PRIORITY_POINT = 24;
const MAX_MOVES = 80;

function routeTravelMinutes(visits: PlannedVisit[], matrix: CostMatrix, nodeByPatient: Map<string, number>): number {
  let previous = 0;
  let total = 0;
  for (const visit of visits) {
    const node = nodeByPatient.get(visit.patientId);
    if (node === undefined) throw new Error(`Paciente ${visit.patientId} ausente da matriz viária.`);
    total += matrix.timeMatrix[previous][node];
    previous = node;
  }
  return total + matrix.timeMatrix[previous][0];
}

function routeDistanceKm(visits: PlannedVisit[], matrix: CostMatrix, nodeByPatient: Map<string, number>): number {
  let previous = 0;
  let total = 0;
  for (const visit of visits) {
    const node = nodeByPatient.get(visit.patientId);
    if (node === undefined) throw new Error(`Paciente ${visit.patientId} ausente da matriz viária.`);
    total += matrix.distanceMatrix[previous][node];
    previous = node;
  }
  return total + matrix.distanceMatrix[previous][0];
}

function rebuildRoute(route: DailyTeamRoute, visits: PlannedVisit[], matrix: CostMatrix, nodeByPatient: Map<string, number>): DailyTeamRoute {
  let previous = 0;
  let elapsed = 0;
  let distance = 0;
  let travel = 0;
  let service = 0;
  const updated = visits.map(visit => {
    const node = nodeByPatient.get(visit.patientId);
    if (node === undefined) throw new Error(`Paciente ${visit.patientId} ausente da matriz viária.`);
    const legMinutes = matrix.timeMatrix[previous][node];
    const legKm = matrix.distanceMatrix[previous][node];
    const duration = visit.durationMinutes ?? 30;
    travel += legMinutes;
    distance += legKm;
    elapsed += legMinutes;
    const start = formatTime(elapsed);
    elapsed += duration;
    service += duration;
    previous = node;
    return { ...visit, estimatedStartTime: start, estimatedEndTime: formatTime(elapsed),
      travelTimeMinutesFromPrevious: Number(legMinutes.toFixed(1)), travelDistanceKmFromPrevious: Number(legKm.toFixed(2)) };
  });
  travel += matrix.timeMatrix[previous][0];
  distance += matrix.distanceMatrix[previous][0];
  return { ...route, visits: updated, totalTravelTimeMinutes: Number(travel.toFixed(1)),
    totalDistanceKm: Number(distance.toFixed(2)), totalVisitTimeMinutes: service,
    totalWorkTimeMinutes: Number((travel + service).toFixed(1)) };
}

function formatTime(minutesFromStart: number): string {
  const minutes = 8 * 60 + Math.round(minutesFromStart);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function actionableDelay(date: string, candidate: VisitCandidate, startDate: string): number {
  return Math.max(0, differenceInCalendarDays(date, candidate.dueDate < startDate ? startDate : candidate.dueDate));
}

type RouteSolution = ReturnType<RoutingStrategy['solve']>;

function improveFromSeed(context: PlanningContext, seed: RouteSolution,
  recoverPending: boolean, promptWeight: number): RouteSolution {
    const { scenario, costMatrix, candidates } = context;
    const nodeByPatient = new Map(costMatrix.nodeIds.map((id, index) => [id, index]));
    const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
    const teamById = new Map(scenario.teams.map(team => [team.id, team]));
    const priorityById = new Map(candidates.map(candidate => {
      const condition = scenario.patients.find(patient => patient.id === candidate.patientId)
        ?.conditions.find(item => item.conditionId === candidate.conditionId);
      return [candidate.id, Math.max(1, condition?.priorityWeight ?? 1)] as const;
    }));
    const routes = seed.routes.map(route => apply1Point5Opt(
      rebuildRoute(route, route.visits, costMatrix, nodeByPatient), costMatrix));
    let pending = [...seed.unallocatedVisits];
    const insertPendingVisits = () => {
      const remaining = [] as typeof pending;
      const ordered = [...pending].sort((a, b) => {
        const priority = (priorityById.get(b.visitCandidateId) ?? 1) - (priorityById.get(a.visitCandidateId) ?? 1);
        if (priority !== 0) return priority;
        const first = candidateById.get(a.visitCandidateId);
        const second = candidateById.get(b.visitCandidateId);
        if (!first || !second) throw new Error('Visita pendente ausente da demanda.');
        return first.dueDate.localeCompare(second.dueDate) || a.visitCandidateId.localeCompare(b.visitCandidateId);
      });
      for (const unallocated of ordered) {
        const candidate = candidateById.get(unallocated.visitCandidateId);
        if (!candidate) throw new Error(`Visita ${unallocated.visitCandidateId} ausente da demanda.`);
        const visit: PlannedVisit = {
          visitCandidateId: candidate.id, patientId: candidate.patientId,
          conditionId: candidate.conditionId, durationMinutes: candidate.durationMinutes,
          estimatedStartTime: '', estimatedEndTime: '',
          travelTimeMinutesFromPrevious: 0, travelDistanceKmFromPrevious: 0
        };
        let best: { route: number; position: number; score: number } | undefined;
        for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
          const route = routes[routeIndex];
          if (differenceInCalendarDays(candidate.dueDate, route.date) > scenario.maxAnticipationDays ||
              route.visits.some(item => item.patientId === candidate.patientId)) continue;
          const team = teamById.get(route.teamId);
          if (!team) throw new Error(`Equipe ${route.teamId} ausente do cenário.`);
          const currentTravel = routeTravelMinutes(route.visits, costMatrix, nodeByPatient);
          const service = route.visits.reduce((sum, item) => sum + (item.durationMinutes ?? 30), 0);
          for (let position = 0; position <= route.visits.length; position++) {
            const withVisit = [...route.visits];
            withVisit.splice(position, 0, visit);
            const newTravel = routeTravelMinutes(withVisit, costMatrix, nodeByPatient);
            if (newTravel + service + candidate.durationMinutes > team.dailyWorkMinutes + 1e-6) continue;
            const score = newTravel - currentTravel + MINUTES_PER_PRIORITY_DELAY_DAY
              * (priorityById.get(candidate.id) ?? 1) * actionableDelay(route.date, candidate, scenario.startDate);
            if (!best || score < best.score - 1e-6) best = { route: routeIndex, position, score };
          }
        }
        if (!best) { remaining.push(unallocated); continue; }
        routes[best.route].visits.splice(best.position, 0, visit);
        routes[best.route] = apply1Point5Opt(rebuildRoute(routes[best.route], routes[best.route].visits,
          costMatrix, nodeByPatient), costMatrix);
      }
      pending = remaining;
    };
    if (recoverPending) insertPendingVisits();
    const initialRoutes = routes.map(route => ({ ...route, visits: [...route.visits] }));
    const initialPending = [...pending];
    const travelBudget = routes.reduce((sum, route) => sum + routeTravelMinutes(route.visits, costMatrix, nodeByPatient), 0);
    const distanceBudget = routes.reduce((sum, route) => sum + routeDistanceKm(route.visits, costMatrix, nodeByPatient), 0);
    const promptPoints = () => routes.reduce((sum, route) => sum + route.visits.reduce((inner, visit) => {
      const candidate = candidateById.get(visit.visitCandidateId);
      return inner + (candidate && actionableDelay(route.date, candidate, scenario.startDate) === 0
        ? (priorityById.get(candidate.id) ?? 1) : 0);
    }, 0), 0);
    const promptBudget = promptPoints();

    for (let move = 0; move < MAX_MOVES; move++) {
      let best: { from: number; to: number; visit: number; position: number; gain: number } | undefined;
      let bestSwap: { from: number; to: number; visit: number; otherVisit: number; gain: number } | undefined;
      const travel = routes.map(route => routeTravelMinutes(route.visits, costMatrix, nodeByPatient));
      const distance = routes.map(route => routeDistanceKm(route.visits, costMatrix, nodeByPatient));
      const currentTravel = travel.reduce((sum, value) => sum + value, 0);
      const currentDistance = distance.reduce((sum, value) => sum + value, 0);
      const currentPrompt = promptPoints();

      for (let from = 0; from < routes.length; from++) {
        const source = routes[from];
        for (let visitIndex = 0; visitIndex < source.visits.length; visitIndex++) {
          const visit = source.visits[visitIndex];
          const candidate = candidateById.get(visit.visitCandidateId);
          if (!candidate) throw new Error(`Visita ${visit.visitCandidateId} ausente da demanda.`);
          const sourceWithout = source.visits.filter((_, index) => index !== visitIndex);
          const sourceTravelAfter = routeTravelMinutes(sourceWithout, costMatrix, nodeByPatient);
          const sourceDistanceAfter = routeDistanceKm(sourceWithout, costMatrix, nodeByPatient);
          const duration = visit.durationMinutes ?? 30;
          const priority = priorityById.get(candidate.id) ?? 1;

          for (let to = 0; to < routes.length; to++) {
            if (from === to) continue;
            const destination = routes[to];
            if (differenceInCalendarDays(candidate.dueDate, destination.date) > scenario.maxAnticipationDays) continue;
            if (destination.visits.some(item => item.patientId === visit.patientId)) continue;
            const team = teamById.get(destination.teamId);
            if (!team) throw new Error(`Equipe ${destination.teamId} ausente do cenário.`);
            const destinationService = destination.visits.reduce((sum, item) => sum + (item.durationMinutes ?? 30), 0);
            const delayDelta = priority * (actionableDelay(destination.date, candidate, scenario.startDate)
              - actionableDelay(source.date, candidate, scenario.startDate));
            const promptDelta = priority * (Number(actionableDelay(destination.date, candidate, scenario.startDate) === 0)
              - Number(actionableDelay(source.date, candidate, scenario.startDate) === 0));

            for (let position = 0; position <= destination.visits.length; position++) {
              if (currentPrompt + promptDelta < promptBudget) break;
              const destinationWith = [...destination.visits];
              destinationWith.splice(position, 0, visit);
              const destinationTravelAfter = routeTravelMinutes(destinationWith, costMatrix, nodeByPatient);
              if (destinationTravelAfter + destinationService + duration > team.dailyWorkMinutes + 1e-6) continue;
              const travelDelta = sourceTravelAfter - travel[from] + destinationTravelAfter - travel[to];
              const distanceDelta = sourceDistanceAfter - distance[from]
                + routeDistanceKm(destinationWith, costMatrix, nodeByPatient) - distance[to];
              if (currentTravel + travelDelta > travelBudget + 1e-6 ||
                  currentDistance + distanceDelta > distanceBudget + 1e-6) continue;
              const gain = travelDelta + MINUTES_PER_PRIORITY_DELAY_DAY * delayDelta
                - promptWeight * promptDelta;
              if (gain < -1e-4 && (!best || gain < best.gain)) best = { from, to, visit: visitIndex, position, gain };
            }

            // Troca entre jornadas cheias: preserva o número de visitas por dia,
            // mas permite aproximar bairros e antecipar quem tem maior prioridade.
            if (to <= from) continue;
            for (let otherIndex = 0; otherIndex < destination.visits.length; otherIndex++) {
              const other = destination.visits[otherIndex];
              const otherCandidate = candidateById.get(other.visitCandidateId);
              if (!otherCandidate) throw new Error(`Visita ${other.visitCandidateId} ausente da demanda.`);
              if (differenceInCalendarDays(otherCandidate.dueDate, source.date) > scenario.maxAnticipationDays) continue;
              if (source.visits.some((item, index) => index !== visitIndex && item.patientId === other.patientId)) continue;
              if (destination.visits.some((item, index) => index !== otherIndex && item.patientId === visit.patientId)) continue;
              const sourceTeam = teamById.get(source.teamId);
              if (!sourceTeam) throw new Error(`Equipe ${source.teamId} ausente do cenário.`);
              const sourceService = source.visits.reduce((sum, item) => sum + (item.durationMinutes ?? 30), 0);
              const sourceWith = [...source.visits];
              const destinationWith = [...destination.visits];
              sourceWith[visitIndex] = other;
              destinationWith[otherIndex] = visit;
              const sourceTravelAfterSwap = routeTravelMinutes(sourceWith, costMatrix, nodeByPatient);
              const destinationTravelAfterSwap = routeTravelMinutes(destinationWith, costMatrix, nodeByPatient);
              const otherDuration = other.durationMinutes ?? 30;
              if (sourceTravelAfterSwap + sourceService - duration + otherDuration > sourceTeam.dailyWorkMinutes + 1e-6 ||
                  destinationTravelAfterSwap + destinationService - otherDuration + duration > team.dailyWorkMinutes + 1e-6) continue;
              const otherPriority = priorityById.get(otherCandidate.id) ?? 1;
              const distanceDelta = routeDistanceKm(sourceWith, costMatrix, nodeByPatient) - distance[from]
                + routeDistanceKm(destinationWith, costMatrix, nodeByPatient) - distance[to];
              const travelDelta = sourceTravelAfterSwap - travel[from] + destinationTravelAfterSwap - travel[to];
              if (currentTravel + travelDelta > travelBudget + 1e-6 ||
                  currentDistance + distanceDelta > distanceBudget + 1e-6) continue;
              const otherDelayDelta = otherPriority * (actionableDelay(source.date, otherCandidate, scenario.startDate)
                - actionableDelay(destination.date, otherCandidate, scenario.startDate));
              const otherPromptDelta = otherPriority * (Number(actionableDelay(source.date, otherCandidate, scenario.startDate) === 0)
                - Number(actionableDelay(destination.date, otherCandidate, scenario.startDate) === 0));
              if (currentPrompt + promptDelta + otherPromptDelta < promptBudget) continue;
              const gain = travelDelta + MINUTES_PER_PRIORITY_DELAY_DAY * (delayDelta + otherDelayDelta)
                - promptWeight * (promptDelta + otherPromptDelta);
              if (gain < -1e-4 && (!bestSwap || gain < bestSwap.gain)) bestSwap = { from, to, visit: visitIndex, otherVisit: otherIndex, gain };
            }
          }
        }
      }

      if (!best && !bestSwap) break;
      let changed: [number, number];
      if (bestSwap && (!best || bestSwap.gain < best.gain)) {
        const first = routes[bestSwap.from].visits[bestSwap.visit];
        routes[bestSwap.from].visits[bestSwap.visit] = routes[bestSwap.to].visits[bestSwap.otherVisit];
        routes[bestSwap.to].visits[bestSwap.otherVisit] = first;
        changed = [bestSwap.from, bestSwap.to];
      } else if (best) {
        const [visit] = routes[best.from].visits.splice(best.visit, 1);
        routes[best.to].visits.splice(best.position, 0, visit);
        changed = [best.from, best.to];
      } else break;
      for (const index of changed) {
        routes[index] = apply1Point5Opt(rebuildRoute(routes[index], routes[index].visits, costMatrix, nodeByPatient), costMatrix);
      }
    }

    // Quando a jornada está cheia, uma pendência mais prioritária pode substituir
    // uma visita de menor peso, mantendo o número de atendimentos e a resposta pronta.
    if (recoverPending && pending.length) {
      const lastDay = context.workingDays[context.workingDays.length - 1];
      const ordered = [...pending].sort((a, b) =>
        (priorityById.get(b.visitCandidateId) ?? 1) - (priorityById.get(a.visitCandidateId) ?? 1));
      for (const unallocated of ordered) {
        if (!pending.some(item => item.visitCandidateId === unallocated.visitCandidateId)) continue;
        const candidate = candidateById.get(unallocated.visitCandidateId);
        if (!candidate) throw new Error(`Visita ${unallocated.visitCandidateId} ausente da demanda.`);
        const priority = priorityById.get(candidate.id) ?? 1;
        const currentTravel = routes.reduce((sum, route) =>
          sum + routeTravelMinutes(route.visits, costMatrix, nodeByPatient), 0);
        const currentDistance = routes.reduce((sum, route) =>
          sum + routeDistanceKm(route.visits, costMatrix, nodeByPatient), 0);
        let best: { route: number; index: number; score: number; displaced: VisitCandidate } | undefined;
        for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
          const route = routes[routeIndex];
          if (differenceInCalendarDays(candidate.dueDate, route.date) > scenario.maxAnticipationDays ||
              route.visits.some(visit => visit.patientId === candidate.patientId)) continue;
          const team = teamById.get(route.teamId);
          if (!team) throw new Error(`Equipe ${route.teamId} ausente do cenário.`);
          const beforeTravel = routeTravelMinutes(route.visits, costMatrix, nodeByPatient);
          const beforeDistance = routeDistanceKm(route.visits, costMatrix, nodeByPatient);
          const beforeService = route.visits.reduce((sum, visit) => sum + (visit.durationMinutes ?? 30), 0);
          for (let index = 0; index < route.visits.length; index++) {
            const displaced = candidateById.get(route.visits[index].visitCandidateId);
            if (!displaced) throw new Error(`Visita ${route.visits[index].visitCandidateId} ausente da demanda.`);
            const displacedPriority = priorityById.get(displaced.id) ?? 1;
            if (priority <= displacedPriority) continue;
            const promptChange = priority * Number(actionableDelay(route.date, candidate, scenario.startDate) === 0)
              - displacedPriority * Number(actionableDelay(route.date, displaced, scenario.startDate) === 0);
            if (promptChange < 0) continue;
            const delayChange = priority * (actionableDelay(route.date, candidate, scenario.startDate)
              - actionableDelay(lastDay, candidate, scenario.startDate))
              + displacedPriority * (actionableDelay(lastDay, displaced, scenario.startDate)
                - actionableDelay(route.date, displaced, scenario.startDate));
            if (delayChange > 1e-6) continue;
            const replacement: PlannedVisit = {
              visitCandidateId: candidate.id, patientId: candidate.patientId,
              conditionId: candidate.conditionId, durationMinutes: candidate.durationMinutes,
              estimatedStartTime: '', estimatedEndTime: '',
              travelTimeMinutesFromPrevious: 0, travelDistanceKmFromPrevious: 0
            };
            const withVisit = [...route.visits];
            withVisit[index] = replacement;
            const afterTravel = routeTravelMinutes(withVisit, costMatrix, nodeByPatient);
            const afterDistance = routeDistanceKm(withVisit, costMatrix, nodeByPatient);
            if (afterTravel + beforeService - (route.visits[index].durationMinutes ?? 30)
                + candidate.durationMinutes > team.dailyWorkMinutes + 1e-6 ||
                currentTravel + afterTravel - beforeTravel > travelBudget + 1e-6 ||
                currentDistance + afterDistance - beforeDistance > distanceBudget + 1e-6) continue;
            const score = (priority - displacedPriority) * 100 + promptChange * 24
              - (afterTravel - beforeTravel);
            if (!best || score > best.score + 1e-6) {
              best = { route: routeIndex, index, score, displaced };
            }
          }
        }
        if (!best) continue;
        routes[best.route].visits[best.index] = {
          visitCandidateId: candidate.id, patientId: candidate.patientId,
          conditionId: candidate.conditionId, durationMinutes: candidate.durationMinutes,
          estimatedStartTime: '', estimatedEndTime: '',
          travelTimeMinutesFromPrevious: 0, travelDistanceKmFromPrevious: 0
        };
        routes[best.route] = apply1Point5Opt(rebuildRoute(routes[best.route], routes[best.route].visits,
          costMatrix, nodeByPatient), costMatrix);
        pending = pending.filter(item => item.visitCandidateId !== candidate.id);
        pending.push({ visitCandidateId: best.displaced.id, patientId: best.displaced.patientId,
          conditionId: best.displaced.conditionId,
          reason: 'Capacidade reservada para uma visita de maior prioridade clínica' });
      }
    }

    // As trocas entre dias podem abrir capacidade que não existia na construção.
    if (recoverPending && pending.length) insertPendingVisits();

    // A soma exibida usa arredondamento por rota; preserve a comparação também
    // nesse caso limite, mesmo quando a soma exata melhora por menos de 0,1 min.
    const initialMinutes = initialRoutes.reduce((sum, route) => sum + route.totalTravelTimeMinutes, 0);
    const finalMinutes = routes.reduce((sum, route) => sum + route.totalTravelTimeMinutes, 0);
    const initialKm = initialRoutes.reduce((sum, route) => sum + route.totalDistanceKm, 0);
    const finalKm = routes.reduce((sum, route) => sum + route.totalDistanceKm, 0);
    const roundedRegression = finalMinutes > initialMinutes + 1e-6 || finalKm > initialKm + 1e-6;
    return roundedRegression && pending.length === initialPending.length
      ? { routes: initialRoutes, unallocatedVisits: initialPending }
      : { routes, unallocatedVisits: pending };
}

/** Primeiro economiza deslocamento; depois melhora atendimento clínico sem perder o orçamento obtido. */
export const MainHeuristicStrategy: RoutingStrategy = {
  id: 'main-heuristic',
  name: 'Heurística mensal de custo e prioridade',
  description: 'Busca econômica seguida de reparo de pendências e priorização clínica sob orçamento de caminhada.',
  solve(context: PlanningContext) {
    const nearest = NearestBaselineStrategy.solve(context);
    const economic = improveFromSeed(context, nearest, false, 0);
    return improveFromSeed(context, economic, true, MINUTES_PER_PROMPT_PRIORITY_POINT);
  }
};
