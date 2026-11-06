/**
 * Short vibrations for game moments: the native Haptics engine inside the Capacitor
 * apps, the Vibration API on the web (Android browsers). iOS Safari has neither on the
 * web, so it's silent there.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

type Impact = 'light' | 'medium' | 'heavy';

const WEB_MS: Record<Impact, number | number[]> = { light: 15, medium: 35, heavy: [50, 30, 50] };
const NATIVE_STYLE: Record<Impact, ImpactStyle> = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
/** Controller rumble: [duration ms, strength 0..1]. */
const PAD_RUMBLE: Record<Impact, [number, number]> = { light: [60, 0.3], medium: [120, 0.6], heavy: [220, 1] };

type Rumbler = { playEffect?: (type: string, params: object) => Promise<unknown> };

/** A connected controller rumbles on the same moments (Chrome and Edge support it). */
function rumble(kind: Impact): void {
  const [duration, strength] = PAD_RUMBLE[kind];
  for (const pad of navigator.getGamepads?.() ?? []) {
    const actuator = (pad as (Gamepad & { vibrationActuator?: Rumbler }) | null)?.vibrationActuator;
    actuator?.playEffect?.('dual-rumble', { duration, strongMagnitude: strength, weakMagnitude: strength })?.catch(() => {});
  }
}

export function buzz(kind: Impact): void {
  try {
    rumble(kind);
    if (Capacitor.isNativePlatform()) { void Haptics.impact({ style: NATIVE_STYLE[kind] }); return; }
    navigator.vibrate?.(WEB_MS[kind]);
  } catch { /* no haptics here */ }
}
