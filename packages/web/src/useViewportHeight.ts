import { useEffect } from 'react';

/**
 * Sincroniza el alto REALMENTE visible con las variables CSS `--app-height` y
 * `--app-top`.
 *
 * En iOS, al abrir el teclado, el layout viewport (`100%` / `100vh` / `100dvh`)
 * NO se encoge: Safari desplaza el contenido hacia arriba y deja el teclado
 * flotando encima, tapando la barra inferior. La única fuente de verdad del
 * área visible es la Visual Viewport API:
 *   - `visualViewport.height`   → alto visible (pantalla menos teclado).
 *   - `visualViewport.offsetTop` → cuánto paneó Safari; lo compensamos para
 *     que un contenedor `position: fixed; top: var(--app-top)` siga al viewport.
 *
 * Se aplica a nivel de documento (una sola vez, en App) porque es una
 * preocupación global; cada vista decide si consume las variables.
 */
export function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;

    function apply() {
      const height = vv ? vv.height : window.innerHeight;
      const top = vv ? vv.offsetTop : 0;
      root.style.setProperty('--app-height', `${height}px`);
      root.style.setProperty('--app-top', `${top}px`);
    }

    apply();

    // `resize` cubre teclado/rotación; `scroll` cubre el paneo de iOS.
    vv?.addEventListener('resize', apply);
    vv?.addEventListener('scroll', apply);
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);

    return () => {
      vv?.removeEventListener('resize', apply);
      vv?.removeEventListener('scroll', apply);
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
}
