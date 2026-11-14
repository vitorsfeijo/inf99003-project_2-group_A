export * from './types/index.js';
export { sampleTerritoryPatients } from './sampling/territory.js';
export { countWorkingDaysInNextMonth, getWorkingDaysHorizon, addCalendarDays } from './demand/dates.js';
export { PROFESSIONS, professionLabel, teamProfessions, teamCanServe, teamServiceGap, professionCount, teamStaffCount, requiredStaffCount,
  requiredProfessionCount, requiredProfessionIds, isPatientAvailable, unavailablePeriodOn, effectiveVisitTimes } from './constraints/index.js';
export { calculateUsageStatistics, isoWeekKey, periodKey } from './statistics/index.js';
export type { UsageStatistics, UsageStatisticsInput, StatisticsPeriod } from './statistics/index.js';
export { isPointInPolygon, isPointInAnyPolygon } from './validation/polygon.js';
export { validateScenario } from './validation/scenario.js';

import {
  Scenario,
  Plan,
  PlanOptions,
  ScenarioState,
  VisitResult,
  VerificationResult,
  RoutingStrategy,
  PlanningContext,
  UnallocatedVisit,
  UnavailablePeriod
} from './types/index.js';

import { validateScenario } from './validation/scenario.js';
import { generateDemandCandidates } from './demand/index.js';
import { calculatePlanMetrics } from './metrics/index.js';
import { verifyPlan as verifyPlanInternal } from './verification/index.js';
import { apply1Point5Opt } from './improvement/one-half-opt.js';
import { enforceMandatoryVisits } from './constraints/mandatory.js';
import { teamCanServe as canTeamServe, isPatientAvailable, unavailablePeriodOn } from './constraints/index.js';
import { nodeIndexByPatient, rebuildRoute } from './improvement/route-utils.js';
import { CostMatrix } from './types/index.js';

export const NO_COMPATIBLE_TEAM_REASON = 'Nenhuma equipe compatível (categorias exigidas, número de profissionais ou vínculo)';
export const PATIENT_AWAY_REASON = 'Paciente indisponível durante toda a janela';
export const REMOVED_FROM_ROUTE_REASON = 'Retirado da rota';

import { UrgencyBaselineStrategy } from './strategies/baseline-urgency.js';
import { NearestBaselineStrategy } from './strategies/baseline-nearest.js';
import { MainHeuristicStrategy } from './strategies/main-heuristic.js';

const strategiesMap = new Map<string, RoutingStrategy>([
  [UrgencyBaselineStrategy.id, UrgencyBaselineStrategy],
  [NearestBaselineStrategy.id, NearestBaselineStrategy],
  [MainHeuristicStrategy.id, MainHeuristicStrategy]
]);

/**
 * Gera o plano de rotas de visitas domiciliares para a janela de planejamento N.
 */
