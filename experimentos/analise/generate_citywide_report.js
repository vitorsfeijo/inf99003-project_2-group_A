import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planScenario, verifyPlan } from '../../artefato/packages/core/dist/index.js';
import { runDynamicSimulation } from '../dist/simulador/simulador-dinamico.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scenarioDir = path.join(root, 'cenarios');
const resultDir = path.join(root, 'resultados', 'porto-alegre');
const reportDir = path.join(root, 'analise', 'porto-alegre');
const methods = ['main-heuristic', 'nearest-baseline', 'urgency-baseline'];
const missRates = [0, 0.05, 0.1];
const days = 22;
const walkingSpeedKmh = 4.5;
const files = fs.readdirSync(scenarioDir).filter(file => /^geosaude_.*_30\.json$/.test(file)).sort();
if (files.length !== 132) throw new Error(`Esperados 132 territórios GeoSaúde, encontrados ${files.length}.`);
fs.mkdirSync(resultDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });

const records = [];
for (const [index, file] of files.entries()) {
  const base = JSON.parse(fs.readFileSync(path.join(scenarioDir, file), 'utf8'));
  if (base.patients.length !== 30 || base.teams.length !== 1 || base.polygons.length === 0) {
    throw new Error(`Cenário incompatível: ${file}`);
  }
  const scenario = { ...base, planningHorizonDays: days,
    costParameters: { ...base.costParameters, travelSpeedKmh: walkingSpeedKmh } };
  for (const method of methods) {
    const plan = planScenario(scenario, { strategyId: method, enable1_5Opt: true });
    const verification = verifyPlan(scenario, plan);
    if (!verification.isValid) throw new Error(`${file}/${method}: ${verification.errors.join('; ')}`);
    for (const missRate of missRates) {
      const result = runDynamicSimulation(scenario, method, missRate, days, scenario.id);
      records.push({ territory: scenario.polygons[0].name, scenarioId: scenario.id,
        source: file, ...result });
    }
  }
  if ((index + 1) % 22 === 0) console.log(`Porto Alegre: ${index + 1}/${files.length} territórios`);
}
if (records.length !== files.length * methods.length * missRates.length) {
  throw new Error('Número de execuções inesperado.');
}
for (const record of records) {
  if (Object.values(record).some(value => value === null || typeof value === 'number' && !Number.isFinite(value))) {
    throw new Error(`Resultado inválido: ${record.scenarioId}/${record.strategyId}/${record.missRate}`);
  }
}
fs.writeFileSync(path.join(resultDir, 'dynamic.json'), JSON.stringify(records, null, 2));
const columns = ['territory', 'scenarioId', 'source', 'strategyId', 'missRate', 'patientCount',
  'completedVisits', 'missedVisits', 'unservedVisits', 'realCoveragePercentage',
  'realPriorityWeightedCoveragePercentage', 'realPriorityWeightedPromptCoveragePercentage',
  'realPriorityWeightedActionableDelayDays', 'realTravelDistanceKm', 'totalPlanningTimeMs'];
const cell = value => `"${String(value).replaceAll('"', '""')}"`;
fs.writeFileSync(path.join(resultDir, 'dynamic.csv'),
  [columns.join(','), ...records.map(row => columns.map(column => cell(row[column])).join(','))].join('\n') + '\n');
