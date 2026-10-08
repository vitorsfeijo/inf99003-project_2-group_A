export * from './types/index.js';
export { sampleTerritoryPatients } from './sampling/territory.js';
export { countWorkingDaysInNextMonth } from './demand/dates.js';

import {
  Scenario,
  Plan,
  PlanOptions,
  ScenarioState,
  VisitResult,
  VerificationResult,
  RoutingStrategy,
  PlanningContext
} from './types/index.js';

import { validateScenario } from './validation/scenario.js';
import { buildCostMatrix } from './costs/haversine.js';
import { generateDemandCandidates } from './demand/index.js';
import { calculatePlanMetrics } from './metrics/index.js';
import { verifyPlan as verifyPlanInternal } from './verification/index.js';
import { apply1Point5Opt } from './improvement/one-half-opt.js';

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
  const costMatrix = options?.costMatrix ?? buildCostMatrix(scenario.healthCenter, validation.eligiblePatients, scenario.costParameters);
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

  // 5. Planejar rotas via Estratégia
  let { routes, unallocatedVisits } = strategy.solve(context);

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

    return {
      ...patient,
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

/**
 * Interface pública para o verificador formal de planos.
 */
export function verifyPlan(scenario: Scenario, plan: Plan): VerificationResult {
  return verifyPlanInternal(scenario, plan);
}
