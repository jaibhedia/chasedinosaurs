/**
 * Xbox (and any standard-mapping) controller support for the PC build.
 *
 * The pad is polled once a frame and written into the same channel as the touch controls
 * (touchInput), so the scene needs no gamepad code of its own: the left stick or D-pad is
 * the stick, A / RB / RT is the power button (hold-to-fire works the same way), Start
 * opens the menu and B closes it. The menus themselves, in a match and out of one, are
 * driven by padNav.ts.
 */
import { useGameStore } from '@/store/gameStore';
import { pressPower, releasePower, setStick } from '@/lib/touchInput';

/** Stick travel ignored around the centre, so a worn stick doesn't drift the dino. */
const DEADZONE = 0.2;
// Standard mapping: https://w3c.github.io/gamepad/#remapping
const A = 0, B = 1, RB = 5, RT = 7, START = 9, UP = 12, DOWN = 13, LEFT = 14, RIGHT = 15;

/** What the game takes from a pad in one frame. */
export interface PadState {
  /** Stick deflection, -1..1 on each axis, length at most 1. */
  x: number;
  y: number;
  power: boolean;
  menu: boolean;
  back: boolean;
}

const IDLE: PadState = { x: 0, y: 0, power: false, menu: false, back: false };

function isDown(pad: Gamepad, i: number): boolean {
  const b = pad.buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
}

/** The first connected controller, or null. */
export function firstPad(): Gamepad | null {
  return Array.from(navigator.getGamepads?.() ?? []).find((p): p is Gamepad => !!p?.connected) ?? null;
}

/**
 * Reads a pad the way the game does. The controls screen uses it too, so what lights up
 * there is exactly what a match would get.
 */
export function readPad(pad: Gamepad): PadState {
  let x = 0;
  let y = 0;
  const dx = (isDown(pad, RIGHT) ? 1 : 0) - (isDown(pad, LEFT) ? 1 : 0);
  const dy = (isDown(pad, DOWN) ? 1 : 0) - (isDown(pad, UP) ? 1 : 0);
  if (dx || dy) {
    const m = Math.hypot(dx, dy);
    x = dx / m;
    y = dy / m;
  } else {
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const m = Math.min(1, Math.hypot(ax, ay));
    if (m > DEADZONE) {
      // Rescale past the deadzone so a light push still walks (the scene's throttle curve).
      const k = (m - DEADZONE) / (1 - DEADZONE) / Math.hypot(ax, ay);
      x = ax * k;
      y = ay * k;
    }
  }
  return {
    x,
    y,
    power: isDown(pad, A) || isDown(pad, RB) || isDown(pad, RT),
    menu: isDown(pad, START),
    back: isDown(pad, B),
  };
}

export type PadDir = 'up' | 'down' | 'left' | 'right';

/** What the menus take from a pad in one frame (see padNav.ts). */
export interface MenuPadState {
  /** The D-pad, or the stick pushed past half-way. */
  dir: PadDir | null;
  /** A presses the focused button. */
  confirm: boolean;
  back: boolean;
}

export function readMenuPad(pad: Gamepad): MenuPadState {
  const { x, y, back } = readPad(pad);
  let dir: PadDir | null = null;
  if (Math.max(Math.abs(x), Math.abs(y)) > 0.5) {
    dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
  }
  return { dir, confirm: isDown(pad, A), back };
}

/** Start polling the first connected controller. Returns a stop function. */
export function startGamepad(): () => void {
  let raf = 0;
  // We wrote a non-zero stick last frame, so we owe it a zero when the pad goes idle.
  // While idle we write nothing, which leaves the touch stick alone on touch screens.
  let steering = false;
  // We pressed power and owe it a release.
  let firing = false;
  let wasPaused = false;
  let prev = IDLE;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const pad = firstPad();
    if (!pad) return;

    const now = readPad(pad);
    const store = useGameStore.getState();
    // While the menu is open the pad moves through it (padNav.ts), so the dino stands still.
    if ((now.x || now.y) && !store.paused) {
      setStick(now.x, now.y);
      steering = true;
    } else if (steering) {
      setStick(0, 0);
      steering = false;
    }

    // Only a fresh press with the menu shut fires: the A that picked "Resume" doesn't.
    if (now.power && !prev.power && !store.paused && !wasPaused) {
      pressPower();
      firing = true;
    } else if (firing && (!now.power || store.paused)) {
      releasePower();
      firing = false;
    }
    if (now.menu && !prev.menu) store.setPaused(!store.paused);
    if (now.back && !prev.back && store.paused) store.setPaused(false);
    wasPaused = store.paused;
    prev = now;
  };

  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    if (steering) setStick(0, 0);
    if (firing) releasePower();
  };
}
