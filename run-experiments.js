import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
if (!process.env.OSRM_BASE_URL) throw new Error('Configure OSRM_BASE_URL para executar os experimentos com caminhada.');

const steps = [
  {
    label: 'Compilando o core',
    args: ['run', 'build', '--prefix', 'artefato/packages/core']
  },
  {
    label: 'Compilando o servidor de rotas',
    args: ['run', 'build', '--prefix', 'artefato/packages/server']
  },
  {
    label: 'Compilando os experimentos',
    args: ['run', 'build', '--prefix', 'experimentos']
  },
  {
    label: 'Comparando os territórios de Porto Alegre com caminhada',
    args: ['run', 'citywide:report', '--prefix', 'experimentos']
  },
  {
    label: 'Executando a análise fatorial com caminhada',
    args: ['run', 'factorial', '--prefix', 'experimentos']
  },
  {
    label: 'Gerando o relatório fatorial',
    args: ['run', 'factorial:report', '--prefix', 'experimentos']
  }
];

console.log('===========================================================');
console.log('EXECUTANDO AS ANÁLISES TERRITORIAL E FATORIAL');
console.log('===========================================================');

for (const [index, step] of steps.entries()) {
  const command = step.command ?? npmCommand;
  console.log(`\n[${index + 1}/${steps.length}] ${step.label}...`);

  const result = spawnSync(command, step.args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32'
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

console.log('\nAnálises territorial e fatorial executadas com sucesso.');
console.log('Resultados: experimentos/resultados/');
console.log('Relatorio: experimentos/analise/fatorial-caminhada/relatorio.html');
