/**
 * Touch controls write here and the game scene reads it every frame.
 *
 * The joystick used to go through React state and then fake WASD key events, which cost
 * a render (a frame or two) on every thumb movement and flattened the stick to eight
 * directions at full speed. Writing straight into this object gives the scene the exact
 * angle and deflection on the next frame.
 */
export const touchInput = {
  /** Stick deflection, -1..1 on each axis, length at most 1. */
  x: 0,
  y: 0,
  /** performance.now() of the last power tap, 0 when none is waiting. */
  powerAt: 0,
};

export function setStick(x: number, y: number) {
  touchInput.x = x;
  touchInput.y = y;
}

export function pressPower() {
  touchInput.powerAt = performance.now();
}

export function resetTouchInput() {
  touchInput.x = 0;
  touchInput.y = 0;
  touchInput.powerAt = 0;
}
