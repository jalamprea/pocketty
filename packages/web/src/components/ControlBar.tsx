import type { MouseEvent } from 'react';

/**
 * Botonera para teclas que el teclado del móvil no tiene, imprescindibles para
 * navegar TUIs como `claude --resume` (flechas, Enter, Esc, Tab, Ctrl).
 */
interface Props {
  send: (data: string) => void;
  ctrlActive: boolean;
  onToggleCtrl: () => void;
}

/**
 * Evita que el botón robe el foco del terminal. Sin esto, al tocar un botón el
 * textarea de xterm pierde el foco y el teclado del móvil se cierra; el `onClick`
 * igual se dispara. Es el patrón estándar de las barras de herramientas.
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
  // Orden por frecuencia de uso (de más a menos): Tab, Enter, flechas, Esc, Ctrl.
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
        title="Próxima tecla como Ctrl+_"
      >
        Ctrl
      </button>
    </div>
  );
}
