/**
 * Botonera para teclas que el teclado del móvil no tiene, imprescindibles para
 * navegar TUIs como `claude --resume` (flechas, Enter, Esc, Tab, Ctrl).
 */
interface Props {
  send: (data: string) => void;
  ctrlActive: boolean;
  onToggleCtrl: () => void;
}

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
  return (
    <div className="controlbar">
      <button
        className={ctrlActive ? 'key active' : 'key'}
        onClick={onToggleCtrl}
        title="Próxima tecla como Ctrl+_"
      >
        Ctrl
      </button>
      <button className="key" onClick={() => send(KEYS.esc)}>
        Esc
      </button>
      <button className="key" onClick={() => send(KEYS.tab)}>
        Tab
      </button>
      <button className="key" onClick={() => send(KEYS.left)}>
        ←
      </button>
      <button className="key" onClick={() => send(KEYS.up)}>
        ↑
      </button>
      <button className="key" onClick={() => send(KEYS.down)}>
        ↓
      </button>
      <button className="key" onClick={() => send(KEYS.right)}>
        →
      </button>
      <button className="key wide" onClick={() => send(KEYS.enter)}>
        Enter
      </button>
    </div>
  );
}
