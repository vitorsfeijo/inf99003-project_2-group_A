import { planScenario, Scenario, Plan } from '../../../artefato/packages/core/dist/index.js';
import fs from 'fs';
import path from 'path';

export interface BenchmarkRecord {
  scenarioId: string;
  patientCount: number;
  teamCount: number;
  strategyId: string;
  executionTimeMs: number;
  coveragePercentage: number;
  onTimeCoveragePercentage: number;
  priorityWeightedCoveragePercentage: number;
  priorityWeightedOnTimeCoveragePercentage: number;
  priorityWeightedPromptCoveragePercentage: number;
  priorityWeightedAverageDelayDays: number;
  priorityWeightedActionableDelayDays: number;
  p90AllocatedDelayDays: number;
  delayOnTime: number;
  delayOneToTwoDays: number;
  delayThreeToSevenDays: number;
  delayOverSevenDays: number;
  delayUnallocated: number;
  distancePerAllocatedVisitKm: number;
  travelTimePerAllocatedVisitMinutes: number;
  timelyPriorityPointsPerKm: number;
  priorityPointsPerKm: number;
  totalOverdueDays: number;
  totalTravelDistanceKm: number;
  totalTravelTimeMinutes: number;
  teamUtilizationPercentage: number;
  teamWorkloadImbalance: number;
  unallocatedCount: number;
}

const cenariosDir = path.resolve(process.cwd(), 'cenarios');
const resultadosDir = path.resolve(process.cwd(), 'resultados');

if (!fs.existsSync(resultadosDir)) {
  fs.mkdirSync(resultadosDir, { recursive: true });
}

const scenarioFiles = fs.readdirSync(cenariosDir).filter((f: string) => f.endsWith('.json'));

if (scenarioFiles.length === 0) {
  console.error('Nenhum cenário encontrado na pasta experimentos/cenarios. Execute o gerador primeiro.');
  process.exit(1);
}

const strategiesToCompare = [
  'main-heuristic',
  'urgency-baseline',
  'nearest-baseline'
];

const benchmarkRecords: BenchmarkRecord[] = [];

console.log(`🚀 Iniciando execução em lote de ${scenarioFiles.length} cenários x ${strategiesToCompare.length} métodos...\n`);

for (const file of scenarioFiles) {
  const filePath = path.join(cenariosDir, file);
  const scenarioContent = fs.readFileSync(filePath, 'utf-8');
  const scenario: Scenario = JSON.parse(scenarioContent);

  console.log(`📌 Processando Cenário: ${scenario.id} (${scenario.patients.length} pacientes, ${scenario.teams.length} equipes)`);

  for (const strategyId of strategiesToCompare) {
    const startTime = performance.now();
    let plan: Plan;

    try {
      plan = planScenario(scenario, { strategyId, enable1_5Opt: true });
      const endTime = performance.now();
      const executionTimeMs = Number((endTime - startTime).toFixed(3));

      const record: BenchmarkRecord = {
        scenarioId: scenario.id,
        patientCount: scenario.patients.length,
        teamCount: scenario.teams.length,
        strategyId,
        executionTimeMs,
        coveragePercentage: plan.metrics.coveragePercentage,
        onTimeCoveragePercentage: plan.metrics.onTimeCoveragePercentage,
        priorityWeightedCoveragePercentage: plan.metrics.priorityWeightedCoveragePercentage,
        priorityWeightedOnTimeCoveragePercentage: plan.metrics.priorityWeightedOnTimeCoveragePercentage,
        priorityWeightedPromptCoveragePercentage: plan.metrics.priorityWeightedPromptCoveragePercentage,
        priorityWeightedAverageDelayDays: plan.metrics.priorityWeightedAverageDelayDays,
        priorityWeightedActionableDelayDays: plan.metrics.priorityWeightedActionableDelayDays,
        p90AllocatedDelayDays: plan.metrics.p90AllocatedDelayDays,
        delayOnTime: plan.metrics.delayBuckets.onTime,
        delayOneToTwoDays: plan.metrics.delayBuckets.oneToTwoDays,
        delayThreeToSevenDays: plan.metrics.delayBuckets.threeToSevenDays,
        delayOverSevenDays: plan.metrics.delayBuckets.overSevenDays,
        delayUnallocated: plan.metrics.delayBuckets.unallocated,
        distancePerAllocatedVisitKm: plan.metrics.distancePerAllocatedVisitKm,
        travelTimePerAllocatedVisitMinutes: plan.metrics.travelTimePerAllocatedVisitMinutes,
        timelyPriorityPointsPerKm: plan.metrics.timelyPriorityPointsPerKm,
        priorityPointsPerKm: plan.metrics.priorityPointsPerKm,
        totalOverdueDays: plan.metrics.totalOverdueDays,
        totalTravelDistanceKm: plan.metrics.totalTravelDistanceKm,
        totalTravelTimeMinutes: plan.metrics.totalTravelTimeMinutes,
        teamUtilizationPercentage: plan.metrics.teamUtilizationPercentage,
        teamWorkloadImbalance: plan.metrics.teamWorkloadImbalance,
        unallocatedCount: plan.unallocatedVisits.length
      };

      benchmarkRecords.push(record);

      console.log(`  └─ Método [${strategyId}]: ${executionTimeMs} ms | Cobertura: ${record.coveragePercentage}% | Pontual ponderada: ${record.priorityWeightedOnTimeCoveragePercentage}% | Dist: ${record.totalTravelDistanceKm} km`);
    } catch (err: any) {
      throw new Error(`Falha em ${scenario.id}/${strategyId}: ${err.message}`);
    }
  }
}

