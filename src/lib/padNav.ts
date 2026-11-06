/**
 * Menus with a controller. The D-pad or left stick moves focus to the nearest button in that
 * direction, A presses it and B goes back. In a match the pad drives the dino instead
 * (gamepadInput.ts) until the in-game menu opens.
 *
 * Pages can mark:
 * - `data-pad-autofocus`: where focus starts (otherwise the first button)
 * - `data-pad-scope`: a menu that keeps focus inside it while it's open
 * - `data-pad-back`: the button B presses (B does nothing on a page without one)
 * - `data-pad-check`: a panel that tests the pad's buttons, where B only lights its row
 */
import { firstPad, readMenuPad, type MenuPadState, type PadDir } from '@/lib/gamepadInput';

const FOCUSABLE = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';
/** Holding a direction moves once, again after REPEAT_DELAY_MS, then every REPEAT_MS. */
const REPEAT_DELAY_MS = 380;
const REPEAT_MS = 140;
const IDLE: MenuPadState = { dir: null, confirm: false, back: false };

function usable(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled || el.closest('[aria-hidden="true"], [inert]')) return false;
  return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}

function itemsIn(scope: HTMLElement): HTMLElement[] {
  return Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(usable);
}

/**
 * The newest open menu or dialog, else the page. In a match with no menu open, nothing.
 * Newest by when we first saw it: a menu reopened while the old one is still fading out
 * means two in the page for a moment, and the fading one may come later in it.
 */
function currentScope(inMatch: boolean, seen: WeakMap<HTMLElement, number>, now: number): HTMLElement | null {
  let newest: HTMLElement | null = null;
  for (const el of document.querySelectorAll<HTMLElement>('[data-pad-scope], [role="dialog"][aria-modal="true"]')) {
    if (!el.getClientRects().length) continue;
    if (!seen.has(el)) seen.set(el, now);
    if (!newest || seen.get(el)! >= seen.get(newest)!) newest = el;
  }
  return newest ?? (inMatch ? null : document.body);
}

/** A was pressed on a text field: it already has focus, and typing needs a keyboard. */
function isTextEntry(el: HTMLElement): boolean {
  if (el instanceof HTMLTextAreaElement || el.isContentEditable) return true;
  return el instanceof HTMLInputElement && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'].includes(el.type);
}

function focusOn(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/**
 * The closest item that way, edge to edge: the gap ahead, plus double any sideways gap (none
 * when the two overlap side-on), plus a little for how far off-centre it sits. Centre to
 * centre alone sent Down from Play to the small footer link under it, past the button row.
 */
function nearest(from: HTMLElement, items: HTMLElement[], dir: PadDir): HTMLElement | null {
  const a = from.getBoundingClientRect();
  const vertical = dir === 'up' || dir === 'down';
  const sign = dir === 'down' || dir === 'right' ? 1 : -1;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const dx = (b.left + b.right - a.left - a.right) / 2;
    const dy = (b.top + b.bottom - a.top - a.bottom) / 2;
    if (sign * (vertical ? dy : dx) < 4) continue;
    const gap = vertical
      ? (sign > 0 ? b.top - a.bottom : a.top - b.bottom)
      : (sign > 0 ? b.left - a.right : a.left - b.right);
    const side = vertical
      ? Math.max(a.left, b.left) - Math.min(a.right, b.right)
      : Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
    const score = Math.max(0, gap) + 2 * Math.max(0, side) + 0.1 * Math.abs(vertical ? dx : dy);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * Read the first controller for the menus until the returned stop function is called.
 * `inMatch` says whether a match is on screen, where the pad steers unless a menu is open.
 */
export function startPadNav(inMatch: () => boolean): () => void {
  let raf = 0;
  let prev = IDLE;
  let repeatAt = 0;
  let lastScope: HTMLElement | null = null;
  const seen = new WeakMap<HTMLElement, number>();
  // Focus is only drawn while the pad is in use; a click, a tap or a key hides it again.
  let active = false;
  const setActive = (on: boolean) => {
    active = on;
    document.documentElement.toggleAttribute('data-pad-nav', on);
  };
  const handBack = () => { if (active) setActive(false); };
  window.addEventListener('pointerdown', handBack, true);
  window.addEventListener('keydown', handBack, true);

  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const pad = firstPad();
    const now = pad ? readMenuPad(pad) : IDLE;
    const turned = now.dir !== null && now.dir !== prev.dir;
    const held = now.dir !== null && now.dir === prev.dir && t >= repeatAt;
    const pressed = now.confirm && !prev.confirm;
    const backed = now.back && !prev.back;
    prev = now;

    const scope = currentScope(inMatch(), seen, t);
    // A menu that just opened (Start in a match, say) is ready to drive straight away.
    const opened = scope !== null && scope !== document.body && scope !== lastScope;
    lastScope = scope;
    if (!scope) return;
    if (opened && !active) setActive(true);
    const at = document.activeElement;
    const inScope = at instanceof HTMLElement && at !== document.body && scope.contains(at) ? at : null;
    // Nothing to do: the pad is idle, or it's in use and focus is already in place.
    if (!turned && !held && !pressed && !backed && (!active || inScope)) return;

    const items = itemsIn(scope);
    const focused = inScope && items.includes(inScope) ? inScope : null;
    const start = () => {
      const first = items.find((el) => el.hasAttribute('data-pad-autofocus')) ?? items[0];
      if (first) focusOn(first);
    };

    if (!active) {
      // The first press only shows where focus is; B still goes back.
      setActive(true);
      if (!focused) start();
      if (turned) repeatAt = t + REPEAT_DELAY_MS;
      if (!backed) return;
    } else if (!focused) {
      // A new page, or a menu that just opened, starts on its first item.
      start();
      if (turned) repeatAt = t + REPEAT_DELAY_MS;
      return;
    }

    if (focused && now.dir && (turned || held)) {
      const next = nearest(focused, items, now.dir);
      if (next) focusOn(next);
      repeatAt = t + (turned ? REPEAT_DELAY_MS : REPEAT_MS);
    }
    if (focused && pressed && !isTextEntry(focused)) focused.click();
    // In a match B closes the menu (gamepadInput.ts); on a pad check it only lights its row.
    if (backed && !inMatch() && !scope.querySelector('[data-pad-check]')) {
      Array.from(scope.querySelectorAll<HTMLElement>('[data-pad-back]')).find(usable)?.click();
    }
  };

  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('pointerdown', handBack, true);
    window.removeEventListener('keydown', handBack, true);
    setActive(false);
  };
}