const mean = (rows, field) => rows.reduce((sum, row) => sum + row[field], 0) / rows.length;
const format = (number, digits = 2) => number.toFixed(digits).replace('.', ',');
const absolute = Object.fromEntries(methods.map(method => {
  const rows = records.filter(row => row.strategyId === method);
  return [method, Object.fromEntries(['realCoveragePercentage',
    'realPriorityWeightedPromptCoveragePercentage', 'realPriorityWeightedActionableDelayDays',
    'realTravelDistanceKm', 'totalPlanningTimeMs', 'completedVisits', 'unservedVisits']
    .map(field => [field, mean(rows, field)]))];
}));
const groups = new Map();
for (const row of records) {
  const key = `${row.scenarioId}|${row.missRate}`;
  if (!groups.has(key)) groups.set(key, new Map());
  groups.get(key).set(row.strategyId, row);
}
const paired = {};
for (const baseline of methods.slice(1)) {
  const changes = [...groups.values()].map(group => {
    if (group.size !== methods.length) throw new Error('Par incompleto.');
    const main = group.get(methods[0]), other = group.get(baseline);
    return {
      prompt: main.realPriorityWeightedPromptCoveragePercentage - other.realPriorityWeightedPromptCoveragePercentage,
      coverage: main.realCoveragePercentage - other.realCoveragePercentage,
      delay: other.realPriorityWeightedActionableDelayDays - main.realPriorityWeightedActionableDelayDays,
      distance: main.realTravelDistanceKm - other.realTravelDistanceKm,
      compute: main.totalPlanningTimeMs - other.totalPlanningTimeMs,
      missed: main.missedVisits - other.missedVisits,
      rate: main.missRate
    };
  });
  paired[baseline] = {
    promptPp: mean(changes, 'prompt'), coveragePp: mean(changes, 'coverage'),
    delayDaysSaved: mean(changes, 'delay'), distanceKmAdded: mean(changes, 'distance'),
    computeMsAdded: mean(changes, 'compute'),
    promptWins: changes.filter(item => item.prompt > 1e-8).length,
    promptTies: changes.filter(item => Math.abs(item.prompt) <= 1e-8).length,
    promptLosses: changes.filter(item => item.prompt < -1e-8).length,
    distanceAddedCases: changes.filter(item => item.distance > 1e-8).length,
    byRate: Object.fromEntries(missRates.map(rate => {
      const subset = changes.filter(item => item.rate === rate);
      return [rate, { promptPp: mean(subset, 'prompt'), coveragePp: mean(subset, 'coverage'),
        delayDaysSaved: mean(subset, 'delay'), distanceKmAdded: mean(subset, 'distance') }];
    }))
  };
}
const relative = (main, baseline, field, improvement = true) =>
  100 * (improvement ? main[field] - baseline[field] : baseline[field] - main[field]) / baseline[field];
