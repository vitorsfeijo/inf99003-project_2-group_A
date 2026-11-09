import { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webDistDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../web/dist');

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.map': 'application/json; charset=utf-8'
};

/**
 * Serve a interface compilada (`packages/web/dist`) na mesma porta da API, para usar o
 * sistema como um aplicativo local sem o servidor de desenvolvimento do Vite.
 * Retorna falso quando a interface ainda não foi compilada.
 */
export function registerWebApp(fastify: FastifyInstance): boolean {
  const indexFile = path.join(webDistDirectory, 'index.html');
  if (!fs.existsSync(indexFile)) return false;
  fastify.get('/*', async (request, reply) => {
    const requested = decodeURIComponent((request.params as { '*': string })['*'] ?? '');
    if (requested.startsWith('api/')) return reply.status(404).send({ error: 'Rota da API não encontrada.' });
    const filePath = path.resolve(webDistDirectory, requested);
    const insideDist = filePath === webDistDirectory || filePath.startsWith(webDistDirectory + path.sep);
    const target = insideDist && requested && fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : indexFile;
    reply.header('Content-Type', CONTENT_TYPES[path.extname(target)] ?? 'application/octet-stream');
    return reply.send(fs.readFileSync(target));
  });
  return true;
}
