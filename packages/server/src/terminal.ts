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
 * Connects a WebSocket to a tmux session through a PTY.
 *
 * `tmux new-session -A -s <name>` attaches if the session exists or creates it if not,
 * covering "new or existing" without extra logic. When the socket closes the session
 * is NOT killed: tmux keeps it alive (detached) so it can be resumed.
 */
export function attachTerminal(socket: WebSocket, sessionName: string): void {
  // `-c` only applies if this call CREATES the session (it did not exist yet); when
  // attaching to an existing one, tmux ignores it.
  const args = ['new-session', '-A', '-s', sessionName];
  if (config.startDir) args.push('-c', config.startDir);

  const term = pty.spawn('tmux', args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: config.startDir ?? config.home,
    env: { ...process.env, HOME: config.home, TERM: 'xterm-256color' },
  });

  // By the first frame the tmux server is already running: we enable mouse mode
  // once so the wheel/touch scroll scroll the history.
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
        /* the client may send invalid sizes during layout */
      }
    }
  });

  socket.on('close', () => {
    onData.dispose();
    onExit.dispose();
    // Disconnects the tmux client (detach), but leaves the session alive.
    term.kill();
  });
}
