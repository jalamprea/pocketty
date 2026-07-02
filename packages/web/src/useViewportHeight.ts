import { useEffect } from 'react';

/**
 * Exposes the visible-area height as `--app-height` / `--app-top` ONLY while the
 * on-screen keyboard is open.
 *
 * On iOS the layout viewport (`100%` / `100vh` / `100dvh`) does not shrink when
 * the keyboard opens: Safari shifts the content up and floats the keyboard over
 * the bottom bar. So while the keyboard is up we drive the height from the
 * Visual Viewport API:
 *   - `visualViewport.height`   → visible height (screen minus keyboard).
 *   - `visualViewport.offsetTop` → how much Safari panned; we compensate so a
 *     `position: fixed; top: var(--app-top)` container follows the viewport.
 *
 * When the keyboard is CLOSED we remove the variables and let CSS `100dvh` own
 * the height. In standalone PWAs `visualViewport.height` can under-report at
 * launch (a transient measurement, with no later `resize` to correct it), which
 * left a large gap at the bottom. `100dvh` is reliable there, so we only reach
 * for the Visual Viewport while it actually matters — the keyboard being open.
 */
export function useViewportHeight() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // Without the API, the CSS `100dvh` fallback covers everything.
    const root = document.documentElement;

    function apply() {
      // Keyboard heuristic: the visible viewport is clearly shorter than the
      // full window. A ratio (not an absolute px gap) avoids mistaking a small
      // standalone under-report for an open keyboard.
      const keyboardOpen = vv!.height < window.innerHeight * 0.75;
      if (keyboardOpen) {
        root.style.setProperty('--app-height', `${vv!.height}px`);
        root.style.setProperty('--app-top', `${vv!.offsetTop}px`);
      } else {
        root.style.removeProperty('--app-height');
        root.style.removeProperty('--app-top');
      }
    }

    apply();

    // `resize` covers keyboard/rotation; `scroll` covers iOS panning.
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', apply);

    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);
}
