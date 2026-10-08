import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { planScenario, sampleTerritoryPatients, verifyPlan, type Scenario, type CostMatrix } from '../../../artefato/packages/core/dist/index.js';
import { validateScenario } from '../../../artefato/packages/core/dist/validation/scenario.js';
import { buildWalkingCostMatrix } from '../../../artefato/packages/server/dist/routes/road-matrix.js';
import { mulberry32 } from '../../../artefato/packages/core/dist/sampling/territory.js';
import { runDynamicSimulation, type DynamicSimulationRecord } from '../simulador/simulador-dinamico.js';

const design = {
  territory: 'US Restinga', sourceScenario: 'geosaude_us_restinga_20261106_30',
  startDate: '2026-10-01', endDate: '2027-09-30', workingDays: 261,
  patients: 250, teamCount: 1, dailyWorkMinutes: 300,
  seeds: [20261008, 20261009, 20261010],
  overdueProbability: 0.25, missRates: [0, 0.05, 0.1],
  strategies: ['main-heuristic', 'nearest-baseline', 'urgency-baseline'],
  maxAnticipationDays: 2, revisitIntervalDays: 1000,
  horizonMode: 'fixed' as const
};
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = path.join(root, 'resultados', 'longo-250-caminhada');
const reportDir = path.join(root, 'analise', 'longo-250-caminhada');
const matrixDir = path.join(outputDir, 'matrices');
const refresh = process.argv.includes('--refresh-matrices');

type Row = DynamicSimulationRecord & { seed: number; overdueCount: number };
type StaticRow = { seed: number; strategyId: string; allocatedVisits: number; unallocatedVisits: number;
  coveragePercentage: number; priorityWeightedPromptCoveragePercentage: number; totalTravelDistanceKm: number };
