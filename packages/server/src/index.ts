import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config, resolveExistingDir } from './config.js';
import { issueToken, verifyPassword, verifyToken, tokenFromHeader } from './auth.js';
import {
  createSession,
  killSession,
  renameSession,
  listSessions,
  isValidSessionName,
  uniqueSessionName,
} from './tmux.js';
import {
  listFavorites,
  getFavorite,
  addFavorite,
  updateFavorite,
  removeFavorite,
} from './favorites.js';
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
    return reply.code(400).send({ error: 'Invalid body' });
  }
  const ok = await verifyPassword(parsed.data.password);
  if (!ok) {
    return reply.code(401).send({ error: 'Incorrect password' });
  }
  return { token: issueToken() };
});

app.get('/api/sessions', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'Unauthorized' });
  return { sessions: await listSessions() };
});

const createSchema = z.object({ name: z.string() });

app.post('/api/sessions', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'Unauthorized' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success || !isValidSessionName(parsed.data.name)) {
    return reply.code(400).send({ error: 'Invalid session name' });
  }
  await createSession(parsed.data.name);
  return { ok: true };
});

app.delete<{ Params: { name: string } }>('/api/sessions/:name', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'Unauthorized' });
  const { name } = req.params;
  if (!isValidSessionName(name)) {
    return reply.code(400).send({ error: 'Invalid session name' });
  }
  await killSession(name);
  return { ok: true };
});

app.patch<{ Params: { name: string } }>('/api/sessions/:name', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'Unauthorized' });
  const { name } = req.params;
  const parsed = createSchema.safeParse(req.body);
  if (!isValidSessionName(name) || !parsed.success || !isValidSessionName(parsed.data.name)) {
    return reply.code(400).send({ error: 'Invalid session name' });
  }
  await renameSession(name, parsed.data.name);
  return { ok: true };
});

// --- Shortcuts ---------------------------------------------------------------

app.get('/api/shortcuts', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'Unauthorized' });
  // baseDir = the directory relative shortcut paths resolve against (same as in
  // favorites.ts), so the client can show it in the path placeholder.
  return { shortcuts: await listFavorites(), baseDir: config.startDir ?? config.home };
});

const shortcutCreateSchema = z.object({ label: z.string(), path: z.string() });

app.post('/api/shortcuts', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'Unauthorized' });
  const parsed = shortcutCreateSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
  try {
    return { shortcut: await addFavorite(parsed.data) };
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : 'Error' });
  }
});

const shortcutUpdateSchema = z.object({
  label: z.string().optional(),
  path: z.string().optional(),
});

app.patch<{ Params: { id: string } }>('/api/shortcuts/:id', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'Unauthorized' });
  const parsed = shortcutUpdateSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid body' });
  try {
    return { shortcut: await updateFavorite(req.params.id, parsed.data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error';
    if (msg === 'not-found') {
      return reply.code(404).send({ error: 'Shortcut not found' });
    }
    return reply.code(400).send({ error: msg });
  }
});

app.delete<{ Params: { id: string } }>('/api/shortcuts/:id', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'Unauthorized' });
  await removeFavorite(req.params.id);
  return { ok: true };
});

app.post<{ Params: { id: string } }>('/api/shortcuts/:id/launch', async (req, reply) => {
  if (!requireAuth(req)) return reply.code(401).send({ error: 'Unauthorized' });
  const favorite = await getFavorite(req.params.id);
  if (!favorite) return reply.code(404).send({ error: 'Shortcut not found' });
  // The path comes from the saved favorite (not from the client); we revalidate that it
  // still exists in case the folder was deleted after saving it.
  const dir = resolveExistingDir(favorite.path, config.home);
  if (!dir) {
    return reply.code(400).send({ error: `Folder "${favorite.path}" no longer exists.` });
  }
  const existing = (await listSessions()).map((s) => s.name);
  const name = uniqueSessionName(path.basename(dir), existing);
  await createSession(name, dir);
  return { name };
});

// --- WebSocket terminal ------------------------------------------------------

app.get('/api/terminal', { websocket: true }, (socket, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  const session = url.searchParams.get('session');

  if (!verifyToken(token)) {
    socket.close(1008, 'Unauthorized');
    return;
  }
  if (!session || !isValidSessionName(session)) {
    socket.close(1008, 'Invalid session');
    return;
  }
  attachTerminal(socket, session);
});

// --- Static PWA (production) -------------------------------------------------

if (existsSync(config.webDir)) {
  await app.register(fastifyStatic, { root: config.webDir });
  // SPA fallback: any non-API route returns index.html.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api')) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn(`WEB_DIR not found (${config.webDir}); serving only the API.`);
}

// --- Start -------------------------------------------------------------------

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Server listening on http://${config.host}:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
