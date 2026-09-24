import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SocketProvider } from '@/providers/SocketProvider';
import LandscapePrompt from '@/components/LandscapePrompt';
import { RoomWatcher } from '@/components/RoomWatcher';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { isNativeApp } from '@/lib/platform';
import { audioManager } from '@/utils/audioManager';
import Home from '@/screens/Home';
import ModeSelect from '@/screens/ModeSelect';
import SoloSetup from '@/screens/SoloSetup';
import Lobby from '@/screens/Lobby';
import Results from '@/screens/Results';
import { Privacy, Terms } from '@/screens/Legal';

// Phaser is most of the download; the menus shouldn't wait for it.
const PlayScreen = lazy(() => import('@/screens/PlayScreen'));

/** Reading the legal pages in portrait is fine; everything else is landscape-only. */
const PORTRAIT_OK = new Set(['/privacy', '/terms']);

export default function App() {
  const location = useLocation();

  useEffect(() => {
    audioManager.init();
  }, []);

  return (
    <SocketProvider>
      <RoomWatcher />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/play" element={<ModeSelect />} />
        <Route path="/solo" element={<SoloSetup />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/quick" element={<Lobby key="quick" quick />} />
        <Route path="/join/:code" element={<Lobby />} />
        <Route
          path="/game"
          element={
            <Suspense fallback={<div className="h-[100dvh] w-full bg-[#14141f]" />}>
              <PlayScreen />
            </Suspense>
          }
        />
        <Route path="/results" element={<Results />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        {/* Links from the old site. */}
        <Route path="/mode-selection" element={<Navigate to="/play" replace />} />
        <Route path="/character-selection" element={<Navigate to="/solo" replace />} />
        <Route path="/map-selection" element={<Navigate to="/solo" replace />} />
        <Route path="/multiplayer-lobby" element={<Navigate to="/lobby" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!PORTRAIT_OK.has(location.pathname) && <LandscapePrompt />}
      {!isNativeApp() && <UpdatePrompt />}
      {/* Faint CRT scanlines over everything. */}
      <div className="scanlines" aria-hidden="true" />
    </SocketProvider>
  );
}