const main = absolute['main-heuristic'], nearest = absolute['nearest-baseline'], urgency = absolute['urgency-baseline'];
const metrics = [
  ['Resposta pronta ponderada', 'realPriorityWeightedPromptCoveragePercentage', 'maior', true],
  ['Cobertura efetiva', 'realCoveragePercentage', 'maior', true],
  ['Atraso controlável', 'realPriorityWeightedActionableDelayDays', 'menor', false],
  ['Distância estimada', 'realTravelDistanceKm', 'menor', false],
  ['Cálculo acumulado', 'totalPlanningTimeMs', 'menor', false]
];
const table = [
  '| Indicador | Principal | Vizinho próximo | Urgência | Variação ante o vizinho |',
  '|---|---:|---:|---:|---:|',
  ...metrics.map(([name, field]) => {
    const unit = field.includes('Percentage') ? '%' : field.includes('Delay') ? ' dia(s)' :
      field.includes('Distance') ? ' km' : ' ms';
    const change = 100 * (main[field] - nearest[field]) / nearest[field];
    return `| ${name} | ${format(main[field])}${unit} | ${format(nearest[field])}${unit} | ` +
      `${format(urgency[field])}${unit} | ${field === 'totalPlanningTimeMs' ? `≈${format(main[field] / nearest[field], 0)}×` :
        `${change >= 0 ? '+' : ''}${format(change, 1)}%`} |`;
  })
].join('\n');
const rateRows = missRates.map(rate => {
  const row = paired['nearest-baseline'].byRate[rate];
  return `| ${format(rate * 100, 0)}% | +${format(row.promptPp)} p.p. | ` +
    `${row.distanceKmAdded >= 0 ? '+' : ''}${format(row.distanceKmAdded)} km |`;
}).join('\n');
const report = `# Comparação das rotas em Porto Alegre — resumo para slides

## Frase para abrir a apresentação

Em **${files.length} territórios GeoSaúde de Porto Alegre**, simulando ${days} dias úteis, 30 pacientes e uma equipe por território, nossa heurística entregou **${format(relative(main, nearest, 'realPriorityWeightedPromptCoveragePercentage'), 1)}% mais resposta pronta ponderada pela prioridade** que o vizinho mais próximo. A cobertura cresceu **${format(relative(main, nearest, 'realCoveragePercentage'), 1)}%**, enquanto o custo de distância estimada foi **${format(relative(main, nearest, 'realTravelDistanceKm', false), 1)}% ${main.realTravelDistanceKm <= nearest.realTravelDistanceKm ? 'menor' : 'maior'}**. O atraso controlável caiu **${format(relative(main, nearest, 'realPriorityWeightedActionableDelayDays', false), 1)}%**.

## Slide 1 — O ganho clínico e o custo

${table}

**Como falar:** “O ganho principal está em quem é atendido a tempo, ponderado pela prioridade clínica. A cobertura total muda menos. A distância foi ligeiramente menor, mas o cálculo ficou mais caro.” A variação percentual é \`(principal − vizinho) / vizinho\`: positiva significa aumento do indicador, negativa significa redução. O tempo de cálculo é mostrado como múltiplo para evitar um percentual pouco legível; ${format(main.totalPlanningTimeMs / 1000)} s por simulação mensal ainda é curto em termos operacionais.

## Slide 2 — O ganho resiste às ausências?

| Chance de ausência por tentativa | Ganho de resposta pronta ante o vizinho | Distância adicional ante o vizinho |
|---:|---:|---:|
${rateRows}

Foram ${groups.size} comparações pareadas, três taxas de falha para cada território. A principal venceu o vizinho em resposta pronta em ${paired['nearest-baseline'].promptWins} casos, empatou ${paired['nearest-baseline'].promptTies} e perdeu ${paired['nearest-baseline'].promptLosses}. Teve distância maior em ${paired['nearest-baseline'].distanceAddedCases} casos. Ante a heurística de urgência, a resposta pronta cresceu ${format(relative(main, urgency, 'realPriorityWeightedPromptCoveragePercentage'), 1)}% e a distância foi ${format(relative(main, urgency, 'realTravelDistanceKm', false), 1)}% menor; a urgência teve cobertura inicial maior (${format(urgency.realCoveragePercentage)}%).

## Slide 3 — O que foi comparado e o que ainda falta

- **Métodos:** vizinho próximo escolhe a próxima visita elegível mais perto; urgência ordena por peso clínico; a principal combina construção geográfica, 1.5-opt, realocação entre dias e recuperação de pendências prioritárias.
- **Desenho:** ${files.length} polígonos oficiais importados, 30 pacientes sintéticos em cada um, uma equipe de 240 min/dia, ${days} dias úteis, velocidade estimada de ${format(walkingSpeedKmh, 1)} km/h e faltas de 0%, 5% e 10% por tentativa. Os pacientes podem precisar de novas visitas dentro do mês; a principal concluiu em média ${format(main.completedVisits, 1)} atendimentos por território. As três estratégias receberam o mesmo cenário de cada território; todos os planos iniciais passaram por \`verifyPlan\`.
- **Leitura correta de “média de Porto Alegre”:** média das ${files.length} regiões importadas, com **uma amostra sintética por região** e peso igual para cada região e taxa de falha. Não é estimativa populacional nem média de pacientes reais.
- **Limite decisivo:** quilômetros são calculados por Haversine, em linha reta; esta avaliação ainda não usa rotas a pé pelas ruas. Pacientes, prioridades, prazos e ausências não são observados. Portanto, os percentuais são **eficiência simulada do algoritmo**, não benefício clínico medido na população.

## Apuração e reprodução

Os números foram calculados a partir de [cada execução em CSV](../../resultados/porto-alegre/dynamic.csv) e [JSON](../../resultados/porto-alegre/dynamic.json), que são saídas regeneráveis da bancada. Para repetir:

\`\`\`bash
npm run build --prefix artefato/packages/core
npm run build --prefix experimentos
npm run citywide:report --prefix experimentos
\`\`\`

A [varredura fatorial da Restinga](../fatorial/relatorio.html) detalha como número de pacientes, área, prazo, atraso inicial e falhas mudam o desempenho; ela é complementar e não foi usada para chamar o resultado acima de média da cidade.
`;
fs.writeFileSync(path.join(reportDir, 'resumo-slides.md'), report);
fs.writeFileSync(path.join(resultDir, 'summary.json'), JSON.stringify({ territories: files.length, methods,
  missRates, days, walkingSpeedKmh, cases: groups.size, absolute, paired }, null, 2));
console.log(`Resumo: ${path.join(reportDir, 'resumo-slides.md')}`);
