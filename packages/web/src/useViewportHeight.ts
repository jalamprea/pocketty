import { useEffect } from 'react';

/**
 * Syncs the TRULY visible height with the CSS variables `--app-height` and
 * `--app-top`.
 *
 * On iOS, when the keyboard opens, the layout viewport (`100%` / `100vh` /
 * `100dvh`) does NOT shrink: Safari shifts the content up and leaves the
 * keyboard floating on top, covering the bottom bar. The only source of truth
 * for the visible area is the Visual Viewport API:
 *   - `visualViewport.height`   → visible height (screen minus keyboard).
 *   - `visualViewport.offsetTop` → how much Safari panned; we compensate so a
 *     `position: fixed; top: var(--app-top)` container follows the viewport.
 *
 * Applied at the document level (once, in App) because it's a global concern;
 * each view decides whether to consume the variables.
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

    // `resize` covers keyboard/rotation; `scroll` covers iOS panning.
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
