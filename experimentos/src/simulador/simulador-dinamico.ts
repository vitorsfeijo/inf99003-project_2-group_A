/**
 * Simulador Dinâmico Multi-Dias com Falhas (Passo 2 da Pesquisa)
 *
 * Para cada (estratégia, cenário, taxa de falha):
 *   - Executa N dias úteis de simulação
 *   - A cada dia: planeja → simula campo (falhas com missRate) → registra resultados reais
 *   - Usa applyVisitResults para avançar o estado do cenário (replanejamento automático)
 *   - Coleta: atraso acumulado REAL, distância efetiva percorrida, tempo de replanejamento
 */

import {
  planScenario,
  verifyPlan,
  applyVisitResults,
  Scenario,
  ScenarioState,
  VisitResult,
  DailyTeamRoute,
  CostMatrix
} from '../../../artefato/packages/core/dist/index.js';

// ---------------------------------------------------------------------------
// Tipos de saída
// ---------------------------------------------------------------------------

export interface DynamicSimulationRecord {
  scenarioId: string;
  patientCount: number;
  teamCount: number;
  strategyId: string;
  missRate: number;
  totalSimulationDays: number;
  // Métricas reais (baseadas no que foi efetivamente executado no campo)
  completedVisits: number;
  missedVisits: number;
  unservedVisits: number;
  realCoveragePercentage: number;
  realAccumulatedOverdueDays: number;
  realPriorityWeightedCoveragePercentage: number;
  realPriorityWeightedPromptCoveragePercentage: number;
  realPriorityWeightedActionableDelayDays: number;
  realTravelDistanceKm: number;
  // Desempenho computacional
  totalPlanningTimeMs: number;
  avgReplanningTimeMs: number;
  replanningCount: number;
  daysToComplete: number;
  completionDate: string;
}

// ---------------------------------------------------------------------------
// Helpers de data (sem importar do core — funções inline para evitar path issues)
// ---------------------------------------------------------------------------

function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addCalendarDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

function isWorkingDay(dateStr: string): boolean {
  const dow = parseLocalDate(dateStr).getDay();
  return dow !== 0 && dow !== 6; // exclui sábado e domingo
}

/**
 * Retorna o próximo dia útil após `dateStr` (não inclui o próprio dia).
 */
function nextWorkingDay(dateStr: string): string {
  let next = addCalendarDays(dateStr, 1);
  while (!isWorkingDay(next)) {
    next = addCalendarDays(next, 1);
  }
  return next;
}

