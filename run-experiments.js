import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const steps = [
  {
    label: 'Compilando o core',
    args: ['run', 'build', '--prefix', 'artefato/packages/core']
  },
  {
    label: 'Compilando os experimentos',
    args: ['run', 'build', '--prefix', 'experimentos']
  },
  {
    label: 'Gerando cenarios',
    args: ['run', 'generate', '--prefix', 'experimentos']
  },
  {
    label: 'Executando benchmark em lote',
    args: ['run', 'simulate', '--prefix', 'experimentos']
  },
  {
    label: 'Executando simulacao dinamica',
    args: ['run', 'simulate-dynamic', '--prefix', 'experimentos']
  },
  {
    label: 'Gerando relatorio HTML',
    command: 'node',
    args: ['experimentos/analise/generate_html_charts.js']
  }
];

console.log('===========================================================');
console.log('EXECUTANDO A BANCADA COMPLETA DE EXPERIMENTOS');
console.log('===========================================================');

for (const [index, step] of steps.entries()) {
  const command = step.command ?? npmCommand;
  console.log(`\n[${index + 1}/${steps.length}] ${step.label}...`);

  const result = spawnSync(command, step.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });

  if (result.error) {
    console.error(`Falha ao iniciar a etapa: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`A etapa terminou com codigo ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nBancada completa executada com sucesso.');
console.log('Resultados: experimentos/resultados/');
console.log('Relatorio: experimentos/analise/relatorio_experimentos.html');
