import { AnimatePresence, motion } from 'framer-motion';
import { Play, RotateCcw, Users, Home, Music, Volume2, VolumeX, ArrowLeftRight, EyeOff, Gamepad2, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/store/gameStore';
import { useSocket } from '@/providers/SocketProvider';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice';
import { audioManager } from '@/utils/audioManager';
import { clearMatchConfig } from '@/lib/matchConfig';
import ControlsPanel from '@/components/ControlsPanel';

/**
 * In-game menu, shown whenever the store is `paused` (the HUD ☰ button sets that).
 * Solo: it pauses the match (gameScene.update() freezes the simulation). Online: it never
 * pauses anything; the match, your dino and the bots keep going behind it.
 */
export default function GameMenu() {
  const navigate = useNavigate();
  const { leaveRoom, socket } = useSocket();
  const spectating = useGameStore((s) => s.spectating);
  const paused = useGameStore((s) => s.paused);
  const setPaused = useGameStore((s) => s.setPaused);
  const gameMode = useGameStore((s) => s.gameMode);
  const [muted, setMuted] = useState(audioManager.isMuted);
  const [musicOn, setMusicOn] = useState(audioManager.isMusicOn());
  const toggleMute = () => { audioManager.toggleMute(); setMuted(audioManager.isMuted); };
  const toggleMusic = () => setMusicOn(audioManager.toggleMusic());
  const isTouch = useIsTouchDevice();
  const stickSide = useGameStore((s) => s.stickSide);
  const setStickSide = useGameStore((s) => s.setStickSide);
  // The menu's list, or the controls panel in its place.
  const [view, setView] = useState<'menu' | 'controls'>('menu');
  useEffect(() => { if (!paused) setView('menu'); }, [paused]);

  const online = gameMode === 'multiplayer';

  const resume = () => setPaused(false);
  // Leaving a room mid-match hands your seat back rather than holding it for 30s.
  const exit = (to: string) => {
    setPaused(false);
    if (online) {
      leaveRoom();
      useGameStore.getState().setRoomCode(null);
    }
    clearMatchConfig();
    useGameStore.getState().resetMatch();
    navigate(to, { replace: true });
  };
  const restart = () => {
    setPaused(false);
    try { localStorage.removeItem('chase-game-snapshot'); } catch { /* fresh match */ }
    useGameStore.getState().resetMatch();
    navigate('/game', { replace: true });
  };

  // An admin spectator leaves the room's broadcasts and goes back to the room list.
  const stopWatching = () => {
    setPaused(false);
    socket?.emit('stop-spectating');
    const store = useGameStore.getState();
    store.setSpectating(false);
    store.setRoomCode(null);
    store.resetMatch();
    navigate('/admin', { replace: true });
  };

  const items: Array<{ label: string; icon: typeof Play; onClick: () => void; tone: string }> = spectating ? [
    { label: 'Back to match', icon: Play, onClick: resume, tone: '#6ab04c' },
    { label: 'Stop watching', icon: EyeOff, onClick: stopWatching, tone: '#e8503a' },
  ] : [
    { label: online ? 'Back to match' : 'Resume', icon: Play, onClick: resume, tone: '#6ab04c' },
    // A room's match can't be restarted by one player.
    ...(online ? [] : [{ label: 'Restart match', icon: RotateCcw, onClick: restart, tone: '#5fcde4' }]),
    ...(online ? [{ label: 'Leave to lobby', icon: Users, onClick: () => exit('/lobby'), tone: '#ffc93c' }] : []),
    { label: 'Controls', icon: Gamepad2, onClick: () => setView('controls'), tone: '#5fcde4' },
    { label: 'Main menu', icon: Home, onClick: () => exit('/'), tone: '#e8503a' },
  ];

  return (
    <AnimatePresence>
      {paused && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className={`absolute inset-0 ${online ? 'bg-black/30' : 'bg-black/55'}`} onClick={resume} />
          <motion.div
            className={`relative px-panel px-4 py-4 sm:px-8 sm:py-7 flex flex-col items-stretch gap-2 sm:gap-3 ${view === 'controls' ? 'w-[min(92vw,520px)]' : 'w-[min(82vw,320px)]'} max-h-[88dvh] overflow-y-auto`}
            initial={{ scale: 0.85, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.85, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            data-stick-ignore
          >
            {view === 'controls' ? (
              <>
                <p className="px-heading text-center text-base sm:text-2xl mb-0.5 sm:mb-1" style={{ color: '#ffc93c', textShadow: '3px 3px 0 #11111c' }}>
                  CONTROLS
                </p>
                <ControlsPanel live={online} bare />
                <button
                  onClick={() => setView('menu')}
                  className="px-chip flex items-center justify-center gap-2 px-3 py-2 sm:py-3 transition-all hover:brightness-110 active:translate-y-px"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-[#f4e7c3]" />
                  <span className="px-heading text-[10px] sm:text-xs uppercase tracking-wider text-[#f4e7c3]">Back</span>
                </button>
              </>
            ) : (
              <>
                <p className="px-heading text-center text-base sm:text-2xl mb-0.5 sm:mb-1" style={{ color: '#ffc93c', textShadow: '3px 3px 0 #11111c' }}>
                  {online ? 'MENU' : 'PAUSED'}
                </p>
                {online && (
                  <p className="text-center text-[#f4e7c3]/80 text-sm -mt-1 mb-1">The match keeps going. Online games can&apos;t be paused.</p>
                )}
                {items.map(({ label, icon: Icon, onClick, tone }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    className="px-chip flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 transition-all hover:brightness-110 active:translate-y-px"
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" style={{ color: tone }} />
                    <span className="px-heading text-[10px] sm:text-xs uppercase tracking-wider text-[#f4e7c3]">{label}</span>
                  </button>
                ))}

                {/* Sound controls live here (moved out of the in-game header). */}
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={toggleMusic}
                    className="px-chip flex flex-1 items-center justify-center gap-2 px-3 py-2 sm:py-3 transition-all hover:brightness-110 active:translate-y-px"
                    aria-label={musicOn ? 'Stop music' : 'Start music'}
                  >
                    <Music className={`h-4 w-4 sm:h-5 sm:w-5 ${musicOn ? 'text-[#5fcde4]' : 'text-[#e8503a] opacity-60'}`} />
                    <span className="px-heading text-[10px] sm:text-xs uppercase tracking-wider text-[#f4e7c3]">Music</span>
                  </button>
                  <button
                    onClick={toggleMute}
                    className="px-chip flex flex-1 items-center justify-center gap-2 px-3 py-2 sm:py-3 transition-all hover:brightness-110 active:translate-y-px"
                    aria-label={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? <VolumeX className="h-4 w-4 sm:h-5 sm:w-5 text-[#e8503a]" /> : <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 text-[#5fcde4]" />}
                    <span className="px-heading text-[10px] sm:text-xs uppercase tracking-wider text-[#f4e7c3]">{muted ? 'Muted' : 'Sound'}</span>
                  </button>
                </div>

                {/* Phones: which thumb steers. The power button moves to the other side. */}
                {isTouch && (
                  <button
                    onClick={() => setStickSide(stickSide === 'right' ? 'left' : 'right')}
                    className="px-chip flex items-center justify-center gap-2 px-3 py-2 sm:py-3 transition-all hover:brightness-110 active:translate-y-px"
                    aria-label={`Move the stick to the ${stickSide === 'right' ? 'left' : 'right'}`}
                  >
                    <ArrowLeftRight className="h-4 w-4 sm:h-5 sm:w-5 text-[#5fcde4]" />
                    <span className="px-heading text-[10px] sm:text-xs uppercase tracking-wider text-[#f4e7c3]">Stick: {stickSide}</span>
                  </button>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
