import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createScenario } from '../dist/fatorial/index.js';
import { planScenario as currentPlan } from '../../artefato/packages/core/dist/index.js';

const experimentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(experimentRoot, '..');
const baselineCommit = process.argv[2] ?? '423e6d4';
const outputDir = path.join(experimentRoot, 'analise', 'fatorial');
const bases = [
  'geosaude_us_restinga_20261106_30',
  'geosaude_cf_santa_marta_20261042_30'
];
const seeds = [20261101, 20261102, 20261103];
const configurations = [
  [15, 0.5, 5, 0], [30, 1, 10, 0.25], [45, 2, 22, 0.5],
  [45, 1, 5, 0.5], [30, 2, 5, 0.25], [15, 2, 22, 0.5]
];
const metrics = [
  ['coveragePercentage', 'Cobertura planejada', 1, 'p.p.'],
  ['priorityWeightedCoveragePercentage', 'Cobertura ponderada pela prioridade', 1, 'p.p.'],
  ['priorityWeightedPromptCoveragePercentage', 'Resposta pronta ponderada', 1, 'p.p.'],
  ['priorityWeightedActionableDelayDays', 'Atraso controlável ponderado', -1, 'dias'],
  ['totalTravelDistanceKm', 'Distância planejada', -1, 'km'],
  ['priorityPointsPerKm', 'Pontos clínicos por quilômetro', 1, 'pontos/km']
];

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'aps-core-baseline-'));
try {
  const archive = execFileSync('git', ['archive', baselineCommit,
    'artefato/packages/core', 'artefato/tsconfig.json'], { cwd: repoRoot, maxBuffer: 20 * 1024 * 1024 });
  const extracted = spawnSync('tar', ['-x', '-C', temporary], { input: archive, encoding: 'utf8' });
  if (extracted.status !== 0) throw new Error(extracted.stderr || 'Falha ao extrair o núcleo anterior.');
  const compiler = path.join(repoRoot, 'artefato', 'node_modules', '.bin', 'tsc');
  execFileSync(compiler, ['-p', path.join(temporary, 'artefato', 'packages', 'core', 'tsconfig.json')],
    { cwd: repoRoot, stdio: 'pipe' });
  const oldModule = pathToFileURL(path.join(temporary, 'artefato', 'packages', 'core', 'dist', 'index.js'));
  const { planScenario: oldPlan } = await import(oldModule.href);
  const rows = [];
  for (const source of bases) {
    const base = JSON.parse(fs.readFileSync(path.join(experimentRoot, 'cenarios', `${source}.json`)));
    for (const seed of seeds) for (const [patientCount, areaMultiplier, planningDays, overdueFraction]
      of configurations) {
      const { scenario } = createScenario(base, seed, patientCount, areaMultiplier,
        planningDays, overdueFraction);
      const previous = oldPlan(scenario, { strategyId: 'main-heuristic', enable1_5Opt: true });
      const current = currentPlan(scenario, { strategyId: 'main-heuristic', enable1_5Opt: true });
      const row = { source, seed, patientCount, areaMultiplier, planningDays, overdueFraction };
      for (const [key, , direction] of metrics) {
        row[`${key}Before`] = previous.metrics[key];
        row[`${key}After`] = current.metrics[key];
        row[`${key}Gain`] = direction * (current.metrics[key] - previous.metrics[key]);
      }
      rows.push(row);
    }
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const fields = Object.keys(rows[0]);
  fs.writeFileSync(path.join(outputDir, 'validacao-versoes.csv'), [fields.join(','),
    ...rows.map(row => fields.map(field => JSON.stringify(row[field])).join(','))].join('\n') + '\n');
  const formatted = value => value.toFixed(3).replace('.', ',');
  const lines = metrics.map(([key, label, , unit]) => {
    const values = rows.map(row => row[`${key}Gain`]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const wins = values.filter(value => value > 1e-6).length;
    const ties = values.filter(value => Math.abs(value) <= 1e-6).length;
    const losses = values.filter(value => value < -1e-6).length;
    return `| ${label} | ${formatted(mean)} ${unit} | ${wins}/${ties}/${losses} |`;
  });
  const markdown = `# Validação separada da heurística\n\n` +
    `Comparação pareada da versão anterior (${baselineCommit}) com o código atual. ` +
    `Foram usados dois territórios GeoSaúde (US Restinga e CF Santa Marta), as sementes ` +
    `${seeds.join(', ')} e seis combinações de fatores: ${rows.length} instâncias fora das sementes ` +
    `do relatório fatorial. Os pacientes são sintéticos e as escalas de área diferentes de 1× ` +
    `não representam limites oficiais. Ambos os métodos recebem o mesmo cenário e a mesma matriz ` +
    `Haversine. Valores positivos favorecem a versão atual.\n\n` +
    `| Indicador | Ganho médio | Vitórias/empates/derrotas |\n|---|---:|---:|\n` +
    lines.join('\n') + `\n\nOs dados por instância estão em [validacao-versoes.csv](validacao-versoes.csv). ` +
    `Esta é uma validação de planos iniciais; ela não mede faltas em campo nem rotas por ruas. ` +
    `O total de deslocamento pode crescer quando a versão atual encaixa mais visitas.\n\n` +
    `Para repetir: compile o núcleo e os experimentos e execute \`npm run factorial:validate --prefix experimentos\`. ` +
    `O comando extrai o núcleo do commit de referência para um diretório temporário e compara os ` +
    `mesmos cenários com a versão atual.\n`;
  fs.writeFileSync(path.join(outputDir, 'validacao-versoes.md'), markdown);
  console.log(`Validação concluída: ${rows.length} instâncias; referência ${baselineCommit}.`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
