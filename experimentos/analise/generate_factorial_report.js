import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folder = 'fatorial-caminhada';
const dataDir = path.join(root, 'resultados', folder);
const reportDir = path.join(root, 'analise', folder);
const read = name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
const manifest = read('manifest.json');
const staticRows = read('static.json');
const dynamicRows = read('dynamic.json');
fs.mkdirSync(reportDir, { recursive: true });
if (staticRows.length !== manifest.staticRecordCount || dynamicRows.length !== manifest.dynamicRecordCount ||
    staticRows.length !== manifest.instanceCount * manifest.design.strategies.length ||
    dynamicRows.length !== staticRows.length * manifest.design.missRates.length) {
  throw new Error('Contagens dos resultados não correspondem ao desenho fatorial.');
}
for (const [kind, rows] of [['static', staticRows], ['dynamic', dynamicRows]]) {
  const keys = new Set();
  for (const row of rows) {
    const key = `${row.scenarioId}|${kind === 'dynamic' ? row.missRate : ''}|${row.strategyId}`;
    if (keys.has(key)) throw new Error(`Execução duplicada: ${key}`);
    keys.add(key);
    if (Object.values(row).some(value => value === null || typeof value === 'number' && !Number.isFinite(value))) {
      throw new Error(`Valor inválido em ${key}`);
    }
  }
}

const metrics = {
  dynamic: [
    { key: 'realCoveragePercentage', label: 'Cobertura efetiva', unit: 'p.p.', higher: true },
    { key: 'realPriorityWeightedPromptCoveragePercentage', label: 'Prioridade atendida a tempo', unit: 'p.p.', higher: true },
    { key: 'realPriorityWeightedActionableDelayDays', label: 'Atraso controlável ponderado', unit: 'dias', higher: false },
    { key: 'realTravelDistanceKm', label: 'Distância percorrida', unit: 'km', higher: false },
    { key: 'totalPlanningTimeMs', label: 'Tempo total de planejamento', unit: 'ms', higher: false }
  ],
  static: [
    { key: 'coveragePercentage', label: 'Cobertura planejada', unit: 'p.p.', higher: true },
    { key: 'priorityWeightedPromptCoveragePercentage', label: 'Prioridade atendida a tempo no plano', unit: 'p.p.', higher: true },
    { key: 'priorityWeightedActionableDelayDays', label: 'Atraso controlável planejado', unit: 'dias', higher: false },
    { key: 'totalTravelDistanceKm', label: 'Distância planejada', unit: 'km', higher: false },
    { key: 'planningTimeMs', label: 'Tempo para gerar plano', unit: 'ms', higher: false }
  ]
};
const factors = [
  { key: 'patientCount', label: 'Pacientes', levels: manifest.design.patients },
  { key: 'areaMultiplier', label: 'Área relativa', levels: manifest.design.areaMultipliers },
  { key: 'planningDays', label: 'Dias úteis', levels: manifest.design.planningDays },
  { key: 'overdueFraction', label: 'Vencidos no início', levels: manifest.design.overdueFractions },
  { key: 'missRate', label: 'Falha por tentativa', levels: manifest.design.missRates }
];
const comparators = ['nearest-baseline', 'urgency-baseline'];

