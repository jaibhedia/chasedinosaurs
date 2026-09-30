import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Screens where reloading costs the player nothing, so a new version is applied as soon
 * as it has downloaded. Asking first here meant testers and returning players kept
 * running an old build: the offer only showed outside a match, and a plain refresh
 * never swaps in a waiting service worker.
 */
const CALM = new Set(['/', '/play', '/solo', '/support', '/privacy', '/terms']);

/** How often a tab left open checks for a new version. */
const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and keeps the game up to date. On calm screens a new
 * version is applied straight away; in a lobby or on the results screen it asks first;
 * during a match it waits. Only rendered on the web; the native apps ship their files
 * and have no worker.
 */
export function UpdatePrompt() {
  const location = useLocation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration) setInterval(() => void registration.update().catch(() => {}), CHECK_EVERY_MS);
    },
    onRegisterError: (err) => console.warn('[pwa] service worker registration failed', err),
  });

  const calm = CALM.has(location.pathname);

  useEffect(() => {
    if (needRefresh && calm) void updateServiceWorker(true);
  }, [needRefresh, calm, updateServiceWorker]);

  if (!needRefresh || calm || location.pathname === '/game') return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[120] px-panel flex items-center gap-3 px-3 py-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      role="status"
    >
      <span className="text-[#f4e7c3]">A new version is ready.</span>
      <button className="pixel-button px-3 py-1 text-xs" onClick={() => updateServiceWorker(true)}>
        Update
      </button>
      <button className="text-[#f4e7c3]/60 text-sm" onClick={() => setNeedRefresh(false)} aria-label="Dismiss">
        Later
      </button>
    </div>
  );
}