function readJson<T>(file: string, fallback: T): T {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as T : fallback;
}
function saveJson(file: string, data: unknown): void { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function makeScenario(base: Scenario, seed: number): { scenario: Scenario; overdueCount: number } {
  const sampled = sampleTerritoryPatients(base, design.patients, seed);
  const random = mulberry32(seed ^ 0x5a17cafe);
  let overdueCount = 0;
  const patients = sampled.patients.map(patient => {
    const overdue = random() < design.overdueProbability;
    const overdueDays = 1 + Math.floor(random() * 10);
    const dueOffset = Math.floor(random() * 123); // 1º de outubro a 31 de janeiro, inclusive.
    if (overdue) overdueCount++;
    const dueDate = addDays(design.startDate, overdue ? -overdueDays : dueOffset);
    return { ...patient, conditions: patient.conditions.map(condition => ({
      ...condition, lastVisitDate: undefined, initialDueDate: dueDate,
      maxIntervalDays: design.revisitIntervalDays
    })) };
  });
  const scenario: Scenario = {
    ...sampled, id: `longo_restinga_s${seed}_p${design.patients}`,
    startDate: design.startDate, planningHorizonDays: design.workingDays,
    maxAnticipationDays: design.maxAnticipationDays,
    teams: sampled.teams.map(team => ({ ...team, dailyWorkMinutes: design.dailyWorkMinutes, availableDays: [] })),
    patients
  };
  const validation = validateScenario(scenario);
  if (!validation.isValid || validation.eligiblePatients.length !== design.patients) {
    throw new Error(`Cenário longo inválido (${seed}): ${validation.errors.join('; ')}`);
  }
  return { scenario, overdueCount };
}
function saveCsv<T extends object>(file: string, rows: T[]): void {
  if (!rows.length) return;
  const fields = Object.keys(rows[0]);
  const encode = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
  fs.writeFileSync(file, [fields.join(','), ...rows.map(row => fields.map(field => encode((row as Record<string, unknown>)[field])).join(','))].join('\n') + '\n');
}
function average(rows: Row[], key: keyof Row): number {
  return rows.reduce((sum, row) => sum + Number(row[key]), 0) / rows.length;
}
function fmt(value: number, digits = 2): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function writeReport(rows: Row[], staticRows: StaticRow[], includedSeeds: number[], exclusions: unknown[]): void {
  const expected = includedSeeds.length * design.strategies.length * design.missRates.length;
  if (rows.length !== expected) throw new Error(`Relatório incompleto: ${rows.length}/${expected} execuções.`);
  const capacity = readJson<{ sufficientMonths: number; rows: { months: number; strategyId: string; allocated: number }[] }>(
    path.join(outputDir, 'capacity.json'), { sufficientMonths: 0, rows: [] });
  if (capacity.sufficientMonths !== 12 || capacity.rows.filter(row => row.months === 12).length !== 9) {
    throw new Error('Falta a verificação de capacidade para a janela de 12 meses.');
  }
  const range = (months: number, strategyId: string) => {
    const counts = capacity.rows.filter(row => row.months === months && row.strategyId === strategyId).map(row => row.allocated);
    if (counts.length !== includedSeeds.length) throw new Error(`Contagem incompleta: ${months}/${strategyId}.`);
    return `${Math.min(...counts)} a ${Math.max(...counts)} de ${design.patients}`;
  };
  const completionRange = (selected: Row[]) =>
    `${Math.min(...selected.map(row => row.daysToComplete))} a ${Math.max(...selected.map(row => row.daysToComplete))}`;
  const signed = (value: number) => `${value >= 0 ? '+' : ''}${fmt(value)}`;
  fs.mkdirSync(reportDir, { recursive: true });
  const lines = [
    '# 250 pacientes: capacidade em quatro meses e tempo para concluir todas as visitas', '',
    '## Desenho', '',
    `Simulamos **${design.patients} pacientes** sintéticos na área da **${design.territory}**. Usamos uma equipe com **${design.dailyWorkMinutes} minutos por dia**. Os prazos iniciais das visitas ficam entre outubro de 2026 e janeiro de 2027; parte começa vencida. O prazo máximo de operação é **12 meses**, de 1º de outubro de 2026 a 30 de setembro de 2027. São **${design.workingDays} dias de segunda a sexta**. Feriados não foram retirados. Cada paciente precisa de uma visita inicial. O intervalo de ${design.revisitIntervalDays} dias impede uma segunda visita dentro da simulação.`, '',
    `As distâncias e durações de caminhada vêm da matriz da API Table do OSRM com \`foot.lua\` e OpenStreetMap. Ela é a mesma para as três estratégias. Os endereços dos pacientes, prazos, prioridades e ausências são simulados. Foram usadas **${includedSeeds.length} sementes × ${design.strategies.length} estratégias × ${design.missRates.length} probabilidades de ausência = ${rows.length} execuções**.${exclusions.length ? ` ${exclusions.length} sementes foram excluídas por falta de caminho a pé.` : ' Nenhuma semente foi excluída.'}`, '',
    '## Teste de capacidade', '',
    `Em um teste preliminar com jornada de 240 minutos, alguns pacientes não cabiam nem em um dia isolado: o trajeto de ida, a visita e a volta podiam exigir 265,6 minutos. Por isso a jornada foi fixada em **300 minutos por dia** nos dois testes abaixo. O prazo não resolve uma visita que ultrapassa a jornada diária.`, '',
    `Em **quatro meses** (outubro de 2026 a janeiro de 2027), a heurística colocou ${range(4, 'main-heuristic')} visitas no plano inicial entre as três sementes. O vizinho mais próximo colocou ${range(4, 'nearest-baseline')}. A regra de urgência colocou ${range(4, 'urgency-baseline')}.`, '',
    `Em **12 meses**, todos os **nove planos iniciais** (3 sementes × 3 estratégias) colocaram **250 de 250 visitas**. A janela de 12 meses é um limite amplo comum para comparar quanto tempo cada método leva para terminar. Ela não é uma afirmação de que o atendimento precisa durar um ano. As contagens individuais estão em [capacity.csv](../../resultados/longo-250-caminhada/capacity.csv).`, '',
    '## Tempo para concluir as 250 visitas', '',
    'O tempo abaixo é contado desde 1º de outubro de 2026 até a última visita concluída. Uma falta mantém a visita pendente, com o prazo original. O plano é recalculado depois de cada falta. Todos os planos gerados passam por `verifyPlan`. A mesma combinação de paciente e dia usa o mesmo sorteio de ausência entre estratégias.', '',
    '| Ausência por tentativa | Estratégia | Visitas concluídas | Dias úteis até concluir: média (mín.–máx.) | Caminhada média | Tempo médio de cálculo |',
    '|---:|---|---:|---:|---:|---:|'
  ];
  for (const missRate of design.missRates) for (const strategyId of design.strategies) {
    const selected = rows.filter(row => row.missRate === missRate && row.strategyId === strategyId);
    lines.push(`| ${fmt(missRate * 100, 0)}% | ${strategyId} | ${fmt(average(selected, 'completedVisits'), 0)} de ${design.patients} | ${fmt(average(selected, 'daysToComplete'))} (${completionRange(selected)}) | ${fmt(average(selected, 'realTravelDistanceKm'))} km | ${fmt(average(selected, 'totalPlanningTimeMs') / 1000)} s |`);
  }
  const main = rows.filter(row => row.strategyId === 'main-heuristic');
  const nearest = rows.filter(row => row.strategyId === 'nearest-baseline');
  const mainDays = average(main, 'daysToComplete');
  const nearestDays = average(nearest, 'daysToComplete');
  const mainDistance = average(main, 'realTravelDistanceKm');
  const nearestDistance = average(nearest, 'realTravelDistanceKm');
  lines.push('', '## Comparação com o vizinho mais próximo', '',
    `A comparação usa **${main.length} pares = ${includedSeeds.length} sementes × ${design.missRates.length} probabilidades de ausência**. Cada par mantém os mesmos pacientes, prazos e matriz de caminhada.`, '',
    `A heurística terminou em **${fmt(mainDays)} dias úteis** em média. O vizinho terminou em **${fmt(nearestDays)} dias úteis**. A diferença é **${signed(mainDays - nearestDays)} dias úteis**. Valor negativo significa que a heurística terminou antes.`, '',
    `A caminhada média foi **${fmt(mainDistance)} km** com a heurística e **${fmt(nearestDistance)} km** com o vizinho. A variação relativa foi **${signed(100 * (mainDistance / nearestDistance - 1))}%**: (${fmt(mainDistance)} ÷ ${fmt(nearestDistance)} − 1) × 100. Valor positivo significa mais caminhada da heurística.`, '',
    '| Ausência | Dias úteis: heurística | Dias úteis: vizinho | Diferença em dias úteis | Variação da caminhada |',
    '|---:|---:|---:|---:|---:|'
  );
  for (const rate of design.missRates) {
    const selectedMain = main.filter(row => row.missRate === rate);
    const selectedNearest = nearest.filter(row => row.missRate === rate);
    const mainRateDays = average(selectedMain, 'daysToComplete');
    const nearestRateDays = average(selectedNearest, 'daysToComplete');
    const distancePct = 100 * (average(selectedMain, 'realTravelDistanceKm') / average(selectedNearest, 'realTravelDistanceKm') - 1);
    lines.push(`| ${fmt(rate * 100, 0)}% | ${fmt(mainRateDays)} | ${fmt(nearestRateDays)} | ${signed(mainRateDays - nearestRateDays)} | ${signed(distancePct)}% |`);
  }
  lines.push('', '## Limites e arquivos', '',
    `Todos os **${staticRows.length} planos iniciais** e todos os replanejamentos passaram por \`verifyPlan\`. A simulação para quando a visita inicial de todos os ${design.patients} pacientes é concluída. Quilômetros e minutos são previsões da rede de caminhada, não deslocamentos medidos em campo. As médias descrevem estas três sementes, não a população de Porto Alegre.`, '',
    'Os registros por execução estão em [dynamic.csv](../../resultados/longo-250-caminhada/dynamic.csv) e [dynamic.json](../../resultados/longo-250-caminhada/dynamic.json). O teste de capacidade está em [capacity.csv](../../resultados/longo-250-caminhada/capacity.csv). O [manifesto](../../resultados/longo-250-caminhada/manifest.json) registra o desenho. Passe `-- --refresh-matrices` ao comando de simulação quando mudar o grafo OSRM.', ''
  );
  fs.writeFileSync(path.join(reportDir, 'resumo.md'), lines.join('\n'));
}
async function main(): Promise<void> {
  if (!process.env.OSRM_BASE_URL) throw new Error('Configure OSRM_BASE_URL para usar rotas a pé.');
  fs.mkdirSync(matrixDir, { recursive: true });
  const base: Scenario = JSON.parse(fs.readFileSync(path.join(root, 'cenarios', `${design.sourceScenario}.json`), 'utf8'));
  const dynamicFile = path.join(outputDir, 'dynamic.json');
  const staticFile = path.join(outputDir, 'static.json');
  const rows = readJson<Row[]>(dynamicFile, []);
  const staticRows = readJson<StaticRow[]>(staticFile, []);
  const exclusions: { seed: number; reason: string }[] = [];
  const includedSeeds: number[] = [];
  for (const seed of design.seeds) {
    const { scenario, overdueCount } = makeScenario(base, seed);
    const matrixFile = path.join(matrixDir, `${scenario.id}.json`);
    let costMatrix: CostMatrix;
    try {
      if (!refresh && fs.existsSync(matrixFile)) costMatrix = JSON.parse(fs.readFileSync(matrixFile, 'utf8')) as CostMatrix;
      else {
        console.log(`Calculando matriz a pé para ${seed}: ${design.patients + 1} pontos.`);
        costMatrix = await buildWalkingCostMatrix(scenario);
        saveJson(matrixFile, costMatrix);
      }
    } catch (error) {
      if (!String(error).includes('Sem caminho a pé')) throw error;
      exclusions.push({ seed, reason: String(error) });
      console.log(`Semente ${seed} excluída: ${String(error)}`);
      continue;
    }
    includedSeeds.push(seed);
    for (const strategyId of design.strategies) {
      if (!staticRows.some(row => row.seed === seed && row.strategyId === strategyId)) {
        const plan = planScenario(scenario, { strategyId, costMatrix, enable1_5Opt: true });
        const verification = verifyPlan(scenario, plan);
        if (!verification.isValid) throw new Error(`Plano inicial inválido: ${verification.errors.join('; ')}`);
        staticRows.push({ seed, strategyId,
          allocatedVisits: plan.routes.reduce((sum, route) => sum + route.visits.length, 0),
          unallocatedVisits: plan.unallocatedVisits.length,
          coveragePercentage: plan.metrics.coveragePercentage,
          priorityWeightedPromptCoveragePercentage: plan.metrics.priorityWeightedPromptCoveragePercentage,
          totalTravelDistanceKm: plan.metrics.totalTravelDistanceKm });
        saveJson(staticFile, staticRows);
      }
      if ((staticRows.find(row => row.seed === seed && row.strategyId === strategyId)?.allocatedVisits ?? 0) !== design.patients) {
        throw new Error(`A janela ampla não acomodou todas as visitas no plano inicial: ${seed}/${strategyId}.`);
      }
      for (const missRate of design.missRates) {
        if (rows.some(row => row.seed === seed && row.strategyId === strategyId && row.missRate === missRate)) continue;
        console.log(`Simulando ${seed}, ${strategyId}, ausência ${fmt(missRate * 100, 0)}%.`);
        const record = runDynamicSimulation(scenario, strategyId, missRate, design.workingDays,
          costMatrix, scenario.id, design.horizonMode);
        if (record.completedVisits + record.unservedVisits !== design.patients) {
          throw new Error(`Demanda inicial inesperada em ${seed}/${strategyId}/${missRate}.`);
        }
        if (record.completedVisits !== design.patients || record.daysToComplete === 0) {
          throw new Error(`Prazo de 12 meses insuficiente em ${seed}/${strategyId}/${missRate}: ${record.completedVisits}/${design.patients}.`);
        }
        rows.push({ ...record, seed, overdueCount });
        saveJson(dynamicFile, rows);
        saveCsv(path.join(outputDir, 'dynamic.csv'), rows);
      }
    }
  }
  saveJson(path.join(outputDir, 'exclusions.json'), exclusions);
  const manifest = { design, capacityCriterion: 'Cada plano inicial aloca todas as 250 visitas.',
    attemptedSeeds: design.seeds.length, includedSeeds,
    excludedSeeds: exclusions.length, initialPlanCount: staticRows.length, executionCount: rows.length,
    costModel: 'OSRM foot / OpenStreetMap: distância e duração da API Table' };
  saveJson(path.join(outputDir, 'manifest.json'), manifest);
  saveCsv(path.join(outputDir, 'static.csv'), staticRows);
  if (!includedSeeds.length) throw new Error('Nenhuma semente tinha matriz de caminhada completa.');
  writeReport(rows, staticRows, includedSeeds, exclusions);
  console.log(`Relatório: ${path.join(reportDir, 'resumo.md')}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