function makePairs(rows, kind) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.scenarioId}|${kind === 'dynamic' ? row.missRate : 'static'}`;
    if (!groups.has(key)) groups.set(key, new Map());
    groups.get(key).set(row.strategyId, row);
  }
  return [...groups.values()].flatMap(group => {
    if (group.size !== manifest.design.strategies.length) throw new Error('Comparação pareada incompleta.');
    const main = group.get('main-heuristic');
    if (!main) throw new Error('Resultado da estratégia principal ausente.');
    return comparators.map(comparator => {
      const other = group.get(comparator);
      if (!other) throw new Error(`Resultado ${comparator} ausente em ${main.scenarioId}.`);
      const gains = Object.fromEntries(metrics[kind].map(metric => {
        const a = Number(main[metric.key]), b = Number(other[metric.key]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`Métrica inválida: ${metric.key}.`);
        return [metric.key, metric.higher ? a - b : b - a];
      }));
      return { comparator, scenarioId: main.scenarioId, seed: main.seed,
        patientCount: main.patientCount, areaMultiplier: main.areaMultiplier,
        planningDays: main.planningDays, overdueFraction: main.overdueFraction,
        missRate: kind === 'dynamic' ? main.missRate : null, gains };
    });
  });
}

const pairs = { dynamic: makePairs(dynamicRows, 'dynamic'), static: makePairs(staticRows, 'static') };
function stats(values) {
  if (!values.length) throw new Error('Grupo vazio no relatório fatorial.');
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = q => {
    const position = (sorted.length - 1) * q;
    const lower = Math.floor(position), upper = Math.ceil(position);
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  };
  const tolerance = 1e-8;
  return { n: values.length,
    meanGain: values.reduce((sum, value) => sum + value, 0) / values.length,
    medianGain: quantile(0.5), q1: quantile(0.25), q3: quantile(0.75),
    wins: values.filter(value => value > tolerance).length,
    ties: values.filter(value => Math.abs(value) <= tolerance).length,
    losses: values.filter(value => value < -tolerance).length };
}

const summary = [];
for (const kind of ['static', 'dynamic']) for (const comparator of comparators)
  for (const metric of metrics[kind]) {
    const selected = pairs[kind].filter(pair => pair.comparator === comparator);
    summary.push({ kind, comparator, metric: metric.key, factor: 'all', level: 'all',
      ...stats(selected.map(pair => pair.gains[metric.key])) });
    for (const factor of factors.filter(factor => kind === 'dynamic' || factor.key !== 'missRate')) {
      for (const level of factor.levels) {
        const values = selected.filter(pair => pair[factor.key] === level)
          .map(pair => pair.gains[metric.key]);
        summary.push({ kind, comparator, metric: metric.key, factor: factor.key, level,
          ...stats(values) });
      }
    }
  }

const csvFields = ['kind', 'comparator', 'metric', 'factor', 'level', 'n', 'meanGain', 'medianGain',
  'q1', 'q3', 'wins', 'ties', 'losses'];
const csv = [csvFields.join(','), ...summary.map(row => csvFields.map(field => row[field]).join(','))].join('\n') + '\n';
fs.writeFileSync(path.join(reportDir, 'resumo-fatores.csv'), csv);
fs.writeFileSync(path.join(reportDir, 'resumo-fatores.json'), JSON.stringify(summary, null, 2));

const fmt = (value, digits = 2) => Number(value).toFixed(digits).replace('.', ',');
const overall = (kind, comparator, metric) => summary.find(row => row.kind === kind &&
  row.comparator === comparator && row.metric === metric && row.factor === 'all');
const mdRows = comparators.flatMap(comparator => metrics.dynamic.map(metric => {
  const row = overall('dynamic', comparator, metric.key);
  return `| ${comparator} | ${metric.label} | ${fmt(row.meanGain)} ${metric.unit} | ` +
    `${fmt(row.medianGain)} ${metric.unit} | ${row.wins}/${row.ties}/${row.losses} |`;
}));
const missRows = manifest.design.missRates.flatMap(rate => comparators.map(comparator => {
  const find = metric => summary.find(row => row.kind === 'dynamic' && row.comparator === comparator &&
    row.metric === metric && row.factor === 'missRate' && row.level === rate);
  return `| ${fmt(rate * 100, 0)}% | ${comparator} | ` +
    `${fmt(find('realCoveragePercentage').meanGain)} p.p. | ` +
    `${fmt(find('realPriorityWeightedPromptCoveragePercentage').meanGain)} p.p. | ` +
    `${fmt(find('realPriorityWeightedActionableDelayDays').meanGain)} dias | ` +
    `${fmt(find('realTravelDistanceKm').meanGain)} km |`;
}));
const staticSummaryRows = comparators.flatMap(comparator => metrics.static.slice(0, 4).map(metric => {
  const row = overall('static', comparator, metric.key);
  return `| ${comparator} | ${metric.label} | ${fmt(row.meanGain)} ${metric.unit} | ` +
    `${row.wins}/${row.ties}/${row.losses} |`;
}));
const unfavorable = pairs.dynamic.filter(pair => pair.comparator === 'nearest-baseline')
  .sort((a, b) => a.gains.realPriorityWeightedPromptCoveragePercentage
    - b.gains.realPriorityWeightedPromptCoveragePercentage).slice(0, 5);
const unfavorableRows = unfavorable.map(pair => `| ${pair.seed} | ${pair.patientCount} | ` +
  `${fmt(pair.areaMultiplier)}× | ${pair.planningDays} | ${fmt(pair.overdueFraction * 100, 0)}% | ` +
  `${fmt(pair.missRate * 100, 0)}% | ` +
  `${fmt(pair.gains.realPriorityWeightedPromptCoveragePercentage)} p.p. |`);
const nearestPrompt = overall('dynamic', 'nearest-baseline', 'realPriorityWeightedPromptCoveragePercentage');
const nearestDistance = overall('dynamic', 'nearest-baseline', 'realTravelDistanceKm');
const nearestTime = overall('dynamic', 'nearest-baseline', 'totalPlanningTimeMs');
const averageDistance = strategyId => {
  const rows = dynamicRows.filter(row => row.strategyId === strategyId);
  if (rows.length !== nearestPrompt.n) throw new Error(`Quantidade inesperada de distâncias: ${strategyId}.`);
  return rows.reduce((sum, row) => sum + Number(row.realTravelDistanceKm), 0) / rows.length;
};
const mainAverageDistance = averageDistance('main-heuristic');
const nearestAverageDistance = averageDistance('nearest-baseline');
const walkingIncreasePercentage = 100 * (mainAverageDistance / nearestAverageDistance - 1);
const markdown = `# Resultados para apresentação — experimento fatorial\n\n` +
  `## Desenho\n\n` +
  `- **Base geográfica:** território GeoSaúde US Restinga, Porto Alegre; polígono original no nível 1× e versões escaladas de forma sintética em 0,5× e 2× a área. Área original aproximada: ${fmt(manifest.sourceAreaKm2)} km².\n` +
  `- **Fatores independentes:** pacientes ${manifest.design.patients.join('/')} (contagem); área ${manifest.design.areaMultipliers.join('/')}×; horizonte ${manifest.design.planningDays.join('/')} dias úteis; demanda já vencida ${manifest.design.overdueFractions.map(x => x * 100).join('/')}%; falha por tentativa ${manifest.design.missRates.map(x => x * 100).join('/')}%.\n` +
  `- **Contagem das instâncias:** 1 território base × ${manifest.design.seeds.length} sementes × ${manifest.design.patients.length} quantidades de pacientes × ${manifest.design.areaMultipliers.length} versões de área desse território × ${manifest.design.planningDays.length} horizontes × ${manifest.design.overdueFractions.length} proporções de demanda vencida = ${manifest.attemptedInstanceCount ?? manifest.instanceCount} cenários propostos. ${manifest.instanceCount} tinham caminhos a pé completos${manifest.excludedInstanceCount ? `; ${manifest.excludedInstanceCount} foram excluídos (lista em \`resultados/${folder}/exclusions.json\`)` : ''}.\n` +
  `- **Contagem das execuções:** ${manifest.instanceCount} cenários × ${manifest.design.strategies.length} estratégias = ${manifest.staticRecordCount} planos iniciais. ${manifest.staticRecordCount} planos × ${manifest.design.missRates.length} probabilidades de ausência = ${manifest.dynamicRecordCount} simulações dinâmicas. Uma simulação executa todos os dias úteis do horizonte e refaz o plano a cada dia.\n` +
  `- **Controles:** uma equipe com ${manifest.design.dailyWorkMinutes} min/dia, início ${manifest.design.startDate}, antecipação máxima ${manifest.design.maxAnticipationDays} dias, uma visita por paciente e durações de deslocamento obtidas do OSRM com foot.lua. Perfis clínicos e prioridades seguem a amostra sintética da fonte.\n` +
  `- **Sorteios comuns:** a mesma semente gera os mesmos pacientes e perfis antes da alteração de área, horizonte e atraso inicial; o sorteio de falha por paciente e data é igual entre estratégias e níveis de falha, com limiares de 0%, 5% e 10%.\n\n` +
  `**Prioridade atendida a tempo (%):** some os pesos das visitas feitas a tempo. Divida pela soma dos pesos de todas as visitas da demanda inicial. Multiplique por 100. Visitas já vencidas antes da simulação contam se forem concluídas no primeiro dia. Exemplo: visitas de pesos 1, 3 e 5 somam 9 pontos; se só a de peso 5 for feita a tempo, o resultado é 5 ÷ 9 = 55,56% dos pontos de prioridade, não dos pacientes.\n\n` +
  `## Comparação pareada\n\n` +
  `Cada par compara dois métodos no mesmo cenário e com a mesma probabilidade de ausência. Há ${manifest.instanceCount} cenários × ${manifest.design.missRates.length} probabilidades de ausência = ${nearestPrompt.n} pares por comparação dinâmica. Ganho positivo favorece a heurística principal: para cobertura, principal menos referência; para atraso, distância e tempo, referência menos principal. Por isso, ganho negativo de distância significa mais caminhada da heurística. Na tabela, “vitórias/empates/derrotas” conta os pares em que a heurística foi melhor, igual ou pior. Cada linha dinâmica soma ${nearestPrompt.n} pares. Cada linha do plano inicial soma ${manifest.instanceCount} cenários, pois o plano é calculado antes das ausências. ${manifest.excludedInstanceCount ? 'A exclusão de instâncias sem caminho a pé pode desequilibrar os níveis dos fatores; a contagem de pares consta em cada linha.' : 'Médias por fator usam o mesmo número de combinações dos demais fatores.'}\n\n` +
  `**Leitura sugerida:** nos ${nearestPrompt.n} pares frente ao vizinho mais próximo, a prioridade atendida a tempo da heurística foi, em média, ${fmt(nearestPrompt.meanGain)} pontos percentuais maior. Ela venceu em ${nearestPrompt.wins} pares, empatou em ${nearestPrompt.ties} e perdeu em ${nearestPrompt.losses}; essas contagens somam ${nearestPrompt.n}. A caminhada média foi ${fmt(mainAverageDistance)} km com a heurística e ${fmt(nearestAverageDistance)} km com o vizinho. O aumento relativo à média do vizinho foi **${fmt(walkingIncreasePercentage)}%**: (${fmt(mainAverageDistance)} ÷ ${fmt(nearestAverageDistance)} − 1) × 100. Em ${nearestDistance.losses} pares, a heurística caminhou mais. Também gastou ${fmt(-nearestTime.meanGain)} milissegundos a mais, em média, somando os cálculos diários de uma execução.\n\n` +
  `| Baseline | Métrica | Ganho médio | Ganho mediano | Vitórias/empates/derrotas |\n|---|---|---:|---:|---:|\n` +
  mdRows.join('\n') + '\n\n' +
  `Em cada linha da tabela acima, a média usa ${nearestPrompt.n} pares: ${manifest.instanceCount} cenários × ${manifest.design.missRates.length} probabilidades de ausência. A mediana é o valor central desses pares.\n\n` +
  `### Ganho médio por chance de falha\n\n` +
  `| Falha | Baseline | Cobertura | Prioridade atendida a tempo | Atraso controlável | Distância |\n|---:|---|---:|---:|---:|---:|\n` +
  missRows.join('\n') + '\n\n' +
  `Em cada linha de probabilidade de ausência, a média usa ${manifest.instanceCount} pares: um por cenário.\n\n` +
  `### Plano inicial, antes das falhas\n\n` +
  `| Baseline | Métrica | Ganho médio | Vitórias/empates/derrotas |\n|---|---|---:|---:|\n` +
  staticSummaryRows.join('\n') + '\n\n' +
  `Cada linha de plano inicial compara ${manifest.instanceCount} cenários. A probabilidade de ausência ainda não foi aplicada.\n\n` +
  `### Cinco condições mais desfavoráveis para prioridade atendida a tempo frente ao vizinho mais próximo\n\n` +
  `| Semente | Pacientes | Área | Dias úteis | Já vencidas | Falha | Ganho |\n|---:|---:|---:|---:|---:|---:|---:|\n` +
  unfavorableRows.join('\n') + '\n\n' +
  `O [relatório interativo](relatorio.html) mostra o efeito marginal de cada fator, a distribuição dos ganhos pareados e a contagem de vitórias/empates/derrotas. Os valores completos estão em [resumo-fatores.csv](resumo-fatores.csv); os registros por execução são regenerados em \`experimentos/resultados/${folder}/\`.\n\n` +
  `## Limites de interpretação\n\n` +
  `- A área 1× preserva o contorno real; 0,5× e 2× são transformações geométricas para teste controlado e não representam territórios oficiais. Os pacientes, prioridades, prazos e ausências são sintéticos.\n` +
  `- Distâncias e durações vêm da API Table do OSRM local com perfil de caminhada e malha OpenStreetMap; pacientes sintéticos são conectados à rede pelo OSRM.\n` +
  `- A falha é um sorteio por tentativa de visita. Quando uma visita falha, ela permanece pendente e pode ser replanejada; os resultados efetivos incluem todas as visitas ainda não atendidas no fim do horizonte.\n` +
  `- Médias e quartis são descritivos das ${manifest.design.seeds.length} sementes e níveis escolhidos, não estimativas populacionais nem intervalos de confiança. Tempo computacional depende da máquina; compare-o somente dentro da mesma execução.\n` +
  `- A generalização geográfica exige repetir a grade em outros territórios, e a validação operacional exige endereços, prevalência e equipe observados.\n\n` +
  `## Reprodução\n\n\`\`\`bash\n` +
  `npm run build --prefix artefato/packages/core\n` +
  `npm run build --prefix artefato/packages/server\n` +
  `npm run build --prefix experimentos\n` +
  `OSRM_BASE_URL=http://127.0.0.1:5000 npm run factorial --prefix experimentos\n` +
  `node experimentos/analise/generate_factorial_report.js\n` +
  `\`\`\`\n`;
