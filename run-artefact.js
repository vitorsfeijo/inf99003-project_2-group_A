import { spawn } from 'node:child_process';
import path from 'node:path';

const root      = process.cwd();
const serverDir = path.resolve(root, 'artefato/packages/server');
const webDir    = path.resolve(root, 'artefato/packages/web');

console.log('===========================================================');
console.log('🚀 INICIANDO O ARTEFATO COMPUTACIONAL (BACKEND + FRONTEND)');
console.log('===========================================================');

// No Windows, spawn com shell:true é necessário para resolver npm.cmd.
// Passamos o comando completo como string para evitar o warning DEP0190
// (que ocorre ao passar args[] separados com shell:true).
function spawnCmd(cmd, cwd) {
  return spawn(cmd, { cwd, stdio: 'inherit', shell: true });
}

// 1. Servidor Fastify + SQLite (Porta 3001)
console.log('\n[1/2] Backend (Fastify + SQLite) → http://localhost:3001');
const serverProc = spawnCmd('npm start', serverDir);

// 2. Interface Web React + Vite (Porta 3000)
console.log('[2/2] Frontend (Vite + React)    → http://localhost:3000\n');
const webProc = spawnCmd('npm run dev', webDir);

// Encerramento limpo via Ctrl+C
function cleanup() {
  console.log('\n🛑 Encerrando serviços...');
  serverProc.kill();
  webProc.kill();
  process.exit(0);
}

process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);

serverProc.on('exit', code => {
  if (code !== null && code !== 0) {
    console.error(`\n❌ Backend encerrou com código ${code}`);
  }
});

webProc.on('exit', code => {
  if (code !== null && code !== 0) {
    console.error(`\n❌ Frontend encerrou com código ${code}`);
  }
});