export function planScenario(scenario: Scenario, options: PlanOptions): Plan {
  // 1. Validar o cenário de entrada
  const validation = validateScenario(scenario);
  if (!validation.isValid) {
    throw new Error(`Cenário inválido para planejamento:\n${validation.errors.join('\n')}`);
  }

  // 2. Gerar demanda (candidatos a visitas)
  const { candidates, workingDays } = generateDemandCandidates(scenario, validation.eligiblePatients);

  // 3. Montar a Matriz de Custos (Posto + Pacientes elegíveis)
  const expectedNodeIds = [scenario.healthCenter.id, ...validation.eligiblePatients.map(patient => patient.id)];
  if (!options?.costMatrix) throw new Error('Informe uma matriz de distâncias e tempos de caminhada para planejar.');
  const costMatrix = options.costMatrix;
  if (costMatrix.nodeIds.length !== expectedNodeIds.length ||
      costMatrix.nodeIds.some((id, index) => id !== expectedNodeIds[index]) ||
      [costMatrix.distanceMatrix, costMatrix.timeMatrix].some(matrix => matrix.length !== expectedNodeIds.length ||
        matrix.some(row => row.length !== expectedNodeIds.length || row.some(value => !Number.isFinite(value) || value < 0)))) {
    throw new Error('Matriz viária incompatível com o posto e os pacientes elegíveis.');
  }

  // 4. Selecionar a Estratégia de Roteamento
  const strategyId = options?.strategyId || MainHeuristicStrategy.id;
  const strategy = strategiesMap.get(strategyId);
  if (!strategy) {
    throw new Error(`Estratégia de roteamento desconhecida: "${strategyId}". Opções disponíveis: ${Array.from(strategiesMap.keys()).join(', ')}`);
  }

  const context: PlanningContext = {
    scenario,
    costMatrix,
    candidates,
    workingDays
  };

  // 5. Planejar rotas via Estratégia e garantir as visitas com prazo rígido (âncoras),
  //    que valem para todas as estratégias.
  const enforced = enforceMandatoryVisits(context, strategy.solve(context));
  let { routes } = enforced;
  // Pendências sem nenhuma equipe compatível recebem o motivo real, em vez de "falta de capacidade".
  const candidateById = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const unallocatedVisits = enforced.unallocatedVisits.map(item => {
    const candidate = candidateById.get(item.visitCandidateId);
    if (item.mandatory || !candidate) return item;
    if (!scenario.teams.some(team => canTeamServe(team, candidate))) return { ...item, reason: NO_COMPATIBLE_TEAM_REASON };
    // Paciente ausente durante toda a janela (férias, viagem): a pendência diz isso, não "falta de capacidade".
    if (workingDays.every(day => !isPatientAvailable(candidate, day))) {
      const period = unavailablePeriodOn(candidate, workingDays[workingDays.length - 1]) ?? unavailablePeriodOn(candidate, workingDays[0]);
      return { ...item, reason: `${PATIENT_AWAY_REASON}${period?.reason ? ` (${period.reason})` : ''}` };
    }
    return item;
  });

  // 6. Aplicar 1.5-Opt intra-rota se ativado (padrão: ativado)
  const enable1_5Opt = options?.enable1_5Opt !== false && options?.enable2Opt !== false;
  if (enable1_5Opt) {
    routes = routes.map(route => apply1Point5Opt(route, costMatrix));
  }

  // 7. Calcular métricas do plano gerado
  const metrics = calculatePlanMetrics(scenario, routes, unallocatedVisits, candidates);

  const plan: Plan = {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    scenarioId: scenario.id,
    scenarioVersion: scenario.version,
    strategyId: strategy.id,
    generatedAt: new Date().toISOString(),
    routes,
    unallocatedVisits,
    metrics
  };

  // 8. Verificar a validade estrita do plano antes de retornar
  const verification = verifyPlanInternal(scenario, plan);
  if (!verification.isValid) {
    throw new Error(`Plano gerado é inválido segundo as restrições formais:\n${verification.errors.join('\n')}`);
  }
  // Avisos só são anexados quando existem, preservando o formato dos planos sem restrições novas.
  if (verification.warnings.length) plan.warnings = verification.warnings;

  return plan;
}

/**
 * Registra os resultados reais de visitas (concluídas ou não realizadas) e atualiza o estado do cenário para o replanejamento.
 */
export function applyVisitResults(state: ScenarioState, results: VisitResult[]): ScenarioState {
  const updatedPatients = state.scenario.patients.map(patient => {
    const patientResults = results.filter(r => r.patientId === patient.id);
    if (patientResults.length === 0) return patient;

    const updatedConditions = patient.conditions.map(cond => {
      const result = patientResults.find(r => r.conditionId === cond.conditionId);
      if (result && result.status === 'completed') {
        return {
          ...cond,
          lastVisitDate: result.date
        };
      }
      return cond;
    });

    // Uma visita concluída cumpre o prazo rígido e consome o ajuste de duração/folga da próxima visita;
    // uma não realizada mantém os dois (o prazo vale no próximo dia útil se vencer).
    const completed = patientResults.some(result => result.status === 'completed');
    const { hardDeadline, nextVisit, ...rest } = patient;
    return {
      ...(completed ? rest : patient),
      conditions: updatedConditions
    };
  });

  return {
    ...state,
    scenario: {
      ...state.scenario,
      version: state.scenario.version + 1,
      patients: updatedPatients
    },
    history: [...state.history, ...results]
  };
}

