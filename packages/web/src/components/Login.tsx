import { useState, type FormEvent } from 'react';
import { login } from '../api.ts';

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="centered">
      <form className="card login" onSubmit={handleSubmit}>
        <h1>Remote Terminal</h1>
        <p className="muted">Ingresa tu password para conectarte.</p>
        <input
          type="password"
          placeholder="Password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading || !password}>
          {loading ? 'Conectando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
