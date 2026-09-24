import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Registers the service worker and, when a new version has downloaded, offers a reload.
 * Never during a match: the prompt waits until the player is back in the menus.
 * Only rendered on the web; the native apps ship their files and have no worker.
 */
export function UpdatePrompt() {
  const location = useLocation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (err) => console.warn('[pwa] service worker registration failed', err),
  });

  if (!needRefresh || location.pathname === '/game') return null;

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
