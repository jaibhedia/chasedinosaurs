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

export function buzz(kind: Impact): void {
  try {
    if (Capacitor.isNativePlatform()) { void Haptics.impact({ style: NATIVE_STYLE[kind] }); return; }
    navigator.vibrate?.(WEB_MS[kind]);
  } catch { /* no haptics here */ }
}
