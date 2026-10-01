import Fastify from 'fastify';
import cors from '@fastify/cors';
import { initDatabase } from './db/database.js';
import { registerApiRoutes } from './routes/api.js';

const fastify = Fastify({
  logger: true
});

await fastify.register(cors, {
  origin: '*'
});

// Inicializar tabelas do SQLite
initDatabase();

// Registrar rotas da API
await registerApiRoutes(fastify);

const PORT = 3001;

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🚀 Servidor backend rodando na porta ${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
