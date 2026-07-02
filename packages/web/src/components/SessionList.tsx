import { useEffect, useState, useCallback } from 'react';
import {
  listSessions,
  createSession,
  killSession,
  renameSession,
  AuthError,
  type Session,
} from '../api.ts';
import { Shortcuts } from './Shortcuts.tsx';

// Same character set the backend validates (isValidSessionName).
const NAME_RE = /^[A-Za-z0-9_.-]{1,64}$/;

interface Props {
  onOpen: (session: string) => void;
  onLogout: () => void;
  onAuthError: () => void;
}

export function SessionList({ onOpen, onLogout, onAuthError }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { sessions } = await listSessions();
      setSessions(sessions);
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [onAuthError]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate() {
    const name = newName.trim() || `session-${Date.now().toString(36)}`;
    try {
      await createSession(name);
      setNewName('');
      onOpen(name);
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }
  }

  async function handleRename(name: string) {
    const next = prompt(`New name for "${name}":`, name)?.trim();
    if (!next || next === name) return;
    if (!NAME_RE.test(next)) {
      setError('Invalid name. Use letters, numbers, "_", "." or "-" (max 64).');
      return;
    }
    try {
      await renameSession(name, next);
      await refresh();
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Failed to rename session');
    }
  }

  async function handleKill(name: string) {
    if (!confirm(`Kill session "${name}"? Its state will be lost.`)) return;
    try {
      await killSession(name);
      await refresh();
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Failed to kill session');
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Sessions</h1>
        <div className="topbar-actions">
          <button className="ghost" onClick={refresh} title="Refresh">
            ↻
          </button>
          <button className="ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="new-session">
        <input
          placeholder="name (optional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button onClick={handleCreate}>+ New session</button>
      </div>

      <Shortcuts onOpen={onOpen} onAuthError={onAuthError} />

      {error && <div className="error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && sessions.length === 0 && (
        <p className="muted">No sessions. Create one to get started.</p>
      )}

      <ul className="session-list">
        {sessions.map((s) => (
          <li key={s.name} className="card session-item">
            <button className="session-open" onClick={() => onOpen(s.name)}>
              <span className="session-name">{s.name}</span>
              <span className="session-meta">
                {s.windows} window{s.windows === 1 ? '' : 's'} ·{' '}
                <span className={s.attached ? 'badge attached' : 'badge detached'}>
                  {s.attached ? 'active' : 'inactive'}
                </span>
              </span>
            </button>
            <button
              className="ghost"
              onClick={() => handleRename(s.name)}
              title="Rename"
            >
              ✎
            </button>
            <button className="ghost danger" onClick={() => handleKill(s.name)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