// Exportar Resultados para JSON
const jsonPath = path.join(resultadosDir, 'benchmark_results.json');
fs.writeFileSync(jsonPath, JSON.stringify(benchmarkRecords, null, 2), 'utf-8');
console.log(`\n💾 Resultados JSON salvos em: ${jsonPath}`);

// Exportar Resultados para CSV
const csvHeader = [
  'scenarioId',
  'patientCount',
  'teamCount',
  'strategyId',
  'executionTimeMs',
  'coveragePercentage',
  'onTimeCoveragePercentage',
  'priorityWeightedCoveragePercentage',
  'priorityWeightedOnTimeCoveragePercentage',
  'priorityWeightedPromptCoveragePercentage',
  'priorityWeightedAverageDelayDays',
  'priorityWeightedActionableDelayDays',
  'p90AllocatedDelayDays',
  'delayOnTime',
  'delayOneToTwoDays',
  'delayThreeToSevenDays',
  'delayOverSevenDays',
  'delayUnallocated',
  'distancePerAllocatedVisitKm',
  'travelTimePerAllocatedVisitMinutes',
  'timelyPriorityPointsPerKm',
  'priorityPointsPerKm',
  'totalOverdueDays',
  'totalTravelDistanceKm',
  'totalTravelTimeMinutes',
  'teamUtilizationPercentage',
  'teamWorkloadImbalance',
  'unallocatedCount'
].join(',');

const csvRows = benchmarkRecords.map(r => [
  `"${r.scenarioId}"`,
  r.patientCount,
  r.teamCount,
  `"${r.strategyId}"`,
  r.executionTimeMs,
  r.coveragePercentage,
  r.onTimeCoveragePercentage,
  r.priorityWeightedCoveragePercentage,
  r.priorityWeightedOnTimeCoveragePercentage,
  r.priorityWeightedPromptCoveragePercentage,
  r.priorityWeightedAverageDelayDays,
  r.priorityWeightedActionableDelayDays,
  r.p90AllocatedDelayDays,
  r.delayOnTime,
  r.delayOneToTwoDays,
  r.delayThreeToSevenDays,
  r.delayOverSevenDays,
  r.delayUnallocated,
  r.distancePerAllocatedVisitKm,
  r.travelTimePerAllocatedVisitMinutes,
  r.timelyPriorityPointsPerKm,
  r.priorityPointsPerKm,
  r.totalOverdueDays,
  r.totalTravelDistanceKm,
  r.totalTravelTimeMinutes,
  r.teamUtilizationPercentage,
  r.teamWorkloadImbalance,
  r.unallocatedCount
].join(','));

const csvPath = path.join(resultadosDir, 'benchmark_results.csv');
fs.writeFileSync(csvPath, `${csvHeader}\n${csvRows.join('\n')}`, 'utf-8');
console.log(`💾 Resultados CSV salvos em: ${csvPath}`);

console.log('\n✨ Simulação em lote concluída com sucesso!');
