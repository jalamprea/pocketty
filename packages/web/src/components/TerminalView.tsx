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

  // Sends raw data to the PTY through the WebSocket.
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

    // User input from the terminal keyboard.
    const dataSub = term.onData((data) => {
      if (ctrlRef.current && data.length === 1) {
        // Converts the key into its control character (Ctrl+A = 0x01, etc.).
        const code = data.toUpperCase().charCodeAt(0);
        sendInput(String.fromCharCode(code & 0x1f));
        ctrlRef.current = false;
        setCtrlActive(false);
        return;
      }
      sendInput(data);
    });

    // Resizes the PTY when the layout changes (keyboard, rotation…).
    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {
        /* transient layout */
      }
    });
    resizeObserver.observe(containerRef.current!);

    // Touch scroll → tmux history. On a phone there's no wheel, so we translate
    // the vertical drag into SGR wheel events (button 64 = up, 65 = down) that
    // tmux (with mouse mode) interprets as copy-mode scroll. Dragging down
    // reveals earlier content (wheel up), like reading.
    const host = containerRef.current!;
    let touchY = 0;
    let accum = 0;
    const STEP = 18; // drag pixels per wheel "tick"

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchY = e.touches[0].clientY;
      accum = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      accum += y - touchY;
      touchY = y;
      const col = Math.max(1, (term.cols / 2) | 0);
      const row = Math.max(1, (term.rows / 2) | 0);
      while (accum >= STEP) {
        sendInput(`\x1b[<64;${col};${row}M`);
        accum -= STEP;
      }
      while (accum <= -STEP) {
        sendInput(`\x1b[<65;${col};${row}M`);
        accum += STEP;
      }
      e.preventDefault(); // prevents viewport bounce
    };

    host.addEventListener('touchstart', onTouchStart, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      host.removeEventListener('touchstart', onTouchStart);
      host.removeEventListener('touchmove', onTouchMove);
      resizeObserver.disconnect();
      dataSub.dispose();
      ws.close();
      term.dispose();
    };
  }, [session, onAuthError]);

  // The control bar sends directly and returns focus to the terminal.
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
          ‹ Sessions
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
