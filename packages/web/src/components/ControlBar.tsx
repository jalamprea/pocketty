import type { MouseEvent } from 'react';

/**
 * Control bar for keys the mobile keyboard lacks, essential for navigating TUIs
 * like `claude --resume` (arrows, Enter, Esc, Tab, Ctrl).
 */
interface Props {
  send: (data: string) => void;
  ctrlActive: boolean;
  onToggleCtrl: () => void;
}

/**
 * Prevents the button from stealing focus from the terminal. Without this,
 * tapping a button makes xterm's textarea lose focus and the mobile keyboard
 * closes; the `onClick` still fires. This is the standard toolbar pattern.
 */
const keepFocus = (e: MouseEvent) => e.preventDefault();

const KEYS = {
  esc: '\x1b',
  tab: '\t',
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',
  enter: '\r',
};

export function ControlBar({ send, ctrlActive, onToggleCtrl }: Props) {
  // Ordered by usage frequency (most to least): Tab, Enter, arrows, Esc, Ctrl.
  return (
    <div className="controlbar">
      <button className="key" onMouseDown={keepFocus} onClick={() => send(KEYS.tab)}>
        Tab
      </button>
      <button className="key" onMouseDown={keepFocus} onClick={() => send(KEYS.enter)}>
        Enter
      </button>
      <button className="key" onMouseDown={keepFocus} onClick={() => send(KEYS.left)}>
        ←
      </button>
      <button className="key" onMouseDown={keepFocus} onClick={() => send(KEYS.up)}>
        ↑
      </button>
      <button className="key" onMouseDown={keepFocus} onClick={() => send(KEYS.down)}>
        ↓
      </button>
      <button className="key" onMouseDown={keepFocus} onClick={() => send(KEYS.right)}>
        →
      </button>
      <button className="key" onMouseDown={keepFocus} onClick={() => send(KEYS.esc)}>
        Esc
      </button>
      <button
        className={ctrlActive ? 'key active' : 'key'}
        onMouseDown={keepFocus}
        onClick={onToggleCtrl}
        title="Next key as Ctrl+_"
      >
        Ctrl
      </button>
    </div>
  );
}
