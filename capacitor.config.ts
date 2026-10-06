import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native iOS/Android shells around the web build in dist/.
 *
 * appId is the store bundle id and can never change once published. It's derived from
 * the game's domain; confirm it before the first upload.
 */
const config: CapacitorConfig = {
  appId: 'xyz.chasedinosaurs.app',
  appName: 'Chase Dinosaurs',
  webDir: 'dist',
  android: {
    // Serve from https://localhost so the app is a secure context (WebRTC for voice).
    // The multiplayer server's CORS_ORIGIN must include https://localhost.
  },
  ios: {
    // Served from capacitor://localhost; add it to the server's CORS_ORIGIN.
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 700,
      backgroundColor: '#14141f',
      showSpinner: false,
    },
  },
};

export default config;
