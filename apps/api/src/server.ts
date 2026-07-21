import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({
  service: 'tmcc-api',
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
