import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWalkingCostMatrix } from '../../artefato/packages/server/dist/routes/road-matrix.js';
import { validateScenario } from '../../artefato/packages/core/dist/validation/scenario.js';
import { createScenario, DESIGN } from '../dist/fatorial/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.env.OSRM_BASE_URL) throw new Error('Configure OSRM_BASE_URL para verificar as matrizes.');
const cityDir = path.join(root, 'resultados', 'porto-alegre-caminhada', 'matrices');
const factorialDir = path.join(root, 'resultados', 'fatorial-caminhada', 'matrices');
const cityFiles = fs.readdirSync(cityDir).filter(name => name.endsWith('.json'));
const base = JSON.parse(fs.readFileSync(path.join(root, 'cenarios', `${DESIGN.sourceScenario}.json`), 'utf8'));
let checked = 0;

async function compare(file, scenario) {
  const expected = JSON.parse(fs.readFileSync(file, 'utf8'));
  const eligible = validateScenario(scenario).eligiblePatients;
  const actual = await buildWalkingCostMatrix({ ...scenario, patients: eligible });
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Matriz diferente da referência foot.lua: ${file}`);
  }
  checked++;
}

for (const name of cityFiles) {
  const scenario = JSON.parse(fs.readFileSync(path.join(root, 'cenarios', name), 'utf8'));
  await compare(path.join(cityDir, name), scenario);
}
for (const seed of DESIGN.seeds) for (const count of DESIGN.patients)
  for (const area of DESIGN.areaMultipliers) {
    const { scenario } = createScenario(base, seed, count, area, DESIGN.planningDays[0], DESIGN.overdueFractions[0]);
    await compare(path.join(factorialDir, `s${seed}_p${count}_a${area}.json`), scenario);
  }

console.log(`Matrizes idênticas ao OSRM foot.lua: ${checked} (${cityFiles.length} territoriais e ${checked - cityFiles.length} fatoriais).`);
