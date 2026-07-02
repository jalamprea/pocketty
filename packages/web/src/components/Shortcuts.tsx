import { useCallback, useEffect, useState } from 'react';
import {
  listShortcuts,
  createShortcut,
  updateShortcut,
  deleteShortcut,
  launchShortcut,
  AuthError,
  type Shortcut,
} from '../api.ts';

interface Props {
  onOpen: (session: string) => void;
  onAuthError: () => void;
}

// null = form closed; id null = create; id set = edit.
type FormState = { id: string | null; label: string; path: string };

/**
 * Shortcuts: favorite folders launched as a new session with a single tap. Each
 * tap creates a distinct session (the server resolves the unique name).
 */
export function Shortcuts({ onOpen, onAuthError }: Props) {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  // Default dir that relative paths resolve against (START_DIR or its fallback).
  const [baseDir, setBaseDir] = useState('');
  // In-flight feedback: the form action running, and the shortcut being launched.
  const [pending, setPending] = useState<'save' | 'delete' | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { shortcuts, baseDir } = await listShortcuts();
      setShortcuts(shortcuts);
      setBaseDir(baseDir);
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Failed to load shortcuts');
    }
  }, [onAuthError]);

  useEffect(() => {
    load();
  }, [load]);

  async function launch(s: Shortcut) {
    if (launchingId) return;
    setError(null);
    setLaunchingId(s.id);
    try {
      const { name } = await launchShortcut(s.id);
      onOpen(name);
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Failed to launch session');
    } finally {
      setLaunchingId(null);
    }
  }

  async function save() {
    if (!form || pending) return;
    const label = form.label.trim();
    const path = form.path.trim();
    if (!label || !path) {
      setError('Fill in name and path.');
      return;
    }
    setError(null);
    setPending('save');
    try {
      if (form.id) await updateShortcut(form.id, { label, path });
      else await createShortcut(label, path);
      setForm(null);
      await load();
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setPending(null);
    }
  }

  async function remove(id: string) {
    if (pending) return;
    if (!confirm('Delete this shortcut?')) return;
    setError(null);
    setPending('delete');
    try {
      await deleteShortcut(id);
      setForm(null);
      await load();
    } catch (err) {
      if (err instanceof AuthError) return onAuthError();
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="shortcuts">
      <div className="shortcuts-head">
        <span className="shortcuts-title">Shortcuts</span>
        <button
          className="ghost"
          onClick={() => setForm({ id: null, label: '', path: '' })}
          title="Add shortcut"
        >
          ＋
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {shortcuts.length > 0 && (
        <div className="shortcut-chips">
          {shortcuts.map((s) => (
            <div className="shortcut-chip" key={s.id}>
              <button
                className="shortcut-launch"
                onClick={() => launch(s)}
                title={s.path}
                disabled={launchingId === s.id}
              >
                {launchingId === s.id ? 'Launching…' : s.label}
              </button>
              <button
                className="ghost shortcut-edit"
                onClick={() => setForm({ id: s.id, label: s.label, path: s.path })}
                title="Edit"
              >
                ✎
              </button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <div className="shortcut-form card">
          <label className="shortcut-field">
            <span className="field-label">Name</span>
            <input
              placeholder="shortcut name"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </label>
          <label className="shortcut-field">
            <span className="field-label">Folder path</span>
            <input
              placeholder={
                baseDir
                  ? `Path relative to ${baseDir} or /absolute/folder/`
                  : 'folder/app or /absolute/folder/'
              }
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
          </label>
          <div className="shortcut-form-actions">
            <button onClick={save} disabled={pending !== null}>
              {pending === 'save' ? 'Saving…' : 'Save'}
            </button>
            <button className="ghost" onClick={() => setForm(null)} disabled={pending !== null}>
              Cancel
            </button>
            {form.id && (
              <button
                className="ghost danger"
                onClick={() => remove(form.id!)}
                disabled={pending !== null}
              >
                {pending === 'delete' ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
