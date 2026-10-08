import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planScenario, verifyPlan } from '../../artefato/packages/core/dist/index.js';
import { validateScenario } from '../../artefato/packages/core/dist/validation/scenario.js';
import { runDynamicSimulation } from '../dist/simulador/simulador-dinamico.js';
import { buildWalkingCostMatrix } from '../../artefato/packages/server/dist/routes/road-matrix.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const refreshMatrices = process.argv.includes('--refresh-matrices');
if (!process.env.OSRM_BASE_URL) throw new Error('Configure OSRM_BASE_URL para o benchmark a pé.');
const scenarioDir = path.join(root, 'cenarios');
const resultDir = path.join(root, 'resultados', 'porto-alegre-caminhada');
const reportDir = path.join(root, 'analise', 'porto-alegre-caminhada');
const matrixDir = path.join(resultDir, 'matrices');
const previousExclusionsFile = path.join(resultDir, 'exclusions.json');
const cachedExclusions = !refreshMatrices && fs.existsSync(previousExclusionsFile)
  ? new Map(JSON.parse(fs.readFileSync(previousExclusionsFile, 'utf8')).map(item => [item.scenarioId, item]))
  : new Map();
const methods = ['main-heuristic', 'nearest-baseline', 'urgency-baseline'];
const missRates = [0, 0.05, 0.1];
const days = 22;
const files = fs.readdirSync(scenarioDir).filter(file => /^geosaude_.*_30\.json$/.test(file)).sort();
if (files.length !== 132) throw new Error(`Esperados 132 territórios GeoSaúde, encontrados ${files.length}.`);
fs.mkdirSync(resultDir, { recursive: true });
fs.mkdirSync(reportDir, { recursive: true });
fs.mkdirSync(matrixDir, { recursive: true });

const records = [];
const exclusions = [];
for (const [index, file] of files.entries()) {
  const base = JSON.parse(fs.readFileSync(path.join(scenarioDir, file), 'utf8'));
  if (base.patients.length !== 30 || base.teams.length !== 1 || base.polygons.length === 0) {
    throw new Error(`Cenário incompatível: ${file}`);
  }
  const scenario = { ...base, planningHorizonDays: days };
  const eligiblePatients = validateScenario(scenario).eligiblePatients;
  const matrixFile = path.join(matrixDir, `${scenario.id}.json`);
  if (!fs.existsSync(matrixFile) && cachedExclusions.has(scenario.id)) {
    exclusions.push(cachedExclusions.get(scenario.id));
    continue;
  }
  let costMatrix;
  try {
    if (!refreshMatrices && fs.existsSync(matrixFile)) costMatrix = JSON.parse(fs.readFileSync(matrixFile, 'utf8'));
    else {
      costMatrix = await buildWalkingCostMatrix({ ...scenario, patients: eligiblePatients });
      fs.writeFileSync(matrixFile, JSON.stringify(costMatrix));
    }
  } catch (error) {
    if (!String(error).includes('Sem caminho a pé')) throw error;
    exclusions.push({ source: file, scenarioId: scenario.id, reason: String(error) });
    continue;
  }
  for (const method of methods) {
    const plan = planScenario(scenario, { strategyId: method, enable1_5Opt: true, costMatrix });
    const verification = verifyPlan(scenario, plan);
    if (!verification.isValid) throw new Error(`${file}/${method}: ${verification.errors.join('; ')}`);
    for (const missRate of missRates) {
      const result = runDynamicSimulation(scenario, method, missRate, days, costMatrix, scenario.id);
      records.push({ territory: scenario.polygons[0].name, scenarioId: scenario.id,
        source: file, ...result });
    }
  }
  if ((index + 1) % 22 === 0) console.log(`Porto Alegre: ${index + 1}/${files.length} territórios`);
}
const includedCount = files.length - exclusions.length;
if (!includedCount || records.length !== includedCount * methods.length * missRates.length) {
  throw new Error('Número de execuções inesperado.');
}
fs.writeFileSync(path.join(resultDir, 'exclusions.json'), JSON.stringify(exclusions, null, 2));
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
  ['Prioridade atendida a tempo', 'realPriorityWeightedPromptCoveragePercentage', 'maior', true],
  ['Cobertura efetiva', 'realCoveragePercentage', 'maior', true],
  ['Atraso controlável', 'realPriorityWeightedActionableDelayDays', 'menor', false],
  ['Distância a pé', 'realTravelDistanceKm', 'menor', false],
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

Começamos com **${files.length} territórios GeoSaúde**. ${exclusions.length} ${exclusions.length === 1 ? 'território não tinha caminho a pé completo' : 'territórios não tinham caminhos a pé completos'}. Avaliamos os **${includedCount} restantes**, cada um com **30 pacientes sintéticos**, uma equipe e um horizonte de **${days} dias úteis**. A prioridade atendida a tempo da heurística foi **${format(main.realPriorityWeightedPromptCoveragePercentage)}%**, ante **${format(nearest.realPriorityWeightedPromptCoveragePercentage)}%** do vizinho mais próximo. A diferença é **${format(main.realPriorityWeightedPromptCoveragePercentage - nearest.realPriorityWeightedPromptCoveragePercentage)} pontos percentuais**, ou **${format(relative(main, nearest, 'realPriorityWeightedPromptCoveragePercentage'), 1)}% em termos relativos** à média do vizinho mais próximo.