// ---------------------------------------------------------------------------
// PRNG Mulberry32 determinístico (mesmo sorteio por paciente/data entre métodos e taxas)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedForVisit(scenarioId: string, date: string, patientId: string): number {
  // O mesmo paciente no mesmo dia tem o mesmo resultado em todas as estratégias.
  const str = `${scenarioId}|${date}|${patientId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Função principal: simular uma rodada dinâmica
// ---------------------------------------------------------------------------

export function runDynamicSimulation(
  baseScenario: Scenario,
  strategyId: string,
  missRate: number,
  totalSimulationDays: number,
  costMatrix: CostMatrix,
  failureKey = baseScenario.id,
  horizonMode: 'rolling' | 'fixed' = 'rolling'
): DynamicSimulationRecord {
  // Estado inicial: avança a janela de planejamento para cada dia simulado
  let state: ScenarioState = {
    scenario: JSON.parse(JSON.stringify(baseScenario)), // deep clone
    history: [],
    currentDate: baseScenario.startDate
  };

  let completedVisits = 0;
  let missedVisits = 0;
  let realTravelDistanceKm = 0;
  let totalPlanningTimeMs = 0;
  let replanningCount = 0;
  let initialDemand: { patientId: string; conditionId: string }[] | undefined;
  let scheduledRoutes: DailyTeamRoute[] = [];
  let needsReplan = true;
  let daysToComplete = 0;
  let completionDate = '';
  const completedDates = new Map<string, string>();
  let lastSimulationDate = baseScenario.startDate;

  let simulationDay = 0;
  let currentDate = baseScenario.startDate;

  while (simulationDay < totalSimulationDays) {
    // Apenas simula dias úteis
    if (!isWorkingDay(currentDate)) {
      currentDate = addCalendarDays(currentDate, 1);
      continue;
    }

    simulationDay++;
    lastSimulationDate = currentDate;

    // Atualiza o startDate do cenário para refletir o dia atual da simulação
    const scenarioForDay: Scenario = {
      ...state.scenario,
      startDate: currentDate,
      planningHorizonDays: horizonMode === 'fixed'
        ? totalSimulationDays - simulationDay + 1
        : state.scenario.planningHorizonDays
    };

    // 1. Medir tempo de planejamento/replanejamento
    const t0 = performance.now();
    let routesForToday: DailyTeamRoute[] = [];

    try {
      if (horizonMode === 'fixed' && !needsReplan) {
        routesForToday = scheduledRoutes.filter(route => route.date === currentDate);
      } else {
        const plan = planScenario(scenarioForDay, { strategyId, enable1_5Opt: true, costMatrix });
        const t1 = performance.now();
        const verification = verifyPlan(scenarioForDay, plan);
        if (!verification.isValid) throw new Error(`Plano inválido: ${verification.errors.join('; ')}`);
        totalPlanningTimeMs += t1 - t0;
        replanningCount++;
        if (!initialDemand) {
          const unique = new Map<string, { patientId: string; conditionId: string }>();
          for (const visit of [...plan.routes.flatMap(route => route.visits), ...plan.unallocatedVisits]) {
            const key = JSON.stringify([visit.patientId, visit.conditionId]);
            unique.set(key, { patientId: visit.patientId, conditionId: visit.conditionId });
          }
          initialDemand = [...unique.values()];
        }

        // 2. Filtrar apenas as rotas planejadas para o dia atual
        routesForToday = plan.routes.filter(r => r.date === currentDate);
        if (horizonMode === 'fixed') {
          scheduledRoutes = plan.routes;
          needsReplan = false;
        }
      }
    } catch (err: any) {
      throw new Error(`Falha ao planejar ${baseScenario.id}/${strategyId} no dia ${simulationDay}: ${err.message}`);
    }

    // 3. Simular campo: cada visita planejada hoje tem chance de ser 'missed'
    const dayResults: VisitResult[] = [];

    for (const route of routesForToday) {
      // Acumula distância das rotas que seriam percorridas hoje
      // Para visitas 'missed': equipe deslocou mas paciente não estava → conta distância
      realTravelDistanceKm += route.totalDistanceKm;

      for (const visit of route.visits) {
        const failed = mulberry32(seedForVisit(failureKey, currentDate, visit.patientId))() < missRate;
        const status: 'completed' | 'missed' = failed ? 'missed' : 'completed';

        if (status === 'completed') {
          completedVisits++;
          const key = JSON.stringify([visit.patientId, visit.conditionId]);
          if (!completedDates.has(key)) completedDates.set(key, currentDate);
        } else {
          missedVisits++;
        }

        dayResults.push({
          patientId: visit.patientId,
          conditionId: visit.conditionId,
          date: currentDate,
          status,
          reason: failed ? 'Paciente ausente (simulação de campo)' : undefined
        });
      }
    }

    // 4. Aplicar resultados → atualiza estado do cenário para replanejamento
    if (dayResults.length > 0) {
      state = applyVisitResults(
        { ...state, scenario: scenarioForDay },
        dayResults
      );
    } else {
      // Sem visitas hoje → apenas avança a data no estado
      state = { ...state, scenario: scenarioForDay };
    }

    if (horizonMode === 'fixed' && dayResults.some(result => result.status === 'missed')) {
      needsReplan = true;
    }
    if (initialDemand && daysToComplete === 0 && completedDates.size === initialDemand.length) {
      daysToComplete = simulationDay;
      completionDate = currentDate;
      if (horizonMode === 'fixed') break;
    }

    currentDate = nextWorkingDay(currentDate);
  }

  const baseline = initialDemand ?? [];
  let baselineCompleted = 0;
  let realAccumulatedOverdueDays = 0;
  let totalPriority = 0;
  let completedPriority = 0;
  let promptPriority = 0;
  let actionableWeightedDelay = 0;
  const daysBetween = (end: string, start: string) => Math.round((parseLocalDate(end).getTime() - parseLocalDate(start).getTime()) / 86400000);
  for (const visit of baseline) {
    const condition = baseScenario.patients.find(patient => patient.id === visit.patientId)
      ?.conditions.find(item => item.conditionId === visit.conditionId);
    if (!condition) throw new Error(`Condição não encontrada: ${visit.patientId}/${visit.conditionId}`);
    const dueDate = condition.lastVisitDate
      ? addCalendarDays(condition.lastVisitDate, condition.maxIntervalDays)
      : condition.initialDueDate ?? baseScenario.startDate;
    const priority = Math.max(1, condition.priorityWeight);
    totalPriority += priority;
    const completedDate = completedDates.get(JSON.stringify([visit.patientId, visit.conditionId]));
    if (completedDate) { baselineCompleted++; completedPriority += priority; }
    const outcomeDate = completedDate ?? lastSimulationDate;
    realAccumulatedOverdueDays += Math.max(0, daysBetween(outcomeDate, dueDate));
    const actionableDelay = Math.max(0, daysBetween(outcomeDate,
      dueDate < baseScenario.startDate ? baseScenario.startDate : dueDate));
    actionableWeightedDelay += priority * actionableDelay;
    if (completedDate && actionableDelay === 0) promptPriority += priority;
  }
  const realCoveragePercentage = baseline.length ? Number((baselineCompleted / baseline.length * 100).toFixed(2)) : 100;
  const realPriorityWeightedCoveragePercentage = totalPriority ? Number((completedPriority / totalPriority * 100).toFixed(2)) : 100;
  const realPriorityWeightedPromptCoveragePercentage = totalPriority ? Number((promptPriority / totalPriority * 100).toFixed(2)) : 100;
  const realPriorityWeightedActionableDelayDays = totalPriority ? Number((actionableWeightedDelay / totalPriority).toFixed(2)) : 0;

  return {
    scenarioId: baseScenario.id,
    patientCount: baseScenario.patients.length,
    teamCount: baseScenario.teams.length,
    strategyId,
    missRate,
    totalSimulationDays,
    completedVisits,
    missedVisits,
    unservedVisits: baseline.length - baselineCompleted,
    realCoveragePercentage,
    realAccumulatedOverdueDays,
    realPriorityWeightedCoveragePercentage,
    realPriorityWeightedPromptCoveragePercentage,
    realPriorityWeightedActionableDelayDays,
    realTravelDistanceKm: Number(realTravelDistanceKm.toFixed(3)),
    totalPlanningTimeMs: Number(totalPlanningTimeMs.toFixed(3)),
    avgReplanningTimeMs:
      replanningCount > 0
        ? Number((totalPlanningTimeMs / replanningCount).toFixed(3))
        : 0,
    replanningCount,
    daysToComplete,
    completionDate
  };
}
