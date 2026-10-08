import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planScenario, verifyPlan } from '../../artefato/packages/core/dist/index.js';
import { buildWalkingCostMatrix } from '../../artefato/packages/server/dist/routes/road-matrix.js';
import { makeScenario } from '../dist/longo/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultDir = path.join(root, 'resultados', 'longo-250-caminhada');
fs.mkdirSync(path.join(resultDir, 'matrices'), { recursive: true });
const base = JSON.parse(fs.readFileSync(path.join(root, 'cenarios', 'geosaude_us_restinga_20261106_30.json'), 'utf8'));
const seeds = [20261008, 20261009, 20261010];
const strategies = ['main-heuristic', 'nearest-baseline', 'urgency-baseline'];
const start = new Date('2026-10-01T12:00:00Z');
const weekdayCount = end => {
  let count = 0;
  for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) count++;
  }
  return count;
};
const previous = fs.existsSync(path.join(resultDir, 'capacity.json'))
  ? JSON.parse(fs.readFileSync(path.join(resultDir, 'capacity.json'), 'utf8')).rows
  : [];
const rows = [];
let sufficientMonths = null;
for (const months of [4, 12]) {
  const endExclusive = new Date(Date.UTC(2026, 9 + months, 1, 12));
  const workingDays = weekdayCount(endExclusive);
  const endDate = new Date(endExclusive.getTime() - 86400000).toISOString().slice(0, 10);
  for (const seed of seeds) {
    const { scenario } = makeScenario(base, seed);
    scenario.planningHorizonDays = workingDays;
    const matrixFile = path.join(resultDir, 'matrices', `longo_restinga_s${seed}_p250.json`);
    const costMatrix = fs.existsSync(matrixFile)
      ? JSON.parse(fs.readFileSync(matrixFile, 'utf8'))
      : await buildWalkingCostMatrix(scenario);
    if (!fs.existsSync(matrixFile)) fs.writeFileSync(matrixFile, JSON.stringify(costMatrix));
    for (const strategyId of strategies) {
      const cached = previous.find(row => row.months === months && row.seed === seed && row.strategyId === strategyId);
    if (cached && cached.workingDays === workingDays && cached.dailyWorkMinutes === 300) {
        rows.push(cached);
        console.log(`${months} meses | ${seed} | ${strategyId} | ${cached.allocated}/250 (cache)`);
        continue;
      }
      const plan = planScenario(scenario, { strategyId, enable1_5Opt: true, costMatrix });
      const verification = verifyPlan(scenario, plan);
      if (!verification.isValid) throw new Error(`${months} meses/${seed}/${strategyId}: ${verification.errors.join('; ')}`);
      const allocated = plan.routes.reduce((sum, route) => sum + route.visits.length, 0);
      const row = { months, endDate, workingDays, dailyWorkMinutes: 300, seed, strategyId, allocated, total: 250,
        coveragePercentage: 100 * allocated / 250 };
      rows.push(row);
      console.log(`${months} meses | ${seed} | ${strategyId} | ${allocated}/250`);
    }
  }
  const current = rows.filter(row => row.months === months);
  if (current.every(row => row.allocated === 250)) {
    sufficientMonths = months;
  }
}
fs.writeFileSync(path.join(resultDir, 'capacity.json'), JSON.stringify({ criterion: 'Cada estratégia e semente aloca todas as 250 visitas no plano inicial.', sufficientMonths, rows }, null, 2));
const fields = Object.keys(rows[0]);
fs.writeFileSync(path.join(resultDir, 'capacity.csv'), [fields.join(','), ...rows.map(row => fields.map(field => row[field]).join(','))].join('\n') + '\n');
if (sufficientMonths !== 12) throw new Error('A janela de 12 meses não acomodou todas as visitas nos nove planos iniciais.');
console.log('A janela ampla de 12 meses acomodou todas as visitas nos nove planos iniciais.');
