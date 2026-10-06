import { isNativeApp } from '@/lib/platform';

/**
 * Phones go fullscreen on their own: on the first tap (browsers only allow it in answer
 * to a tap), and again on a later tap if the player left fullscreen, since this is a
 * landscape game that wants the whole screen. Fullscreen also lets Android lock the
 * orientation to landscape.
 *
 * Installed apps too: the manifest asks for fullscreen, but an app installed as a plain
 * home-screen shortcut, by a browser that doesn't do fullscreen apps, or from an older
 * manifest opens as an ordinary window with the status and navigation bars showing. It
 * used to skip every installed app, so exactly those stayed windowed. Only an app that
 * really is fullscreen already (display-mode: fullscreen) is left alone.
 *
 * Not used in the store apps (native fullscreen) or on desktops. iPhone Safari has no
 * fullscreen API for pages, so there the feature check simply finds nothing to call.
 */
function isTouchPhoneOrTablet(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false;
}

function inFullscreen(): boolean {
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return !!(document.fullscreenElement || d.webkitFullscreenElement)
    || (window.matchMedia?.('(display-mode: fullscreen)').matches ?? false);
}

async function enterFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return;
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.('landscape').catch(() => undefined);
  } catch {
    // Refused (no user activation, or the browser said no): try again on the next tap.
  }
}

export function initAutoFullscreen() {
  if (isNativeApp()) return;
  const onTap = () => {
    if (!isTouchPhoneOrTablet() || inFullscreen()) return;
    void enterFullscreen();
  };
  // pointerup, not pointerdown: browsers grant fullscreen on the end of a tap.
  document.addEventListener('pointerup', onTap, { capture: true, passive: true });
}
