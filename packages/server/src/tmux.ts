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

/** Valid session names: avoids injection and characters tmux rejects. */
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
    // tmux exits with a non-zero code when there is no server/sessions: empty list.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('no server running') || message.includes('no sessions')) {
      return [];
    }
    throw err;
  }
}

export async function createSession(name: string, cwd?: string): Promise<void> {
  const args = ['new-session', '-d', '-s', name, '-x', '120', '-y', '40'];
  const dir = cwd ?? config.startDir;
  if (dir) args.push('-c', dir);
  await tmux(args);
}

/** Sanitizes text into a valid session name (same charset as NAME_RE). */
export function sanitizeSessionName(input: string): string {
  const cleaned = input
    .replace(/[^A-Za-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || 'session';
}

/**
 * Returns `base` (sanitized), or `base-2`, `base-3`… — the first free name
 * against `existing`. Used when launching shortcuts (always a new session).
 */
export function uniqueSessionName(base: string, existing: string[]): string {
  const taken = new Set(existing);
  const name = sanitizeSessionName(base);
  if (!taken.has(name)) return name;
  for (let i = 2; ; i++) {
    const suffix = `-${i}`;
    const candidate = name.slice(0, 64 - suffix.length) + suffix;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function killSession(name: string): Promise<void> {
  await tmux(['kill-session', '-t', name]);
}

export async function renameSession(name: string, newName: string): Promise<void> {
  await tmux(['rename-session', '-t', name, newName]);
}

/**
 * Enables the tmux server's mouse mode: the mouse wheel (desktop) and the
 * synthetic touch scroll (mobile, see TerminalView) enter copy mode and
 * scroll the history instead of sending arrow keys. It is a global server
 * option, so it also applies to the laptop's tmux.
 */
export async function enableMouse(): Promise<void> {
  try {
    await tmux(['set-option', '-g', 'mouse', 'on']);
  } catch {
    // No server yet: the next attach retries it.
  }
}

export async function sessionExists(name: string): Promise<boolean> {
  try {
    await tmux(['has-session', '-t', name]);
    return true;
  } catch {
    return false;
  }
}
