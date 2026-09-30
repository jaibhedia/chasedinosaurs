/**
 * Native-shell setup (Capacitor iOS/Android). A no-op on the web.
 *
 * - locks the game to landscape and hides the status bar
 * - Android back button: pause during a match, go back in the menus, leave from home
 * - tells the app when it returns to the foreground so the socket can be checked
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { useGameStore } from '@/store/gameStore';

export const RESUME_EVENT = 'chase:resume';

export async function initNative(navigateBack: () => void): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try { await ScreenOrientation.lock({ orientation: 'landscape' }); } catch { /* older OS */ }
  try { await StatusBar.hide(); } catch { /* not available */ }

  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) window.dispatchEvent(new Event(RESUME_EVENT));
  });

  void App.addListener('backButton', () => {
    const path = window.location.pathname;
    if (path === '/game') {
      // Never drop out of a match by accident: open the pause menu instead.
      const store = useGameStore.getState();
      store.setPaused(!store.paused);
    } else if (path === '/' || path === '') {
      void App.exitApp();
    } else {
      navigateBack();
    }
  });

  try { await SplashScreen.hide(); } catch { /* already hidden */ }
}