/** Visita a retirar de uma rota já planejada (ex.: o paciente avisou que estaria fora). */
export interface RouteVisitRemoval {
  date: string;
  teamId: string;
  patientId: string;
  reason?: string;
}

/**
 * Marca o paciente como indisponível no dia da rota. O planejador e o verificador passam a
 * respeitar o aviso, e a visita continua pendente com o prazo original.
 */
export function markPatientUnavailable(scenario: Scenario, patientId: string, period: UnavailablePeriod): Scenario {
  if (!scenario.patients.some(patient => patient.id === patientId)) throw new Error(`Paciente ${patientId} não encontrado no cenário.`);
  return {
    ...scenario,
    patients: scenario.patients.map(patient => patient.id === patientId
      ? { ...patient, unavailablePeriods: [...(patient.unavailablePeriods ?? []), period] }
      : patient)
  };
}

/**
 * "Só pular": retira a visita da rota sem replanejar o restante. Os demais pacientes mantêm a ordem;
 * os horários e a caminhada são recalculados, e a visita retirada volta para as pendências.
 * Use um cenário que já registre o paciente como indisponível na data (markPatientUnavailable).
 */
export function removeVisitFromPlan(scenario: Scenario, plan: Plan, removal: RouteVisitRemoval, costMatrix: CostMatrix): Plan {
  const routeIndex = plan.routes.findIndex(route => route.date === removal.date && route.teamId === removal.teamId);
  if (routeIndex < 0) throw new Error(`Rota da equipe ${removal.teamId} em ${removal.date} não encontrada no plano.`);
  const route = plan.routes[routeIndex];
  const removed = route.visits.find(visit => visit.patientId === removal.patientId);
  if (!removed) throw new Error(`O paciente ${removal.patientId} não está na rota da equipe ${removal.teamId} em ${removal.date}.`);

  const validation = validateScenario(scenario);
  if (!validation.isValid) throw new Error(`Cenário inválido:\n${validation.errors.join('\n')}`);
  const { candidates } = generateDemandCandidates(scenario, validation.eligiblePatients);
  const nodeByPatient = nodeIndexByPatient(costMatrix);
  const routes = plan.routes.map((item, index) => index === routeIndex
    ? rebuildRoute(item, item.visits.filter(visit => visit !== removed), costMatrix, nodeByPatient)
    : item);
  const unallocatedVisits: UnallocatedVisit[] = [...plan.unallocatedVisits, {
    visitCandidateId: removed.visitCandidateId, patientId: removed.patientId, conditionId: removed.conditionId,
    reason: `${REMOVED_FROM_ROUTE_REASON} de ${removal.date}${removal.reason ? `: ${removal.reason}` : ''}`,
    ...(removed.mandatory ? { mandatory: true } : {})
  }];
  const updated: Plan = {
    ...plan,
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    scenarioVersion: scenario.version,
    generatedAt: new Date().toISOString(),
    routes,
    unallocatedVisits,
    metrics: calculatePlanMetrics(scenario, routes, unallocatedVisits, candidates)
  };
  delete updated.warnings;
  const verification = verifyPlanInternal(scenario, updated);
  if (!verification.isValid) throw new Error(`Plano inválido após retirar a visita:\n${verification.errors.join('\n')}`);
  if (verification.warnings.length) updated.warnings = verification.warnings;
  return updated;
}

/**
 * Interface pública para o verificador formal de planos.
 */
export function verifyPlan(scenario: Scenario, plan: Plan): VerificationResult {
  return verifyPlanInternal(scenario, plan);
}
