import { useEffect, useState } from 'react';

/**
 * Single source of truth for "is this a touch device" across the in-game HUD + controls.
 * Previously GameHUD and MobileControls computed this differently (GameHUD added a UA
 * check, MobileControls didn't), so on phones/tablets + the devtools device emulator they
 * disagreed — rendering the desktop HUD AND the touch controls at once (overlaps, a
 * doubled power-up). One hook = one answer everywhere.
 *
 * Counts as touch when the primary pointer is coarse (real phones and iPads, incl. iPads
 * that UA-report as "Macintosh"), or when a mobile UA also reports touch points (Chrome's
 * device emulator, which doesn't always flip `pointer: coarse`).
 *
 * Re-checked live on every change. It used to lean on `'ontouchstart' in window` and the UA
 * alone, which the devtools emulator switches on but doesn't switch back until a reload,
 * so going phone -> desktop left the touch controls up. `pointer`/`hover` media queries
 * and `maxTouchPoints` follow the emulator both ways.
 */
function detect(): boolean {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const uaMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return coarse || (uaMobile && touchPoints > 0);
}

export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(detect);

  useEffect(() => {
    const check = () => setIsTouch(detect());
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    const queries = ['(pointer: coarse)', '(hover: none)', '(any-pointer: coarse)']
      .map((q) => window.matchMedia?.(q))
      .filter((m): m is MediaQueryList => !!m);
    queries.forEach((m) => m.addEventListener?.('change', check));
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
      queries.forEach((m) => m.removeEventListener?.('change', check));
    };
  }, []);

  return isTouch;
}
