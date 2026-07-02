import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config, resolveExistingDir } from './config.js';

/**
 * Shortcuts: favorite folders that launch as a new session with a single
 * tap. Persisted in a JSON inside config.dataDir (single-user, no DB).
 */
export interface Shortcut {
  id: string;
  label: string;
  path: string; // absolute dir, already validated
}

const FILE = path.join(config.dataDir, 'favorites.json');
const LABEL_MAX = 80;

// Serializes writes: avoids race conditions in the read-modify-write
// when consecutive mutations arrive from the UI.
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function read(): Promise<Shortcut[]> {
  try {
    const data = JSON.parse(await readFile(FILE, 'utf8'));
    if (!Array.isArray(data)) return [];
    return data.filter(
      (s): s is Shortcut =>
        s &&
        typeof s.id === 'string' &&
        typeof s.label === 'string' &&
        typeof s.path === 'string',
    );
  } catch {
    // Does not exist yet or corrupt JSON: empty list.
    return [];
  }
}

async function write(items: Shortcut[]): Promise<void> {
  await mkdir(config.dataDir, { recursive: true });
  await writeFile(FILE, JSON.stringify(items, null, 2), 'utf8');
}

function cleanLabel(label: unknown): string {
  const s = typeof label === 'string' ? label.trim() : '';
  if (!s || s.length > LABEL_MAX) {
    throw new Error(`Name must be between 1 and ${LABEL_MAX} characters.`);
  }
  return s;
}

function resolvePath(input: unknown): string {
  const raw = typeof input === 'string' ? input : '';
  const dir = resolveExistingDir(raw, config.startDir ?? config.home);
  if (!dir) {
    throw new Error(`Folder "${raw.trim()}" does not exist or is not a directory.`);
  }
  return dir;
}

export function listFavorites(): Promise<Shortcut[]> {
  return read();
}

export function getFavorite(id: string): Promise<Shortcut | undefined> {
  return read().then((items) => items.find((s) => s.id === id));
}

export function addFavorite(input: { label: unknown; path: unknown }): Promise<Shortcut> {
  return serialize(async () => {
    const shortcut: Shortcut = {
      id: randomUUID(),
      label: cleanLabel(input.label),
      path: resolvePath(input.path),
    };
    const items = await read();
    items.push(shortcut);
    await write(items);
    return shortcut;
  });
}

export function updateFavorite(
  id: string,
  input: { label?: unknown; path?: unknown },
): Promise<Shortcut> {
  return serialize(async () => {
    const items = await read();
    const idx = items.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('not-found');
    const next: Shortcut = {
      ...items[idx],
      ...(input.label !== undefined ? { label: cleanLabel(input.label) } : {}),
      ...(input.path !== undefined ? { path: resolvePath(input.path) } : {}),
    };
    items[idx] = next;
    await write(items);
    return next;
  });
}

export function removeFavorite(id: string): Promise<void> {
  return serialize(async () => {
    const items = await read();
    await write(items.filter((s) => s.id !== id));
  });
}
