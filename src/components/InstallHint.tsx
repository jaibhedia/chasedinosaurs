import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { canPromptInstall, isIOS, isNativeApp, isStandalone, onInstallAvailabilityChange, promptInstall } from '@/lib/platform';

const IOS_DISMISSED = 'chase-ios-install-dismissed';

/**
 * "Install the app" on the home screen. Chrome and Android give us a real install
 * prompt; iOS Safari has none, so it gets a one-time how-to that can be dismissed.
 * Hidden when already installed and inside the native apps.
 */
export function InstallHint() {
  const [, force] = useState(0);
  const [iosDismissed, setIosDismissed] = useState(() => {
    try { return localStorage.getItem(IOS_DISMISSED) === '1'; } catch { return true; }
  });

  useEffect(() => onInstallAvailabilityChange(() => force((n) => n + 1)), []);

  if (isNativeApp() || isStandalone()) return null;

  if (canPromptInstall()) {
    return (
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="pixel-button flex items-center gap-2 px-3 py-1.5 text-xs"
        data-testid="install-app"
      >
        <Download className="w-4 h-4" /> Install app
      </button>
    );
  }

  if (isIOS() && !iosDismissed) {
    return (
      <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 text-[#f4e7c3] text-sm">
        <Share className="w-4 h-4 shrink-0" />
        <span>Install: tap Share, then <b>Add to Home Screen</b></span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => { setIosDismissed(true); try { localStorage.setItem(IOS_DISMISSED, '1'); } catch { /* fine */ } }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
