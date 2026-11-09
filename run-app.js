import { spawn } from 'node:child_process';
import path from 'node:path';

// Modo aplicativo: um único servidor entrega a API e a interface compilada na porta 3001,
// com o roteador de caminhada interno (sem Docker). O navegador abre quando o servidor responde.
const root = process.cwd();
const serverDir = path.resolve(root, 'artefato/packages/server');
const port = Number(process.env.PORT ?? 3001);
const url = `http://localhost:${port}`;

console.log('===========================================================');
console.log('🗺️  PLANEJAMENTO DE VISITAS DOMICILIARES — modo aplicativo');
console.log('===========================================================');

const server = spawn(process.execPath, ['dist/index.js'], { cwd: serverDir, stdio: 'inherit', env: { ...process.env, PORT: String(port) } });

function openBrowser() {
  const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
  spawn(command, args, { stdio: 'ignore', detached: true }).unref();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${url}/api/routing-status`);
      if (response.ok) {
        const status = await response.json();
        if (!status.walkingNetworkConfigured) console.warn(`\n⚠️  Roteador de caminhada indisponível: ${status.detail ?? 'execute npm run prepare-map'}`);
        console.log(`\n✅ Aplicativo pronto em ${url} (Ctrl+C para encerrar)`);
        if (!process.argv.includes('--no-browser')) openBrowser();
        return;
      }
    } catch {
      // Servidor ainda iniciando; tenta novamente em seguida.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.error(`O servidor não respondeu em ${url}. Veja as mensagens acima.`);
}

void waitForServer();

function cleanup() {
  server.kill();
  process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
server.on('exit', code => {
  if (code !== null && code !== 0) console.error(`\n❌ Servidor encerrou com código ${code}`);
  process.exit(code ?? 0);
});
