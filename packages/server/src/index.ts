import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { config } from './config.js';
import { issueToken, verifyPassword, verifyToken, tokenFromHeader } from './auth.js';
import {
  createSession,
  killSession,
  renameSession,
  listSessions,
  isValidSessionName,
} from './tmux.js';
import { attachTerminal } from './terminal.js';

const app = Fastify({ logger: true });

await app.register(websocket);

// --- Auth helpers -----------------------------------------------------------

function requireAuth(req: { headers: Record<string, unknown> }): boolean {
  const token = tokenFromHeader(req.headers['authorization'] as string | undefined);
  return verifyToken(token);
}

// --- Routes -----------------------------------------------------------------

const loginSchema = z.object({ password: z.string() });

app.post('/api/auth/login', async (req, reply) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Body inválido' });
  }
  const ok = await verifyPassword(parsed.data.password);
  if (!ok) {
    return reply.code(401).send({ error: 'Password incorrecto' });
  }
  return { token: issueToken() };
});

app.get('/api/sessions', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'No autorizado' });
  return { sessions: await listSessions() };
});

const createSchema = z.object({ name: z.string() });

app.post('/api/sessions', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'No autorizado' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success || !isValidSessionName(parsed.data.name)) {
    return reply.code(400).send({ error: 'Nombre de sesión inválido' });
  }
  await createSession(parsed.data.name);
  return { ok: true };
});

app.delete<{ Params: { name: string } }>('/api/sessions/:name', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'No autorizado' });
  const { name } = req.params;
  if (!isValidSessionName(name)) {
    return reply.code(400).send({ error: 'Nombre de sesión inválido' });
  }
  await killSession(name);
  return { ok: true };
});

app.patch<{ Params: { name: string } }>('/api/sessions/:name', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'No autorizado' });
  const { name } = req.params;
  const parsed = createSchema.safeParse(req.body);
  if (!isValidSessionName(name) || !parsed.success || !isValidSessionName(parsed.data.name)) {
    return reply.code(400).send({ error: 'Nombre de sesión inválido' });
  }
  await renameSession(name, parsed.data.name);
  return { ok: true };
});

// --- WebSocket terminal ------------------------------------------------------

app.get('/api/terminal', { websocket: true }, (socket, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  const session = url.searchParams.get('session');

  if (!verifyToken(token)) {
    socket.close(1008, 'No autorizado');
    return;
  }
  if (!session || !isValidSessionName(session)) {
    socket.close(1008, 'Sesión inválida');
    return;
  }
  attachTerminal(socket, session);
});

// --- Static PWA (producción) -------------------------------------------------

if (existsSync(config.webDir)) {
  await app.register(fastifyStatic, { root: config.webDir });
  // SPA fallback: cualquier ruta no-API devuelve index.html.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn(`WEB_DIR no encontrado (${config.webDir}); sirviendo solo la API.`);
}

// --- Start -------------------------------------------------------------------

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Servidor escuchando en http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
