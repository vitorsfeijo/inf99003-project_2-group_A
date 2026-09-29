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
  applyVisitResults,
  Scenario,
  ScenarioState,
  VisitResult,
  PlannedVisit,
  DailyTeamRoute
} from '../../../artefato/packages/core/dist/index.js';

import fs from 'fs';
import path from 'path';

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
  realCoveragePercentage: number;
  realAccumulatedOverdueDays: number;
  realTravelDistanceKm: number;
  // Desempenho computacional
  totalPlanningTimeMs: number;
  avgReplanningTimeMs: number;
  replanningCount: number;
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
// PRNG Mulberry32 determinístico (semente fixa por (strategyId, scenarioId, missRate))
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedForRun(strategyId: string, scenarioId: string, missRate: number): number {
  // Hash determinístico simples
  const str = `${strategyId}|${scenarioId}|${missRate}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ---------------------------------------------------------------------------
// Função principal: simular uma rodada dinâmica
// ---------------------------------------------------------------------------

function runDynamicSimulation(
  baseScenario: Scenario,
  strategyId: string,
  missRate: number,
  totalSimulationDays: number
): DynamicSimulationRecord {
  const random = mulberry32(seedForRun(strategyId, baseScenario.id, missRate));

  // Estado inicial: avança a janela de planejamento para cada dia simulado
  let state: ScenarioState = {
    scenario: JSON.parse(JSON.stringify(baseScenario)), // deep clone
    history: [],
    currentDate: baseScenario.startDate
  };

  let completedVisits = 0;
  let missedVisits = 0;
  let realTravelDistanceKm = 0;
  let realAccumulatedOverdueDays = 0;
  let totalPlanningTimeMs = 0;
  let replanningCount = 0;

  let simulationDay = 0;
  let currentDate = baseScenario.startDate;

  while (simulationDay < totalSimulationDays) {
    // Apenas simula dias úteis
    if (!isWorkingDay(currentDate)) {
      currentDate = addCalendarDays(currentDate, 1);
      continue;
    }

    simulationDay++;

    // Atualiza o startDate do cenário para refletir o dia atual da simulação
    const scenarioForDay: Scenario = {
      ...state.scenario,
      startDate: currentDate
    };

    // 1. Medir tempo de planejamento/replanejamento
    const t0 = performance.now();
    let routesForToday: DailyTeamRoute[] = [];

    try {
      const plan = planScenario(scenarioForDay, { strategyId, enable1_5Opt: true });
      const t1 = performance.now();
      totalPlanningTimeMs += t1 - t0;
      replanningCount++;

      // 2. Filtrar apenas as rotas planejadas para o dia atual
      routesForToday = plan.routes.filter(r => r.date === currentDate);
    } catch (err: any) {
      // Plano inválido ou sem demanda — registra falha e avança
      console.warn(`  ⚠️  Falha ao planejar (${strategyId}, ${baseScenario.id}, dia ${simulationDay}): ${err.message}`);
      currentDate = nextWorkingDay(currentDate);
      continue;
    }

    // 3. Simular campo: cada visita planejada hoje tem chance de ser 'missed'
    const dayResults: VisitResult[] = [];

    for (const route of routesForToday) {
      // Acumula distância das rotas que seriam percorridas hoje
      // Para visitas 'missed': equipe deslocou mas paciente não estava → conta distância
      realTravelDistanceKm += route.totalDistanceKm;

      for (const visit of route.visits) {
        const failed = random() < missRate;
        const status: 'completed' | 'missed' = failed ? 'missed' : 'completed';

        if (status === 'completed') {
          completedVisits++;
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

    // 4. Calcular atraso real acumulado para visitas MISSED neste dia
    //    (cada visita missed que estava em atraso incrementa o contador)
    const missedToday = dayResults.filter(r => r.status === 'missed');
    for (const missed of missedToday) {
      const patient = state.scenario.patients.find(p => p.id === missed.patientId);
      if (!patient) continue;
      const condition = patient.conditions.find(c => c.conditionId === missed.conditionId);
      if (!condition) continue;

      // Prazo da condição: lastVisitDate + maxIntervalDays ou initialDueDate
      let dueDate: string;
      if (condition.lastVisitDate) {
        dueDate = addCalendarDays(condition.lastVisitDate, condition.maxIntervalDays);
      } else if (condition.initialDueDate) {
        dueDate = condition.initialDueDate;
      } else {
        continue;
      }

      // Dias de atraso se já passou do prazo
      const overdueDays = Math.max(
        0,
        Math.round(
          (parseLocalDate(currentDate).getTime() - parseLocalDate(dueDate).getTime()) /
            (1000 * 3600 * 24)
        )
      );
      realAccumulatedOverdueDays += overdueDays;
    }

    // 5. Aplicar resultados → atualiza estado do cenário para replanejamento
    if (dayResults.length > 0) {
      state = applyVisitResults(
        { ...state, scenario: scenarioForDay },
        dayResults
      );
    } else {
      // Sem visitas hoje → apenas avança a data no estado
      state = { ...state, scenario: scenarioForDay };
    }

    currentDate = nextWorkingDay(currentDate);
  }

  const totalVisits = completedVisits + missedVisits;
  const realCoveragePercentage =
    totalVisits > 0
      ? Number(((completedVisits / totalVisits) * 100).toFixed(2))
      : 0;

  return {
    scenarioId: baseScenario.id,
    patientCount: baseScenario.patients.length,
    teamCount: baseScenario.teams.length,
    strategyId,
    missRate,
    totalSimulationDays,
    completedVisits,
    missedVisits,
    realCoveragePercentage,
    realAccumulatedOverdueDays,
    realTravelDistanceKm: Number(realTravelDistanceKm.toFixed(3)),
    totalPlanningTimeMs: Number(totalPlanningTimeMs.toFixed(3)),
    avgReplanningTimeMs:
      replanningCount > 0
        ? Number((totalPlanningTimeMs / replanningCount).toFixed(3))
        : 0,
    replanningCount
  };
}

// ---------------------------------------------------------------------------
// Entrypoint: executa todas as combinações e salva resultados
// ---------------------------------------------------------------------------

const cenariosDir = path.resolve(process.cwd(), 'cenarios');
const resultadosDir = path.resolve(process.cwd(), 'resultados');

if (!fs.existsSync(resultadosDir)) {
  fs.mkdirSync(resultadosDir, { recursive: true });
}

const scenarioFiles = fs.readdirSync(cenariosDir).filter((f: string) => f.endsWith('.json'));

if (scenarioFiles.length === 0) {
  console.error('Nenhum cenário encontrado em experimentos/cenarios. Execute o gerador primeiro.');
  process.exit(1);
}

const strategiesToCompare = ['main-heuristic', 'urgency-baseline', 'nearest-baseline'];
const missRates = [0.0, 0.1, 0.2, 0.4];
const totalSimulationDays = 5; // 1 semana útil

const allRecords: DynamicSimulationRecord[] = [];

const totalRuns = scenarioFiles.length * strategiesToCompare.length * missRates.length;
console.log(`🚀 Simulador Dinâmico — ${scenarioFiles.length} cenários × ${strategiesToCompare.length} estratégias × ${missRates.length} taxas de falha = ${totalRuns} rodadas\n`);

for (const file of scenarioFiles) {
  const scenario: Scenario = JSON.parse(fs.readFileSync(path.join(cenariosDir, file), 'utf-8'));
  console.log(`📌 Cenário: ${scenario.id} (${scenario.patients.length} pacientes, ${scenario.teams.length} equipes)`);

  for (const strategyId of strategiesToCompare) {
    for (const missRate of missRates) {
      try {
        const record = runDynamicSimulation(scenario, strategyId, missRate, totalSimulationDays);
        allRecords.push(record);

        const missLabel = (missRate * 100).toFixed(0).padStart(2, ' ');
        console.log(
          `  └─ [${strategyId.padEnd(20)}] missRate=${missLabel}% | ` +
          `Cobertura: ${record.realCoveragePercentage.toFixed(1).padStart(5)}% | ` +
          `Atraso: ${String(record.realAccumulatedOverdueDays).padStart(4)}d | ` +
          `Dist: ${record.realTravelDistanceKm.toFixed(1).padStart(7)} km | ` +
          `AvgReplanning: ${record.avgReplanningTimeMs.toFixed(1)} ms`
        );
      } catch (err: any) {
        console.error(`  ❌ Erro: ${strategyId} / ${scenario.id} / missRate=${missRate}: ${err.message}`);
      }
    }
  }
}

// Salvar JSON
const jsonOut = path.join(resultadosDir, 'dynamic_simulation_results.json');
fs.writeFileSync(jsonOut, JSON.stringify(allRecords, null, 2), 'utf-8');
console.log(`\n💾 JSON salvo: ${jsonOut}`);

// Salvar CSV
const csvHeader = [
  'scenarioId', 'patientCount', 'teamCount', 'strategyId', 'missRate',
  'totalSimulationDays', 'completedVisits', 'missedVisits',
  'realCoveragePercentage', 'realAccumulatedOverdueDays', 'realTravelDistanceKm',
  'totalPlanningTimeMs', 'avgReplanningTimeMs', 'replanningCount'
].join(',');

const csvRows = allRecords.map(r => [
  `"${r.scenarioId}"`,
  r.patientCount,
  r.teamCount,
  `"${r.strategyId}"`,
  r.missRate,
  r.totalSimulationDays,
  r.completedVisits,
  r.missedVisits,
  r.realCoveragePercentage,
  r.realAccumulatedOverdueDays,
  r.realTravelDistanceKm,
  r.totalPlanningTimeMs,
  r.avgReplanningTimeMs,
  r.replanningCount
].join(','));

const csvOut = path.join(resultadosDir, 'dynamic_simulation_results.csv');
fs.writeFileSync(csvOut, `${csvHeader}\n${csvRows.join('\n')}`, 'utf-8');
console.log(`💾 CSV salvo: ${csvOut}`);

console.log('\n✨ Simulação dinâmica concluída com sucesso!');
