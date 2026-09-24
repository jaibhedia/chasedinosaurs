/**
 * Where the multiplayer server lives.
 *
 * Resolved at runtime, in this order:
 *
 *  1. `?server=https://…` in the page URL. Remembered in localStorage, so a tester can
 *     point one device at a staging server without a rebuild. `?server=` (empty) clears it.
 *  2. `VITE_SOCKET_URL`, inlined at build time. Set it in the host's build env.
 *  3. Running on localhost → the local dev server on :3001.
 *  4. The production server.
 *
 * Step 4 exists because the old build fell through to `localhost:3001` whenever the env
 * var was missing at build time, which shipped a site whose lobby silently dialled the
 * player's own machine. A wrong-but-real server is a much easier failure to notice.
 *
 * The native apps load from capacitor://localhost (iOS) or https://localhost (Android),
 * so they must never take the localhost branch — they always get 2 or 4.
 */
import { Capacitor } from '@capacitor/core';

const PRODUCTION_SOCKET_URL = 'https://chase-dinosaurs-4qb2.onrender.com';
const OVERRIDE_KEY = 'chase-server-override';

function isNativeShell(): boolean {
  return window.location.protocol === 'capacitor:' || Capacitor.isNativePlatform();
}

export function resolveSocketUrl(): string {
  try {
    const param = new URLSearchParams(window.location.search).get('server');
    if (param !== null) {
      if (param) localStorage.setItem(OVERRIDE_KEY, param);
      else localStorage.removeItem(OVERRIDE_KEY);
    }
    const saved = localStorage.getItem(OVERRIDE_KEY);
    if (saved) return saved;
  } catch { /* storage blocked — fall through */ }

  const fromBuild = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (fromBuild) return fromBuild;

  const host = window.location.hostname;
  if (!isNativeShell() && (host === 'localhost' || host === '127.0.0.1')) {
    return `http://${host}:3001`;
  }
  return PRODUCTION_SOCKET_URL;
}

export const SITE = {
  name: 'Chase Dinosaurs',
  studio: 'Abstract Studio',
  url: 'https://chasedinosaurs.fun',
  socials: {
    x: 'https://x.com/ShantanuSwami11',
    telegram: 'https://t.me/shantanucsd',
  },
} as const;
