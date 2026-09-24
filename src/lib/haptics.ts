/**
 * Short vibrations for game moments. Uses the native Haptics plugin inside the
 * Capacitor apps (iOS has no navigator.vibrate) and the Vibration API on the web.
 * Silently does nothing where neither exists.
 */
type Impact = 'light' | 'medium' | 'heavy';

interface CapHaptics { impact: (o: { style: string }) => Promise<void>; vibrate: (o: { duration: number }) => Promise<void> }

function nativeHaptics(): CapHaptics | null {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Haptics?: CapHaptics } } }).Capacitor;
  return cap?.isNativePlatform?.() ? cap.Plugins?.Haptics ?? null : null;
}

const WEB_MS: Record<Impact, number | number[]> = { light: 15, medium: 35, heavy: [50, 30, 50] };
const NATIVE_STYLE: Record<Impact, string> = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };

export function buzz(kind: Impact): void {
  try {
    const native = nativeHaptics();
    if (native) { void native.impact({ style: NATIVE_STYLE[kind] }); return; }
    navigator.vibrate?.(WEB_MS[kind]);
  } catch { /* no haptics here */ }
}
