import * as pty from 'node-pty';
import type { WebSocket } from 'ws';
import { config } from './config.js';
import { enableMouse } from './tmux.js';

interface ClientMessage {
  type: 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

/**
 * Conecta un WebSocket a una sesión tmux mediante un PTY.
 *
 * `tmux new-session -A -s <name>` adjunta si la sesión existe o la crea si no,
 * cubriendo "nueva o existente" sin lógica extra. Al cerrarse el socket NO se
 * mata la sesión: tmux la mantiene viva (detached) para poder retomarla.
 */
export function attachTerminal(socket: WebSocket, sessionName: string): void {
  // `-c` solo aplica si esta llamada CREA la sesión (no existía aún); al
  // adjuntarse a una existente, tmux lo ignora.
  const args = ['new-session', '-A', '-s', sessionName];
  if (config.startDir) args.push('-c', config.startDir);

  const term = pty.spawn('tmux', args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: config.startDir ?? config.home,
    env: { ...process.env, HOME: config.home, TERM: 'xterm-256color' },
  });

  // Al primer frame el servidor tmux ya está corriendo: activamos el mouse mode
  // una sola vez para que la rueda/scroll táctil scrolleen el historial.
  let mouseEnabled = false;
  const onData = term.onData((data) => {
    if (!mouseEnabled) {
      mouseEnabled = true;
      void enableMouse();
    }
    if (socket.readyState === socket.OPEN) {
      socket.send(data);
    }
  });

  const onExit = term.onExit(() => {
    if (socket.readyState === socket.OPEN) {
      socket.close();
    }
  });

  socket.on('message', (raw: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.type === 'input' && typeof msg.data === 'string') {
      term.write(msg.data);
    } else if (msg.type === 'resize' && msg.cols && msg.rows) {
      try {
        term.resize(Math.max(1, msg.cols | 0), Math.max(1, msg.rows | 0));
      } catch {
        /* el cliente puede mandar tamaños inválidos durante el layout */
      }
    }
  });

  socket.on('close', () => {
    onData.dispose();
    onExit.dispose();
    // Desconecta el cliente tmux (detach), pero deja la sesión viva.
    term.kill();
  });
}
