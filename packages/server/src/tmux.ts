import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.js';

const exec = promisify(execFile);

export interface TmuxSession {
  name: string;
  windows: number;
  attached: boolean;
  createdAt: number;
}

/** Nombres de sesión válidos: evita inyección y caracteres que tmux rechaza. */
const NAME_RE = /^[A-Za-z0-9_.-]{1,64}$/;

export function isValidSessionName(name: string): boolean {
  return NAME_RE.test(name);
}

const baseEnv = { ...process.env, HOME: config.home };

async function tmux(args: string[]): Promise<string> {
  const { stdout } = await exec('tmux', args, { env: baseEnv });
  return stdout;
}

export async function listSessions(): Promise<TmuxSession[]> {
  try {
    const out = await tmux([
      'list-sessions',
      '-F',
      '#{session_name}|#{session_windows}|#{session_attached}|#{session_created}',
    ]);
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, windows, attached, created] = line.split('|');
        return {
          name,
          windows: Number(windows) || 0,
          attached: attached === '1',
          createdAt: Number(created) * 1000 || 0,
        };
      });
  } catch (err: unknown) {
    // tmux sale con código != 0 cuando no hay servidor/sesiones: lista vacía.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('no server running') || message.includes('no sessions')) {
      return [];
    }
    throw err;
  }
}

export async function createSession(name: string): Promise<void> {
  const args = ['new-session', '-d', '-s', name, '-x', '120', '-y', '40'];
  if (config.startDir) args.push('-c', config.startDir);
  await tmux(args);
}

export async function killSession(name: string): Promise<void> {
  await tmux(['kill-session', '-t', name]);
}

export async function renameSession(name: string, newName: string): Promise<void> {
  await tmux(['rename-session', '-t', name, newName]);
}

export async function sessionExists(name: string): Promise<boolean> {
  try {
    await tmux(['has-session', '-t', name]);
    return true;
  } catch {
    return false;
  }
}
