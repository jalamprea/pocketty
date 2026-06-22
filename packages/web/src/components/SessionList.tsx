import { useEffect, useState, useCallback } from 'react';
import {
  listSessions,
  createSession,
  killSession,
  renameSession,
  AuthError,
  type Session,
} from '../api.ts';

// Mismo set de caracteres que valida el backend (isValidSessionName).
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
      setError(err instanceof Error ? err.message : 'Error al cargar sesiones');
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
      setError(err instanceof Error ? err.message : 'Error al crear sesión');
    }
  }

  async function handleRename(name: string) {
    const next = prompt(`Nuevo nombre para "${name}":`, name)?.trim();
    if (!next || next === name) return;
    if (!NAME_RE.test(next)) {
      setError('Nombre inválido. Usa letras, números, "_", "." o "-" (máx. 64).');
      return;
    }
    try {
      await renameSession(name, next);
      await refresh();
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Error al renombrar sesión');
    }
  }

  async function handleKill(name: string) {
    if (!confirm(`¿Matar la sesión "${name}"? Se perderá su estado.`)) return;
    try {
      await killSession(name);
      await refresh();
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Error al matar sesión');
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Sesiones</h1>
        <div className="topbar-actions">
          <button className="ghost" onClick={refresh} title="Refrescar">
            ↻
          </button>
          <button className="ghost" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      <div className="new-session">
        <input
          placeholder="nombre (opcional)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button onClick={handleCreate}>+ Nueva sesión</button>
      </div>

      {error && <div className="error">{error}</div>}
      {loading && <p className="muted">Cargando…</p>}
      {!loading && sessions.length === 0 && (
        <p className="muted">No hay sesiones. Crea una nueva para empezar.</p>
      )}

      <ul className="session-list">
        {sessions.map((s) => (
          <li key={s.name} className="card session-item">
            <button className="session-open" onClick={() => onOpen(s.name)}>
              <span className="session-name">{s.name}</span>
              <span className="session-meta">
                {s.windows} ventana{s.windows === 1 ? '' : 's'} ·{' '}
                <span className={s.attached ? 'badge attached' : 'badge detached'}>
                  {s.attached ? 'activa' : 'inactiva'}
                </span>
              </span>
            </button>
            <button
              className="ghost"
              onClick={() => handleRename(s.name)}
              title="Renombrar"
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
