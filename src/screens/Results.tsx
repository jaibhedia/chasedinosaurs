import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Home, RotateCcw, Skull, Star, ThumbsUp, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DinoSprite } from '@/components/DinoSprite';
import { useGameStore } from '@/store/gameStore';
import { useSocket } from '@/providers/SocketProvider';
import { audioManager } from '@/utils/audioManager';
import { clearMatchConfig, saveMatchConfig } from '@/lib/matchConfig';
import { usePageTitle } from '@/hooks/usePageTitle';

const CONFETTI = ['#fbbf24', '#f59e0b', '#ef4444', '#ec4899', '#a855f7'];

export default function Results() {
  const navigate = useNavigate();
  const { winner, gameMessage, players, gameMode, resetMatch, setRoomCode } = useGameStore();
  const { leaveRoom } = useSocket();
  const playedSound = useRef(false);
  const playerWon = winner?.id === 'player';
  usePageTitle(playerWon ? 'Victory' : 'Results');

  useEffect(() => {
    if (!winner) navigate('/', { replace: true });
  }, [winner, navigate]);

  useEffect(() => {
    if (!winner || playedSound.current) return;
    playedSound.current = true;
    audioManager.play(playerWon ? 'victory' : 'defeat');
  }, [winner, playerWon]);

  // The winner is #1 by definition; everyone else by how often they got the egg.
  const ranked = useMemo(
    () =>
      [...players]
        .sort((a, b) => {
          const score = (p: typeof a) => (p.eggHoldCount ?? 0) + (p.id === winner?.id ? 1_000_000 : 0);
          return score(b) - score(a);
        })
        .map((p, i) => ({ ...p, rank: i + 1 })),
    [players, winner?.id],
  );

  // Fixed on mount so the confetti doesn't reshuffle on every render.
  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        key: i,
        x: Math.random() * window.innerWidth,
        duration: Math.random() * 3 + 2,
        delay: Math.random() * 2,
        color: CONFETTI[i % CONFETTI.length],
      })),
    [],
  );

  const online = gameMode === 'multiplayer';

  const rematch = () => {
    resetMatch();
    saveMatchConfig();
    try { localStorage.removeItem('chase-game-snapshot'); } catch { /* fresh match */ }
    navigate('/game', { replace: true });
  };
  // The finished room is left behind; the lobby starts fresh.
  const leaveFinishedRoom = () => {
    if (!online) return;
    leaveRoom();
    setRoomCode(null);
  };
  const toLobby = () => {
    leaveFinishedRoom();
    resetMatch();
    clearMatchConfig();
    navigate('/lobby', { replace: true });
  };
  const toSolo = () => {
    resetMatch();
    clearMatchConfig();
    navigate('/solo', { replace: true });
  };
  const home = () => {
    leaveFinishedRoom();
    resetMatch();
    clearMatchConfig();
    navigate('/', { replace: true });
  };

  if (!winner) return null;

  return (
    <main className="h-[100dvh] w-full flex flex-col overflow-y-auto px-solid-bg p-3 md:p-4 relative">
      {playerWon && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {confetti.map((c) => (
            <motion.div
              key={c.key}
              initial={{ y: -100, x: c.x, rotate: 0 }}
              animate={{ y: window.innerHeight + 100, rotate: 360, opacity: [1, 1, 0] }}
              transition={{ duration: c.duration, repeat: Infinity, delay: c.delay }}
              className="absolute w-3 h-3"
              style={{ backgroundColor: c.color }}
            />
          ))}
        </div>
      )}

      <div className="w-full max-w-5xl mx-auto my-auto grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-3 md:gap-6 items-center relative z-10">
        {/* Left: verdict + actions, always on screen in landscape. */}
        <div className="text-center space-y-2 md:space-y-4 short:space-y-1.5">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
            {playerWon ? (
              <Trophy className="w-12 h-12 md:w-24 md:h-24 short:w-9 short:h-9 mx-auto text-yellow-400" style={{ filter: 'drop-shadow(0 0 24px rgba(250,204,21,0.8))' }} />
            ) : (
              <Skull className="w-12 h-12 md:w-24 md:h-24 short:w-9 short:h-9 mx-auto text-red-500" style={{ filter: 'drop-shadow(0 0 24px rgba(239,68,68,0.6))' }} />
            )}
          </motion.div>

          <h1 className="text-xl md:text-4xl short:text-lg uppercase tracking-wider title-pixel" style={{ color: playerWon ? '#ffc93c' : '#e8503a' }} data-testid="results-title">
            {playerWon ? 'Victory!' : 'Defeated!'}
          </h1>

          <div className="pixel-panel p-2 md:p-4 short:p-1.5" style={{ borderColor: playerWon ? '#ffc93c' : '#e8503a' }}>
            <div className="flex items-center justify-center gap-2">
              <Crown className="w-4 h-4 md:w-6 md:h-6 text-yellow-400 shrink-0" />
              <h2 className="text-sm md:text-2xl short:text-sm font-black text-white uppercase" data-testid="results-winner">
                {winner.character.name} wins
              </h2>
              <Crown className="w-4 h-4 md:w-6 md:h-6 text-yellow-400 shrink-0" />
            </div>
            <p className="text-base md:text-xl short:text-sm font-bold text-white mt-1 short:mt-0 leading-tight">{gameMessage}</p>
          </div>

          <div className="flex flex-wrap gap-2 md:gap-3 justify-center">
            {online ? (
              <Button onClick={toLobby} size="lg" className="gap-2" data-testid="results-lobby">
                <Users className="w-5 h-5" /> Back to lobby
              </Button>
            ) : (
              <>
                <Button onClick={rematch} size="lg" className="gap-2" data-testid="results-rematch">
                  <RotateCcw className="w-5 h-5" /> Rematch
                </Button>
                <Button onClick={toSolo} variant="secondary" size="lg">
                  Change dino
                </Button>
              </>
            )}
            <Button onClick={home} variant="outline" size="lg" className="gap-2">
              <Home className="w-5 h-5" /> Home
            </Button>
          </div>
        </div>

        {/* Right: the table. */}
        <div className="pixel-panel p-2 md:p-4 short:p-1.5 space-y-1.5 md:space-y-2.5 short:space-y-1">
          {ranked.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-2 px-2 py-1 md:p-2.5 short:py-0.5 pixel-border ${p.rank === 1 ? 'bg-[#804d2e]' : 'bg-[#4d2813]'}`}
              style={p.id === 'player' ? { borderColor: '#6ab04c' } : undefined}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="pixel-font text-xs md:text-base w-7 text-[#ffc93c]">#{p.rank}</span>
                <div className="w-8 h-8 md:w-11 md:h-11 short:w-7 short:h-7 pixel-border shrink-0" style={{ backgroundColor: p.character.color }}>
                  <DinoSprite spriteId={p.character.spriteId} className="w-full h-full" scale={1.4} />
                </div>
                <span className="text-base md:text-xl short:text-sm font-black text-white truncate">{p.character.name}</span>
                {p.id === 'player' && <span className="px-1.5 py-0.5 bg-[#6ab04c] text-white text-[10px] font-bold uppercase">You</span>}
                {p.isBot && <span className="px-1.5 py-0.5 bg-[#261309] text-[#f4e7c3] text-[10px] font-bold uppercase">Bot</span>}
              </div>
              <div className="flex items-center gap-2 md:gap-4 shrink-0">
                <div className="text-center">
                  <p className="text-[10px] md:text-xs text-gray-300 uppercase leading-none">Grabs</p>
                  <p className="text-base md:text-2xl short:text-base font-black text-amber-300 leading-tight">{p.eggHoldCount ?? 0}</p>
                </div>
                <p className="hidden lg:block text-sm font-black uppercase text-[#f4e7c3] min-w-[90px] text-right">
                  {p.id === winner.id ? (
                    <span className="inline-flex items-center gap-1 text-[#ffc93c]"><Trophy className="w-4 h-4" /> Winner</span>
                  ) : (p.eggHoldCount ?? 0) >= 3 ? (
                    <span className="inline-flex items-center gap-1"><Star className="w-4 h-4" /> Thief</span>
                  ) : (p.eggHoldCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1"><ThumbsUp className="w-4 h-4" /> Stole it</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 opacity-60"><Skull className="w-4 h-4" /> Never held</span>
                  )}
                </p>
              </div>
            </div>
          ))}
          <p className="pt-0.5 text-[#f4e7c3]/80 text-sm short:text-xs text-center">
            Whoever holds the egg when the <span className="text-[#ffc93c] font-bold">timer hits zero</span> wins.
          </p>
        </div>
      </div>
    </main>
  );
}
