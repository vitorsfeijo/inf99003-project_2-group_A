import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.resolve(__dirname, '..', 'resultados');
const analiseDir = path.resolve(__dirname, '..', 'analise');

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
function loadJson(filename) {
  const p = path.join(resultsDir, filename);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

const staticData = loadJson('benchmark_results.json');
const dynData    = loadJson('dynamic_simulation_results.json');

if (staticData.length === 0 && dynData.length === 0) {
  console.error('Nenhum resultado encontrado. Execute os simuladores primeiro.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers for inline statistics
// ---------------------------------------------------------------------------
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function fmt(n, decimals = 1) { return Number(n).toFixed(decimals); }

const strategies = ['main-heuristic', 'urgency-baseline', 'nearest-baseline'];
const stratLabels = {
  'main-heuristic':   'Heurística Principal',
  'urgency-baseline': 'Baseline Urgência',
  'nearest-baseline': 'Baseline Vizinho'
};

// Summary stats per strategy (static)
const summaryRows = strategies.map(s => {
  const rows = staticData.filter(d => d.strategyId === s && d.patientCount > 0);
  if (!rows.length) return null;
  return {
    label: stratLabels[s],
    avgOverdue: fmt(avg(rows.map(r => r.totalOverdueDays))),
    avgDist:    fmt(avg(rows.map(r => r.totalTravelDistanceKm))),
    avgCov:     fmt(avg(rows.map(r => r.coveragePercentage))),
    avgTime:    fmt(avg(rows.map(r => r.executionTimeMs)), 2),
  };
}).filter(Boolean);

// ---------------------------------------------------------------------------
// Inline data blobs for JS charts
// ---------------------------------------------------------------------------
const staticJson  = JSON.stringify(staticData);
const dynJson     = JSON.stringify(dynData);

// Static chart: scenarios with >0 patients, order by patientCount
const chartScenarios = [...new Set(
  staticData.filter(d => d.patientCount > 0).sort((a,b) => a.patientCount - b.patientCount).map(d => d.scenarioId)
)];

const COLORS = {
  'main-heuristic':   { solid: '#2563eb', light: '#93c5fd' },
  'urgency-baseline': { solid: '#d97706', light: '#fcd34d' },
  'nearest-baseline': { solid: '#16a34a', light: '#86efac' },
};

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------
const html = /* html */`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Experimentos — INF99003</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --blue:   #2563eb;
      --amber:  #d97706;
      --green:  #16a34a;
      --slate:  #1e293b;
      --muted:  #64748b;
      --bg:     #f8fafc;
      --card:   #ffffff;
      --border: #e2e8f0;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      background: var(--bg); color: var(--slate);
      padding: 2rem 1.5rem; max-width: 1400px; margin: 0 auto;
    }

    /* ── Header ── */
    .report-header { margin-bottom: 2.5rem; }
    .report-header h1 { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem; }
    .report-header .subtitle { color: var(--muted); font-size: 0.95rem; }
    .report-header .meta { margin-top: 0.5rem; font-size: 0.8rem; color: #94a3b8; }

    /* ── KPI Cards ── */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2.5rem; }
    .kpi { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.25rem 1.5rem; }
    .kpi .label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
    .kpi .value { font-size: 2rem; font-weight: 700; margin: 0.25rem 0; color: #0f172a; }
    .kpi .detail { font-size: 0.78rem; color: var(--muted); }

    /* ── Section ── */
    .section { margin-bottom: 3rem; }
    .section-header { display: flex; align-items: baseline; gap: 0.75rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border); }
    .section-header h2 { font-size: 1.2rem; font-weight: 700; color: #0f172a; }
    .section-note { font-size: 0.82rem; color: var(--muted); margin-bottom: 1.25rem; background: #f1f5f9; padding: 0.65rem 1rem; border-left: 3px solid var(--blue); border-radius: 0 0.5rem 0.5rem 0; }

    /* ── Chart grid ── */
    .chart-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1.25rem; margin-bottom: 1.5rem; }
    .chart-card { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.25rem 1.5rem; }
    .chart-card h3 { font-size: 0.9rem; font-weight: 600; color: #334155; margin-bottom: 1rem; }
    .chart-card canvas { max-height: 280px; }

    /* ── Summary table ── */
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .summary-card { background: var(--card); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem 1.25rem; }
    .summary-card .strat-name { font-size: 0.8rem; font-weight: 700; margin-bottom: 0.5rem; }
    .summary-card .strat-name.heuristic { color: var(--blue); }
    .summary-card .strat-name.urgency   { color: var(--amber); }
    .summary-card .strat-name.nearest   { color: var(--green); }
    .summary-card table { width: 100%; font-size: 0.8rem; }
    .summary-card td:first-child { color: var(--muted); }
    .summary-card td:last-child { font-weight: 600; text-align: right; }

    /* ── Data table ── */
    .data-table-wrap { overflow-x: auto; }
    table.data { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 0.75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.07); font-size: 0.8rem; }
    table.data th { background: #f1f5f9; font-weight: 600; color: #334155; padding: 0.6rem 0.85rem; text-align: left; white-space: nowrap; }
    table.data td { padding: 0.55rem 0.85rem; border-bottom: 1px solid var(--border); }
    table.data tr:last-child td { border-bottom: none; }
    table.data tr:hover td { background: #f8fafc; }

    /* ── Badges ── */
    .badge { display: inline-block; padding: 0.18rem 0.55rem; border-radius: 0.3rem; font-size: 0.7rem; font-weight: 700; }
    .badge-h { background: #dbeafe; color: #1e40af; }
    .badge-u { background: #fef3c7; color: #92400e; }
    .badge-n { background: #dcfce7; color: #166534; }
    .badge-miss { background: #fee2e2; color: #991b1b; }
    .badge-good { background: #dcfce7; color: #166534; }

    /* ── Legend ── */
    .legend { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1rem; font-size: 0.8rem; }
    .legend-item { display: flex; align-items: center; gap: 0.4rem; }
    .legend-dot { width: 12px; height: 12px; border-radius: 50%; }

    /* ── Tabs ── */
    .tab-bar { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid var(--border); padding-bottom: 0; }
    .tab-btn { background: none; border: none; padding: 0.5rem 1rem 0.6rem; font-size: 0.875rem; font-weight: 600; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color .15s, border-color .15s; }
    .tab-btn.active { color: var(--blue); border-bottom-color: var(--blue); }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); text-align: center; font-size: 0.75rem; color: #94a3b8; }
  </style>
</head>
<body>

<!-- ══════════════════════════════ HEADER ══════════════════════════════ -->
<div class="report-header">
  <h1>📊 Relatório de Experimentos — INF99003</h1>
  <p class="subtitle">Planejamento e Replanejamento de Visitas Domiciliares na Atenção Primária à Saúde</p>
  <p class="meta">Grupo A · Ciclo 2 · Tobias Marion, Vitor Feijo, Fabio Cieslak · Gerado automaticamente</p>
</div>

<!-- ══════════════════════════════ KPI STRIP ══════════════════════════ -->
<div class="kpi-grid" id="kpiGrid"></div>

<!-- ══════════════════════════════ TABS ══════════════════════════════ -->
<div class="tab-bar">
  <button class="tab-btn active" onclick="switchTab(event,'tab-static')">🗂️ Simulação Estática</button>
  <button class="tab-btn"        onclick="switchTab(event,'tab-dynamic')">🔄 Simulação Dinâmica</button>
</div>

<!-- ══════════════════════════════ TAB 1: STATIC ══════════════════════ -->
<div class="tab-panel active" id="tab-static">

  <div class="section-note">
    Cada cenário é planejado uma única vez (sem falhas de campo). Compara as 3 estratégias em termos de atraso clínico,
    distância percorrida, cobertura de demanda e tempo computacional.
  </div>

  <!-- Summary cards per strategy -->
  <div class="summary-grid" id="staticSummaryCards"></div>

  <!-- Charts -->
  <div class="chart-grid">
    <div class="chart-card">
      <h3>Atraso Acumulado Total por Cenário (dias)</h3>
      <canvas id="c_overdue"></canvas>
    </div>
    <div class="chart-card">
      <h3>Distância Total Percorrida por Cenário (km)</h3>
      <canvas id="c_dist"></canvas>
    </div>
    <div class="chart-card">
      <h3>Utilização Média das Equipes (%)</h3>
      <canvas id="c_util"></canvas>
    </div>
    <div class="chart-card">
      <h3>Tempo de Execução Computacional (ms)</h3>
      <canvas id="c_time"></canvas>
    </div>
    <div class="chart-card">
      <h3>Desequilíbrio de Carga entre Equipes</h3>
      <canvas id="c_imbal"></canvas>
    </div>
    <div class="chart-card">
      <h3>Distância vs. Atraso (bolha = nº pacientes)</h3>
      <canvas id="c_scatter"></canvas>
    </div>
  </div>

  <!-- Data table -->
  <h3 style="font-size:.9rem;font-weight:600;color:#334155;margin-bottom:.75rem;">Tabela Completa de Resultados</h3>
  <div class="data-table-wrap">
    <table class="data" id="staticTable"></table>
  </div>
</div>

<!-- ══════════════════════════════ TAB 2: DYNAMIC ═════════════════════ -->
<div class="tab-panel" id="tab-dynamic">

  <div class="section-note">
    Simulação de 5 dias úteis com replanejamento diário. A cada dia são simuladas falhas de campo (missRate),
    os resultados reais são registrados via <code>applyVisitResults</code> e o cenário é replanejado automaticamente.
  </div>

  <div class="chart-grid">
    <div class="chart-card">
      <h3>Cobertura Real (%) × Taxa de Falha — média sobre cenários</h3>
      <canvas id="d_coverage"></canvas>
    </div>
    <div class="chart-card">
      <h3>Atraso Acumulado Real (dias) × Taxa de Falha — média</h3>
      <canvas id="d_overdue"></canvas>
    </div>
    <div class="chart-card">
      <h3>Distância Real Percorrida (km) × Taxa de Falha — média</h3>
      <canvas id="d_dist"></canvas>
    </div>
    <div class="chart-card">
      <h3>Tempo Médio de Replanejamento (ms) × Taxa de Falha — média</h3>
      <canvas id="d_replan"></canvas>
    </div>
    <div class="chart-card">
      <h3>Visitas Perdidas (missed) por Cenário a 20% falha</h3>
      <canvas id="d_missed"></canvas>
    </div>
    <div class="chart-card">
      <h3>Cobertura Real (%) por Cenário × Estratégia (missRate=0.2)</h3>
      <canvas id="d_covscen"></canvas>
    </div>
  </div>

  <h3 style="font-size:.9rem;font-weight:600;color:#334155;margin-bottom:.75rem;">Tabela Completa — Simulação Dinâmica</h3>
  <div class="data-table-wrap">
    <table class="data" id="dynTable"></table>
  </div>
</div>

<footer>
  INF99003 · Grupo A · Relatório gerado automaticamente por <code>generate_html_charts.js</code>
</footer>

<!-- ══════════════════════════════ SCRIPTS ════════════════════════════ -->
<script>
// ─── Data ───────────────────────────────────────────────────────────────────
const staticData = ${staticJson};
const dynData    = ${dynJson};

const STRATEGIES  = ['main-heuristic','urgency-baseline','nearest-baseline'];
const STRAT_LABEL = {'main-heuristic':'Heurística Principal','urgency-baseline':'Baseline Urgência','nearest-baseline':'Baseline Vizinho'};
const COLORS = {
  'main-heuristic':   { solid:'#2563eb', light:'rgba(37,99,235,0.15)' },
  'urgency-baseline': { solid:'#d97706', light:'rgba(217,119,6,0.15)' },
  'nearest-baseline': { solid:'#16a34a', light:'rgba(22,163,74,0.15)' },
};
const BADGE_CLASS = {'main-heuristic':'badge-h','urgency-baseline':'badge-u','nearest-baseline':'badge-n'};

// ─── Tabs ───────────────────────────────────────────────────────────────────
function switchTab(e, id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  e.target.classList.add('active');
  document.getElementById(id).classList.add('active');
}

// ─── KPI ────────────────────────────────────────────────────────────────────
(function buildKPIs() {
  const nonEdge = staticData.filter(d => d.patientCount > 1);
  const avgCov  = nonEdge.reduce((s,d) => s + d.coveragePercentage, 0) / nonEdge.length;
  const scenCount = [...new Set(staticData.map(d => d.scenarioId))].length;
  const dynNonZero = dynData.filter(d => d.missRate === 0.2 && d.patientCount > 0);
  const dynCov20 = dynNonZero.reduce((s,d) => s + d.realCoveragePercentage, 0) / dynNonZero.length;
  const dynRuns = dynData.length;

  const kpis = [
    { label:'Cenários Testados',       value: scenCount,           detail:'incluindo edge-cases' },
    { label:'Cobertura Média (estático)', value: avgCov.toFixed(1)+'%', detail:'média sobre cenários >1 paciente' },
    { label:'Cobertura com 20% Falhas', value: dynCov20.toFixed(1)+'%', detail:'simulação dinâmica — missRate=0.2' },
    { label:'Rodadas Dinâmicas',        value: dynRuns,             detail:'3 estratégias × 4 taxas × 11 cenários' },
    { label:'Estratégias Comparadas',   value: 3,                   detail:'main-heuristic · urgency · nearest' },
  ];

  const grid = document.getElementById('kpiGrid');
  grid.innerHTML = kpis.map(k => \`
    <div class="kpi">
      <div class="label">\${k.label}</div>
      <div class="value">\${k.value}</div>
      <div class="detail">\${k.detail}</div>
    </div>
  \`).join('');
})();

// ─── Summary cards ──────────────────────────────────────────────────────────
(function buildSummary() {
  const cls = { 'main-heuristic':'heuristic','urgency-baseline':'urgency','nearest-baseline':'nearest' };
  const rows = STRATEGIES.map(s => {
    const d = staticData.filter(r => r.strategyId === s && r.patientCount > 0);
    const avg = k => d.reduce((sum,r) => sum + r[k],0) / d.length;
    return { s, avgOv: avg('totalOverdueDays'), avgDist: avg('totalTravelDistanceKm'),
             avgCov: avg('coveragePercentage'), avgTime: avg('executionTimeMs') };
  });
  document.getElementById('staticSummaryCards').innerHTML = rows.map(r => \`
    <div class="summary-card">
      <div class="strat-name \${cls[r.s]}">\${STRAT_LABEL[r.s]}</div>
      <table>
        <tr><td>Cobertura média</td><td>\${r.avgCov.toFixed(1)}%</td></tr>
        <tr><td>Atraso médio</td><td>\${r.avgOv.toFixed(1)} d</td></tr>
        <tr><td>Distância média</td><td>\${r.avgDist.toFixed(1)} km</td></tr>
        <tr><td>Tempo médio</td><td>\${r.avgTime.toFixed(2)} ms</td></tr>
      </table>
    </div>
  \`).join('');
})();

// ─── Static charts ──────────────────────────────────────────────────────────
const chartScens = [...new Set(
  staticData.filter(d => d.patientCount > 0).sort((a,b) => a.patientCount - b.patientCount).map(d => d.scenarioId)
)];

function staticDatasets(metric) {
  return STRATEGIES.map(s => ({
    label: STRAT_LABEL[s],
    data: chartScens.map(sc => { const r = staticData.find(d => d.scenarioId === sc && d.strategyId === s); return r ? r[metric] : 0; }),
    backgroundColor: COLORS[s].solid,
  }));
}

function barChart(id, datasets, labels, yLabel, opts={}) {
  return new Chart(document.getElementById(id), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position:'bottom', labels:{ font:{size:11} } } },
      scales: {
        x: { ticks:{ font:{size:10}, maxRotation:35 } },
        y: { title:{ display:!!yLabel, text:yLabel, font:{size:11} }, beginAtZero:true },
        ...opts.scales
      },
      ...opts
    }
  });
}

barChart('c_overdue', staticDatasets('totalOverdueDays'),        chartScens, 'dias');
barChart('c_dist',    staticDatasets('totalTravelDistanceKm'),   chartScens, 'km');
barChart('c_util',    staticDatasets('teamUtilizationPercentage'),chartScens, '%');
barChart('c_time',    staticDatasets('executionTimeMs'),          chartScens, 'ms');
barChart('c_imbal',   staticDatasets('teamWorkloadImbalance'),    chartScens, 'desvio');

// Scatter: dist vs overdue (bubble size = patientCount)
new Chart(document.getElementById('c_scatter'), {
  type: 'bubble',
  data: {
    datasets: STRATEGIES.map(s => ({
      label: STRAT_LABEL[s],
      data: staticData.filter(d => d.strategyId === s && d.patientCount > 0).map(d => ({
        x: d.totalTravelDistanceKm,
        y: d.totalOverdueDays,
        r: Math.max(4, Math.sqrt(d.patientCount) * 2.5)
      })),
      backgroundColor: COLORS[s].light,
      borderColor:     COLORS[s].solid,
      borderWidth: 1.5
    }))
  },
  options: {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend:{ position:'bottom', labels:{font:{size:11}} }, tooltip:{ callbacks:{
      label: ctx => \`Dist: \${ctx.raw.x} km | Atraso: \${ctx.raw.y}d\`
    }}},
    scales: {
      x: { title:{ display:true, text:'Distância total (km)', font:{size:11} } },
      y: { title:{ display:true, text:'Atraso acumulado (dias)', font:{size:11} }, beginAtZero:true }
    }
  }
});

// ─── Static table ───────────────────────────────────────────────────────────
(function buildStaticTable() {
  const t = document.getElementById('staticTable');
  t.innerHTML = \`
    <thead><tr>
      <th>Cenário</th><th>Pacientes</th><th>Equipes</th><th>Estratégia</th>
      <th>Cobertura</th><th>Atraso (d)</th><th>Dist. (km)</th>
      <th>Utiliz. (%)</th><th>Desequil.</th><th>Exec. (ms)</th>
    </tr></thead>
    <tbody>
      \${staticData.map(d => \`
        <tr>
          <td><strong>\${d.scenarioId.replace('cenario_','')}</strong></td>
          <td>\${d.patientCount}</td>
          <td>\${d.teamCount}</td>
          <td><span class="badge \${BADGE_CLASS[d.strategyId]}">\${STRAT_LABEL[d.strategyId]}</span></td>
          <td><span class="badge \${d.coveragePercentage >= 100 ? 'badge-good':'badge-miss'}">\${d.coveragePercentage}%</span></td>
          <td>\${d.totalOverdueDays}d</td>
          <td>\${d.totalTravelDistanceKm} km</td>
          <td>\${d.teamUtilizationPercentage}%</td>
          <td>\${d.teamWorkloadImbalance}</td>
          <td>\${d.executionTimeMs} ms</td>
        </tr>
      \`).join('')}
    </tbody>
  \`;
})();

// ─── Dynamic charts ─────────────────────────────────────────────────────────
const missRates = [...new Set(dynData.map(d => d.missRate))].sort((a,b)=>a-b);
const missLabels = missRates.map(r => (r*100).toFixed(0)+'%');

function dynLineDatasets(metric) {
  return STRATEGIES.map(s => {
    const data = missRates.map(mr => {
      const rows = dynData.filter(d => d.strategyId === s && d.missRate === mr && d.patientCount > 0);
      return rows.length ? +(rows.reduce((sum,d) => sum + d[metric], 0) / rows.length).toFixed(2) : 0;
    });
    return {
      label: STRAT_LABEL[s],
      data,
      borderColor:     COLORS[s].solid,
      backgroundColor: COLORS[s].light,
      tension: 0.3, fill: false, pointRadius: 6, pointHoverRadius: 8, borderWidth: 2
    };
  });
}

function lineChart(id, datasets, labels, yLabel, opts={}) {
  return new Chart(document.getElementById(id), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend:{ position:'bottom', labels:{font:{size:11}} }, tooltip:{ mode:'index', intersect:false } },
      scales: {
        x: { title:{ display:true, text:'Taxa de falha de campo', font:{size:11} } },
        y: { title:{ display:!!yLabel, text:yLabel, font:{size:11} }, beginAtZero:true, ...opts.yScale }
      }
    }
  });
}

lineChart('d_coverage', dynLineDatasets('realCoveragePercentage'), missLabels, 'Cobertura real (%)', { yScale:{ max:105 } });
lineChart('d_overdue',  dynLineDatasets('realAccumulatedOverdueDays'), missLabels, 'Atraso acumulado real (dias)');
lineChart('d_dist',     dynLineDatasets('realTravelDistanceKm'),   missLabels, 'Distância efetiva (km)');
lineChart('d_replan',   dynLineDatasets('avgReplanningTimeMs'),    missLabels, 'Avg replanning (ms)');

// Missed visits at missRate=0.2 per scenario (bar, grouped by strategy)
const dynScens = [...new Set(dynData.filter(d=>d.patientCount>0).sort((a,b)=>a.patientCount-b.patientCount).map(d=>d.scenarioId))];
const MISS_RATE = 0.2;
new Chart(document.getElementById('d_missed'), {
  type: 'bar',
  data: {
    labels: dynScens.map(s=>s.replace('cenario_','')),
    datasets: STRATEGIES.map(s => ({
      label: STRAT_LABEL[s],
      data: dynScens.map(sc => { const r = dynData.find(d=>d.scenarioId===sc&&d.strategyId===s&&d.missRate===MISS_RATE); return r?r.missedVisits:0; }),
      backgroundColor: COLORS[s].solid
    }))
  },
  options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{position:'bottom', labels:{font:{size:11}}} }, scales:{ y:{ title:{display:true,text:'Visitas perdidas'},beginAtZero:true } } }
});

// Coverage at missRate=0.2 per scenario
new Chart(document.getElementById('d_covscen'), {
  type: 'bar',
  data: {
    labels: dynScens.map(s=>s.replace('cenario_','')),
    datasets: STRATEGIES.map(s => ({
      label: STRAT_LABEL[s],
      data: dynScens.map(sc => { const r = dynData.find(d=>d.scenarioId===sc&&d.strategyId===s&&d.missRate===MISS_RATE); return r?r.realCoveragePercentage:0; }),
      backgroundColor: COLORS[s].solid
    }))
  },
  options: { responsive:true, maintainAspectRatio:true, plugins:{ legend:{position:'bottom', labels:{font:{size:11}}} }, scales:{ y:{ title:{display:true,text:'Cobertura real (%)'},beginAtZero:true, max:105 } } }
});

// ─── Dynamic table ──────────────────────────────────────────────────────────
(function buildDynTable() {
  const t = document.getElementById('dynTable');
  const sorted = [...dynData].sort((a,b)=>a.missRate-b.missRate||a.scenarioId.localeCompare(b.scenarioId));
  t.innerHTML = \`
    <thead><tr>
      <th>Cenário</th><th>Pac.</th><th>Estratégia</th><th>Taxa Falha</th>
      <th>Concluídas</th><th>Perdidas</th><th>Cobertura Real</th>
      <th>Atraso Real (d)</th><th>Dist. Real (km)</th>
      <th>Avg Replanning (ms)</th>
    </tr></thead>
    <tbody>
      \${sorted.map(d => \`
        <tr>
          <td><strong>\${d.scenarioId.replace('cenario_','')}</strong></td>
          <td>\${d.patientCount}</td>
          <td><span class="badge \${BADGE_CLASS[d.strategyId]}">\${STRAT_LABEL[d.strategyId]}</span></td>
          <td><span class="badge badge-miss">\${(d.missRate*100).toFixed(0)}%</span></td>
          <td>\${d.completedVisits}</td>
          <td>\${d.missedVisits}</td>
          <td><span class="badge \${d.realCoveragePercentage >= 90 ? 'badge-good':'badge-miss'}">\${d.realCoveragePercentage}%</span></td>
          <td>\${d.realAccumulatedOverdueDays}d</td>
          <td>\${d.realTravelDistanceKm} km</td>
          <td>\${d.avgReplanningTimeMs} ms</td>
        </tr>
      \`).join('')}
    </tbody>
  \`;
})();
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
fs.mkdirSync(analiseDir, { recursive: true });
const outputPath = path.join(analiseDir, 'relatorio_experimentos.html');
fs.writeFileSync(outputPath, html, 'utf-8');
console.log(`✅ Relatório gerado: ${outputPath}`);
console.log(`   → ${staticData.length} registros estáticos | ${dynData.length} registros dinâmicos`);
