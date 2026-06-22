import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env y complétala.`,
    );
  }
  return value;
}

/**
 * Directorio inicial para las sesiones nuevas (START_DIR). Debe ser una ruta
 * absoluta a un directorio existente; si no, se ignora y se usa el default
 * (cwd del server). Devuelve null cuando no está configurado o es inválido.
 */
function resolveStartDir(value: string | undefined): string | null {
  if (!value || value.trim() === '') return null;
  const dir = value.trim();
  if (!path.isAbsolute(dir)) {
    console.warn(`[config] START_DIR ignorado: "${dir}" no es una ruta absoluta.`);
    return null;
  }
  try {
    if (!statSync(dir).isDirectory()) throw new Error('no es un directorio');
  } catch {
    console.warn(`[config] START_DIR ignorado: "${dir}" no existe o no es un directorio.`);
    return null;
  }
  return dir;
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
};

export type Config = typeof config;