**O que a métrica mede:** some os pesos das visitas feitas a tempo. Divida pela soma dos pesos de todas as visitas da demanda inicial. Multiplique por 100. Visitas já vencidas antes da simulação contam se forem feitas no primeiro dia. Por exemplo, pesos 1, 3 e 5 somam 9 pontos. Se só a visita de peso 5 for feita a tempo, o resultado é 5 ÷ 9 = 55,56% dos pontos de prioridade. Não é a porcentagem de pacientes atendidos.

## Slide 1 — Prioridade atendida a tempo e caminhada

${table}

**Como falar:** “O ganho principal está nos pontos de prioridade atendidos a tempo. A cobertura total muda menos. A distância ${main.realTravelDistanceKm <= nearest.realTravelDistanceKm ? 'foi menor' : 'foi maior'}, mas o cálculo ficou mais caro.” A variação percentual é \`(principal − vizinho) / vizinho\`: positiva significa aumento do indicador, negativa significa redução. O tempo de cálculo é mostrado como múltiplo para evitar um percentual pouco legível; ${format(main.totalPlanningTimeMs / 1000)} s por simulação mensal ainda é curto em termos operacionais.

## Slide 2 — O ganho resiste às ausências?

| Chance de ausência por tentativa | Ganho de prioridade atendida a tempo ante o vizinho | Distância adicional ante o vizinho |
|---:|---:|---:|
${rateRows}

Foram ${groups.size} comparações pareadas: ${includedCount} territórios com caminhos completos × ${missRates.length} probabilidades de ausência. Cada par compara a heurística principal com o vizinho mais próximo no mesmo território e com a mesma probabilidade de ausência. A principal venceu em prioridade atendida a tempo em ${paired['nearest-baseline'].promptWins} pares, empatou ${paired['nearest-baseline'].promptTies} e perdeu ${paired['nearest-baseline'].promptLosses}; essas três contagens somam ${groups.size}. Caminhou mais em ${paired['nearest-baseline'].distanceAddedCases} pares. Frente à estratégia de urgência, a prioridade atendida a tempo média foi ${format(relative(main, urgency, 'realPriorityWeightedPromptCoveragePercentage'), 1)}% maior e a distância média foi ${format(relative(main, urgency, 'realTravelDistanceKm', false), 1)}% menor.

## Slide 3 — O que foi comparado e o que ainda falta

- **Métodos:** vizinho próximo escolhe a próxima visita elegível mais perto; urgência ordena por peso clínico; a principal combina construção geográfica, 1.5-opt, realocação entre dias e recuperação de pendências prioritárias.
- **Desenho:** importamos ${files.length} territórios GeoSaúde. ${includedCount} tinham matriz de caminhada completa${exclusions.length ? `; ${exclusions.length} ${exclusions.length === 1 ? 'foi excluído' : 'foram excluídos'} por falta de caminho a pé (lista em \`resultados/porto-alegre-caminhada/exclusions.json\`)` : ''}. Em cada território avaliado, simulamos 30 pacientes, uma equipe de 240 minutos por dia e ${days} dias úteis. Repetimos cada território para ausência de 0%, 5% e 10% por tentativa e aplicamos as três estratégias. Assim, ${includedCount} territórios × ${missRates.length} probabilidades de ausência × ${methods.length} estratégias = ${records.length} execuções dinâmicas. A principal concluiu em média ${format(main.completedVisits, 1)} atendimentos por execução. Esse valor pode superar 30 porque um paciente pode precisar de outra visita no mesmo mês. Todos os planos iniciais passaram por \`verifyPlan\`.
- **Leitura correta de “média de Porto Alegre”:** média das ${includedCount} regiões avaliadas, com **uma amostra sintética por região** e peso igual para cada região e taxa de falha. Não é estimativa populacional nem média de pacientes reais.
- **Modelo de custo:** distâncias e tempos obtidos pela API Table do OSRM local, preparado com a malha OpenStreetMap e perfil de caminhada. Pontos sintéticos são conectados à rede pelo OSRM; caminhos sem conexão fazem a execução falhar. Pacientes, prioridades, prazos e ausências não são observados. Portanto, os percentuais são **eficiência simulada do algoritmo**, não benefício clínico medido na população.

## Apuração e reprodução

Os números foram calculados a partir de [cada execução em CSV](../../resultados/porto-alegre-caminhada/dynamic.csv) e [JSON](../../resultados/porto-alegre-caminhada/dynamic.json), que são saídas regeneráveis da bancada. Para repetir:

\`\`\`bash
npm run build --prefix artefato/packages/core
npm run build --prefix artefato/packages/server
npm run build --prefix experimentos
OSRM_BASE_URL=http://127.0.0.1:5000 npm run citywide:report --prefix experimentos
\`\`\`

A [varredura fatorial da Restinga](../fatorial-caminhada/relatorio.html) detalha como número de pacientes, área, prazo, atraso inicial e falhas mudam o desempenho; ela é complementar e não foi usada para chamar o resultado acima de média da cidade.
`;
fs.writeFileSync(path.join(reportDir, 'resumo-slides.md'), report);
fs.writeFileSync(path.join(resultDir, 'summary.json'), JSON.stringify({ territoriesImported: files.length,
  territoriesEvaluated: includedCount, territoriesExcluded: exclusions.length, methods,
  missRates, days, costModel: 'OSRM foot / OpenStreetMap',
  cases: groups.size, absolute, paired }, null, 2));
console.log(`Resumo: ${path.join(reportDir, 'resumo-slides.md')}`);