fs.writeFileSync(path.join(reportDir, 'resumo.md'), markdown);

const safeJson = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Experimento fatorial APS</title>
<style>body{font:15px system-ui,sans-serif;max-width:1200px;margin:auto;padding:32px;color:#17253b;background:#f5f7fb}h1{font-size:32px;margin:0 0 8px}h2{margin-top:34px}.lead{color:#4c5c70;max-width:780px}.panel{background:white;border:1px solid #d9e2eb;border-radius:14px;padding:22px;margin:20px 0;box-shadow:0 3px 14px #16304c0b}.controls{display:flex;gap:16px;flex-wrap:wrap}label{display:grid;gap:6px;font-weight:600}select,button{font:inherit;padding:8px;border:1px solid #a9b9ca;border-radius:8px;background:white}button{cursor:pointer;margin-top:8px;color:#0a5f99}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.chart{height:290px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.kpi{background:#ebf3fb;padding:14px;border-radius:10px}.kpi strong{display:block;font-size:24px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{border-bottom:1px solid #e5ebf2;padding:9px;text-align:right}th:first-child,td:first-child{text-align:left}small{color:#5d6c7d}a{color:#0a5f99}</style>
<script src="../vendor/chart.umd.min.js"></script></head><body><h1>Experimento fatorial de roteamento APS</h1><p class="lead">${manifest.instanceCount} cenários = 1 território base (US Restinga) × ${manifest.design.seeds.length} sementes × ${manifest.design.patients.length} quantidades de pacientes × ${manifest.design.areaMultipliers.length} versões de área × ${manifest.design.planningDays.length} horizontes × ${manifest.design.overdueFractions.length} proporções de demanda vencida. ${manifest.dynamicRecordCount} simulações = ${manifest.instanceCount} cenários × ${manifest.design.strategies.length} estratégias × ${manifest.design.missRates.length} probabilidades de ausência. Ganho positivo favorece a heurística principal.</p>
<div class="panel controls"><label>Tipo de resultado<select id="kind"><option value="dynamic">Visitas efetivas após replanejamento</option><option value="static">Plano inicial previsto</option></select></label><label>Métrica<select id="metric"></select></label><label>Comparador<select id="comparator"><option value="nearest-baseline">Vizinho mais próximo</option><option value="urgency-baseline">Urgência</option></select></label></div>
<div class="panel kpis" id="kpis"></div><h2>Efeito marginal dos fatores</h2><p class="lead">Cada barra mostra o ganho médio pareado naquele nível, agregando todos os demais fatores. Mediana e quartis aparecem ao passar o cursor. Use “Baixar PNG” para levar o gráfico aos slides.</p><div class="grid" id="charts"></div><h2>Distribuição dos ganhos pareados</h2><div class="panel"><div class="chart"><canvas id="histogram"></canvas></div><button onclick="downloadChart('histogram')">Baixar PNG</button></div><h2>Resultados por nível</h2><div class="panel"><table id="table"></table></div><p><a href="resumo.md">Resumo e protocolo</a> · <a href="resumo-fatores.csv">Tabela CSV</a></p><small>Dados sintéticos; custos OSRM a pé / OpenStreetMap. Área escalada não é território oficial. Sem inferência populacional.</small>
<script>const DATA=${safeJson(summary)},METRICS=${safeJson(metrics)},FACTORS=${safeJson(factors)},PAIRS=${safeJson(pairs)};const charts=[];const kind=document.getElementById('kind'),metric=document.getElementById('metric'),comparator=document.getElementById('comparator');function fmt(x){return Number(x).toLocaleString('pt-BR',{maximumFractionDigits:2})}function label(f,l){return ['missRate','overdueFraction'].includes(f)?fmt(l*100)+'%':f==='areaMultiplier'?fmt(l)+'×':String(l)}function downloadChart(id){const link=document.createElement('a');link.download='aps-fatorial-'+kind.value+'-'+metric.value+'-'+comparator.value+'-'+id+'.png';link.href=document.getElementById(id).toDataURL('image/png');link.click()}function updateMetrics(){metric.innerHTML=METRICS[kind.value].map(m=>'<option value="'+m.key+'">'+m.label+'</option>').join('');update()}function update(){charts.forEach(c=>c.destroy());charts.length=0;const k=kind.value,m=METRICS[k].find(x=>x.key===metric.value),comp=comparator.value;const rows=DATA.filter(x=>x.kind===k&&x.comparator===comp&&x.metric===m.key);const all=rows.find(x=>x.factor==='all');document.getElementById('kpis').innerHTML=[['Pares',all.n],['Ganho médio',fmt(all.meanGain)+' '+m.unit],['Mediana',fmt(all.medianGain)+' '+m.unit],['Vitórias / empates / derrotas',all.wins+' / '+all.ties+' / '+all.losses]].map(x=>'<div class="kpi"><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('');const visible=FACTORS.filter(f=>k==='dynamic'||f.key!=='missRate');document.getElementById('charts').innerHTML=visible.map(f=>'<div class="panel"><strong>'+f.label+'</strong><div class="chart"><canvas id="chart_'+f.key+'"></canvas></div><button data-chart="chart_'+f.key+'">Baixar PNG</button></div>').join('');for(const f of visible){const rs=f.levels.map(l=>rows.find(r=>r.factor===f.key&&r.level===l));charts.push(new Chart(document.getElementById('chart_'+f.key),{type:'bar',data:{labels:f.levels.map(l=>label(f.key,l)),datasets:[{label:'Ganho médio ('+m.unit+')',data:rs.map(r=>r.meanGain),backgroundColor:rs.map(r=>r.meanGain>=0?'#087b83':'#d55b58')}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{afterLabel:c=>'Mediana '+fmt(rs[c.dataIndex].medianGain)+' · Q1 '+fmt(rs[c.dataIndex].q1)+' · Q3 '+fmt(rs[c.dataIndex].q3)}}},scales:{y:{title:{display:true,text:'Ganho ('+m.unit+')'}}}}}));}const gains=PAIRS[k].filter(p=>p.comparator===comp).map(p=>p.gains[m.key]);const min=Math.min(...gains),max=Math.max(...gains),step=(max-min||1)/15;const bins=Array(15).fill(0);for(const g of gains)bins[Math.min(14,Math.floor((g-min)/step))]++;charts.push(new Chart(document.getElementById('histogram'),{type:'bar',data:{labels:bins.map((_,i)=>fmt(min+i*step)),datasets:[{label:'Pares',data:bins,backgroundColor:bins.map((_,i)=>min+(i+.5)*step>=0?'#087b83':'#d55b58')}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{title:{display:true,text:'Ganho ('+m.unit+')'}},y:{title:{display:true,text:'Número de pares'},beginAtZero:true}}}}));document.getElementById('table').innerHTML='<thead><tr><th>Fator e nível</th><th>Pares</th><th>Média</th><th>Mediana</th><th>Q1–Q3</th><th>V/E/D</th></tr></thead><tbody>'+visible.flatMap(f=>f.levels.map(l=>{const r=rows.find(x=>x.factor===f.key&&x.level===l);return '<tr><td>'+f.label+': '+label(f.key,l)+'</td><td>'+r.n+'</td><td>'+fmt(r.meanGain)+'</td><td>'+fmt(r.medianGain)+'</td><td>'+fmt(r.q1)+' a '+fmt(r.q3)+'</td><td>'+r.wins+'/'+r.ties+'/'+r.losses+'</td></tr>'})).join('')+'</tbody>'}document.getElementById('charts').onclick=e=>{const id=e.target.dataset.chart;if(id)downloadChart(id)};kind.onchange=updateMetrics;metric.onchange=update;comparator.onchange=update;updateMetrics();</script></body></html>`;
fs.writeFileSync(path.join(reportDir, 'relatorio.html'), html);
console.log(`Relatório fatorial: ${reportDir}`);
