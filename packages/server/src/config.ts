import 'dotenv/config';
import { fileURLToPath } from 'node:url';
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

const defaultWebDir = path.resolve(__dirname, '../../web/dist');

export const config = {
  port: Number(process.env.PORT ?? 8723),
  host: process.env.HOST ?? '127.0.0.1',
  jwtSecret: required('JWT_SECRET', process.env.JWT_SECRET),
  passwordHash: required('PASSWORD_HASH', process.env.PASSWORD_HASH),
  tokenTtl: process.env.TOKEN_TTL ?? '7d',
  shell: process.env.SHELL || '/bin/zsh',
  home: os.homedir(),
  webDir: process.env.WEB_DIR ? path.resolve(process.env.WEB_DIR) : defaultWebDir,
};

export type Config = typeof config;
