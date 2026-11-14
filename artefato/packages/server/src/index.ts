import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDatabase } from './db/database.js';
import { registerApiRoutes } from './routes/api.js';
import { registerFieldRoutes } from './routes/field-api.js';
import { registerWebApp } from './routes/web-app.js';
import { initWalkRouter } from './routes/routing-provider.js';

const fastify = Fastify({
  logger: true,
  maxParamLength: 512,
  bodyLimit: 20 * 1024 * 1024
});

await fastify.register(cors, {
  origin: '*'
});

// Inicializar tabelas do SQLite
initDatabase();

// Carregar a rede de caminhada interna (gera o grafo a partir do mapa na primeira execução)
initWalkRouter(message => fastify.log.info(message));

// Registrar rotas da API
await registerApiRoutes(fastify);
await registerFieldRoutes(fastify);

// Interface compilada servida na mesma porta (modo aplicativo); em desenvolvimento, o Vite usa a porta 3000
const webAppServed = registerWebApp(fastify);

const PORT = Number(process.env.PORT ?? 3001);

try {
  await fastify.listen({ port: PORT, host: process.env.HOST ?? '0.0.0.0' });
  console.log(`🚀 Servidor backend rodando na porta ${PORT}`);
  if (webAppServed) console.log(`🗺️  Aplicativo disponível em http://localhost:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
