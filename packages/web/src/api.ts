const TOKEN_KEY = 'tui-app-token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export interface Session {
  name: string;
  windows: number;
  attached: boolean;
  createdAt: number;
}

class AuthError extends Error {}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  // Only declare JSON when we actually send a body: Fastify rejects an empty
  // body if the Content-Type is application/json (e.g. DELETE without a body).
  if (init.body != null) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearToken();
    throw new AuthError('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function login(password: string): Promise<string> {
  const { token } = await request<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  setToken(token);
  return token;
}

export function listSessions(): Promise<{ sessions: Session[] }> {
  return request('/api/sessions');
}

export function createSession(name: string): Promise<{ ok: boolean }> {
  return request('/api/sessions', { method: 'POST', body: JSON.stringify({ name }) });
}

export function killSession(name: string): Promise<{ ok: boolean }> {
  return request(`/api/sessions/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export function renameSession(name: string, newName: string): Promise<{ ok: boolean }> {
  return request(`/api/sessions/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: newName }),
  });
}

export interface Shortcut {
  id: string;
  label: string;
  path: string;
}

export function listShortcuts(): Promise<{ shortcuts: Shortcut[] }> {
  return request('/api/shortcuts');
}

export function createShortcut(label: string, path: string): Promise<{ shortcut: Shortcut }> {
  return request('/api/shortcuts', {
    method: 'POST',
    body: JSON.stringify({ label, path }),
  });
}

export function updateShortcut(
  id: string,
  data: { label?: string; path?: string },
): Promise<{ shortcut: Shortcut }> {
  return request(`/api/shortcuts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteShortcut(id: string): Promise<{ ok: boolean }> {
  return request(`/api/shortcuts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Creates a new session inside the shortcut's folder; returns its name. */
export function launchShortcut(id: string): Promise<{ name: string }> {
  return request(`/api/shortcuts/${encodeURIComponent(id)}/launch`, { method: 'POST' });
}

/** Terminal WebSocket URL, with token and session in the query. */
export function terminalWsUrl(session: string): string {
  const token = getToken() ?? '';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const params = new URLSearchParams({ session, token });
  return `${proto}://${location.host}/api/terminal?${params.toString()}`;
}

export { AuthError };
