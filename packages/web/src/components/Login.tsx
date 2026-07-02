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
      setError(err instanceof Error ? err.message : 'Failed to log in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="centered">
      <form className="card login" onSubmit={handleSubmit}>
        <h1>pocketty</h1>
        <p className="muted">Enter your password to connect.</p>
        <input
          type="password"
          placeholder="Password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={loading || !password}>
          {loading ? 'Connecting…' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
