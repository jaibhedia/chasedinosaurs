/**
 * Where the multiplayer server lives.
 *
 * Resolved at runtime, in this order:
 *
 *  1. `?server=https://…` in the page URL, on localhost and Vercel previews only (see
 *     overrideAllowed). Remembered in localStorage, so a tester can point one device at a
 *     staging server without a rebuild. `?server=` (empty) clears it.
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

/**
 * `?server=` is a testing aid, so it's honoured only where testers are: local dev and
 * Vercel preview deployments. On the real site and in the store apps it's ignored and
 * any saved override is wiped, so a crafted link can't point a player's game (and
 * their player id) at someone else's server.
 */
function overrideAllowed(): boolean {
  if (isNativeShell()) return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app');
}

function validServerUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
}

export function resolveSocketUrl(): string {
  try {
    if (overrideAllowed()) {
      const param = new URLSearchParams(window.location.search).get('server');
      if (param !== null) {
        const url = param ? validServerUrl(param) : null;
        if (url) localStorage.setItem(OVERRIDE_KEY, url);
        else localStorage.removeItem(OVERRIDE_KEY);
      }
      const saved = localStorage.getItem(OVERRIDE_KEY);
      if (saved) return saved;
    } else {
      localStorage.removeItem(OVERRIDE_KEY);
    }
  } catch { /* storage blocked — fall through */ }

  // Tolerate a pasted value with a trailing comma, space or slash (or a comma list, as in
  // CORS_ORIGIN): "https://x.onrender.com," once shipped as "wss://x.onrender.com,/socket.io".
  const rawBuild = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? '';
  const fromBuild = validServerUrl(rawBuild.split(',')[0].trim());
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
  studioUrl: 'https://abstractstudio.in',
  url: 'https://chasedinosaurs.fun',
  socials: {
    x: 'https://x.com/ShantanuSwami11',
    telegram: 'https://t.me/shantanucsd',
  },
  /** Donations. Shown on /support, on the web only (see Support.tsx). */
  donate: {
    evm: '0x0418d786f44F625b2Ee5fc9E68c4D396dfD4141d',
  },
} as const;
