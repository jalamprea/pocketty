import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

/**
 * Resolves `input` to an existing absolute directory. If it is relative, resolves
 * it against `base`. Returns the absolute path or null if it does not exist / is not a directory.
 * Reused by START_DIR and by the shortcuts (see favorites.ts).
 */
export function resolveExistingDir(input: string | undefined, base: string): string | null {
  if (!input || input.trim() === '') return null;
  const raw = input.trim();
  const dir = path.isAbsolute(raw) ? raw : path.resolve(base, raw);
  try {
    if (!statSync(dir).isDirectory()) return null;
  } catch {
    return null;
  }
  return dir;
}

/**
 * Initial directory for new sessions (START_DIR). Must be an absolute path
 * to an existing directory; otherwise it is ignored and the default is used
 * (server cwd). Returns null when it is not configured or is invalid.
 */
function resolveStartDir(value: string | undefined): string | null {
  if (!value || value.trim() === '') return null;
  const dir = value.trim();
  if (!path.isAbsolute(dir)) {
    console.warn(`[config] START_DIR ignored: "${dir}" is not an absolute path.`);
    return null;
  }
  const resolved = resolveExistingDir(dir, dir);
  if (!resolved) {
    console.warn(`[config] START_DIR ignored: "${dir}" does not exist or is not a directory.`);
  }
  return resolved;
}

const defaultWebDir = path.resolve(__dirname, '../../web/dist');

export const config = {
  port: Number(process.env.PORT ?? 8723),
  host: process.env.HOST ?? '127.0.0.1',
  jwtSecret: required('JWT_SECRET', process.env.JWT_SECRET),
  passwordHash: required('PASSWORD_HASH', process.env.PASSWORD_HASH),
  tokenTtl: process.env.TOKEN_TTL ?? '7d',
  shell: process.env.SHELL || '/bin/zsh',
  home: os.homedir(),
  startDir: resolveStartDir(process.env.START_DIR),
  webDir: process.env.WEB_DIR ? path.resolve(process.env.WEB_DIR) : defaultWebDir,
  dataDir: process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(os.homedir(), '.pocketty'),
};

export type Config = typeof config;
