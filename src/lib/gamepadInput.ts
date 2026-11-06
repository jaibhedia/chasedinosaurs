/**
 * Xbox (and any standard-mapping) controller support for the PC build.
 *
 * The pad is polled once a frame and written into the same channel as the touch controls
 * (touchInput), so the scene needs no gamepad code of its own: the left stick or D-pad is
 * the stick, A / RB / RT is the power button (hold-to-fire works the same way), Start
 * opens the menu and B closes it.
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

/** Start polling the first connected controller. Returns a stop function. */
export function startGamepad(): () => void {
  let raf = 0;
  // We wrote a non-zero stick last frame, so we owe it a zero when the pad goes idle.
  // While idle we write nothing, which leaves the touch stick alone on touch screens.
  let steering = false;
  let prev = IDLE;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const pad = firstPad();
    if (!pad) return;

    const now = readPad(pad);
    if (now.x || now.y) {
      setStick(now.x, now.y);
      steering = true;
    } else if (steering) {
      setStick(0, 0);
      steering = false;
    }

    if (now.power && !prev.power) pressPower();
    if (!now.power && prev.power) releasePower();
    const store = useGameStore.getState();
    if (now.menu && !prev.menu) store.setPaused(!store.paused);
    if (now.back && !prev.back && store.paused) store.setPaused(false);
    prev = now;
  };

  raf = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(raf);
    if (steering) setStick(0, 0);
    if (prev.power) releasePower();
  };
}
