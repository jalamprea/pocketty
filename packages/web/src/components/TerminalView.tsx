import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { terminalWsUrl } from '../api.ts';
import { ControlBar } from './ControlBar.tsx';

interface Props {
  session: string;
  onBack: () => void;
  onAuthError: () => void;
}

type Status = 'connecting' | 'open' | 'closed';

export function TerminalView({ session, onBack, onAuthError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const ctrlRef = useRef(false);
  const [status, setStatus] = useState<Status>('connecting');
  const [ctrlActive, setCtrlActive] = useState(false);

  // Envía datos crudos al PTY a través del WebSocket.
  function sendInput(data: string) {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
  }

  function toggleCtrl() {
    ctrlRef.current = !ctrlRef.current;
    setCtrlActive(ctrlRef.current);
  }

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: { background: '#0b0e14', foreground: '#d6deeb' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current!);
    fit.fit();

    const ws = new WebSocket(terminalWsUrl(session));
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      term.focus();
    };
    ws.onmessage = (ev) => term.write(ev.data);
    ws.onclose = (ev) => {
      setStatus('closed');
      if (ev.code === 1008) onAuthError();
    };

    // Entrada del usuario desde el teclado del terminal.
    const dataSub = term.onData((data) => {
      if (ctrlRef.current && data.length === 1) {
        // Convierte la tecla en su carácter de control (Ctrl+A = 0x01, etc.).
        const code = data.toUpperCase().charCodeAt(0);
        sendInput(String.fromCharCode(code & 0x1f));
        ctrlRef.current = false;
        setCtrlActive(false);
        return;
      }
      sendInput(data);
    });

    // Reajusta el tamaño del PTY cuando cambia el layout (teclado, rotación…).
    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {
        /* layout transitorio */
      }
    });
    resizeObserver.observe(containerRef.current!);

    return () => {
      resizeObserver.disconnect();
      dataSub.dispose();
      ws.close();
      term.dispose();
    };
  }, [session, onAuthError]);

  // La botonera envía directo y devuelve el foco al terminal.
  function sendFromBar(data: string) {
    if (ctrlRef.current && data.length === 1) {
      const code = data.toUpperCase().charCodeAt(0);
      sendInput(String.fromCharCode(code & 0x1f));
      ctrlRef.current = false;
      setCtrlActive(false);
      return;
    }
    sendInput(data);
  }

  return (
    <div className="page terminal-page">
      <header className="topbar">
        <button className="ghost" onClick={onBack}>
          ‹ Sesiones
        </button>
        <span className="session-title">{session}</span>
        <span className={`status status-${status}`}>
          {status === 'open' ? '●' : status === 'connecting' ? '…' : '○'}
        </span>
      </header>
      <div className="terminal-host" ref={containerRef} />
      <ControlBar send={sendFromBar} ctrlActive={ctrlActive} onToggleCtrl={toggleCtrl} />
    </div>
  );
}
