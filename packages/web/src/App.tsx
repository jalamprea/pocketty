import { useState } from 'react';
import { getToken, clearToken } from './api.ts';
import { Login } from './components/Login.tsx';
import { SessionList } from './components/SessionList.tsx';
import { TerminalView } from './components/TerminalView.tsx';

type View = { name: 'login' } | { name: 'sessions' } | { name: 'terminal'; session: string };

export function App() {
  const [view, setView] = useState<View>(() =>
    getToken() ? { name: 'sessions' } : { name: 'login' },
  );

  function handleLoggedIn() {
    setView({ name: 'sessions' });
  }

  function handleLogout() {
    clearToken();
    setView({ name: 'login' });
  }

  function openSession(session: string) {
    setView({ name: 'terminal', session });
  }

  function backToSessions() {
    setView({ name: 'sessions' });
  }

  if (view.name === 'login') {
    return <Login onLoggedIn={handleLoggedIn} />;
  }
  if (view.name === 'sessions') {
    return (
      <SessionList
        onOpen={openSession}
        onLogout={handleLogout}
        onAuthError={handleLogout}
      />
    );
  }
  return (
    <TerminalView
      session={view.session}
      onBack={backToSessions}
      onAuthError={handleLogout}
    />
  );
}
