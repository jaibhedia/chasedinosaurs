import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePageTitle } from '@/hooks/usePageTitle';
import ControlsPanel from '@/components/ControlsPanel';

/** Settings, from the home screen. It holds the controls for now; the in-game menu shows the same panel. */
export default function Settings() {
  const navigate = useNavigate();
  usePageTitle('Settings');

  return (
    <main className="h-[100dvh] w-full overflow-y-auto bg-[#14141f] px-4 py-4 short:py-2">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 short:gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="pixel-button flex h-10 w-10 items-center justify-center !p-0"
            aria-label="Back to the main menu"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="px-heading text-lg sm:text-2xl" style={{ color: '#ffc93c', textShadow: '3px 3px 0 #11111c' }}>
            Settings
          </h1>
        </div>

        <h2 className="px-heading text-[10px] uppercase tracking-wider text-[#f4e7c3]/80 sm:text-xs">Controls</h2>
        <ControlsPanel />
      </div>
    </main>
  );
}
