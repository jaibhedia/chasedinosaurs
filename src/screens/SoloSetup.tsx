import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DinoSprite } from '@/components/DinoSprite';
import { characters } from '@/data/characters';
import { gameMaps } from '@/data/maps';
import { useGameStore, type Character, type Difficulty } from '@/store/gameStore';
import { saveMatchConfig } from '@/lib/matchConfig';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ComingSoon } from '@/components/ComingSoon';

const DIFFICULTIES: Array<{ id: Difficulty; label: string; hint: string; color: string }> = [
  { id: 'easy', label: 'Easy', hint: 'Slower bots that all chase you the same way', color: '#6ab04c' },
  { id: 'normal', label: 'Normal', hint: 'Bots split up: one chases, one cuts you off', color: '#ffc93c' },
  { id: 'hard', label: 'Hard', hint: 'Faster, sharper, and they time their powers', color: '#e8503a' },
];

/**
 * Solo pre-game: pick a difficulty, then tap a dino to start. One screen, one tap to
 * play, so a rematch with a different dino is two taps away from the results screen.
 */
export default function SoloSetup() {
  const navigate = useNavigate();
  const { setGameMode, setCharacter, setMap, difficulty, setDifficulty, initUserId, resetMatch, setRoomCode } = useGameStore();
  usePageTitle('Pick your dino');

  useEffect(() => {
    initUserId();
  }, [initUserId]);

  const start = (character: Character) => {
    setGameMode('single-player');
    setCharacter(character);
    setMap(gameMaps[0]);
    setRoomCode(null);
    resetMatch();
    saveMatchConfig();
    try { localStorage.removeItem('chase-game-snapshot'); } catch { /* fresh match */ }
    navigate('/game');
  };

  return (
    <main
      className="h-[100dvh] w-full flex flex-col overflow-y-auto px-solid-bg py-3 md:py-4 relative"
      style={{
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 0.75rem)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
      }}
    >
      <div className="w-full max-w-6xl mx-auto my-auto text-center space-y-3 md:space-y-6 short:space-y-2 relative z-10">
        <h1 className="text-lg md:text-3xl short:text-base title-pixel">Pick your dino</h1>

        {/* Difficulty */}
        <div className="mx-auto flex max-w-xl flex-col items-center gap-1.5">
          <div className="grid w-full grid-cols-3 gap-2" role="radiogroup" aria-label="Bot difficulty">
            {DIFFICULTIES.map((d) => {
              const on = d.id === difficulty;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDifficulty(d.id)}
                  data-testid={`difficulty-${d.id}`}
                  className="pixel-border px-2 py-1.5 md:py-2.5 short:py-1 transition-all"
                  style={{
                    background: on ? d.color : '#4d2813',
                    color: on ? '#1a1206' : 'rgba(244,231,195,0.7)',
                  }}
                >
                  <span className="pixel-font text-[10px] md:text-sm uppercase">{d.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-sm md:text-base short:text-xs text-[#f4e7c3]/70">
            {DIFFICULTIES.find((d) => d.id === difficulty)?.hint}
          </p>
        </div>

        {/* Dinos */}
        <div className="grid grid-cols-4 gap-2 md:gap-5">
          {characters.map((c, i) => (
            <motion.button
              key={c.id}
              type="button"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.07 }}
              whileHover={{ y: -6 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => start(c)}
              data-testid={`pick-${c.spriteId}`}
              className="pixel-panel p-2 md:p-5 short:p-2 flex flex-col items-center text-center"
              style={{ borderColor: c.color }}
            >
              <div
                className="w-14 h-14 md:w-28 md:h-28 short:w-14 short:h-14 mb-1.5 md:mb-3 short:mb-1 flex items-center justify-center pixel-border"
                style={{ backgroundColor: c.color }}
              >
                <DinoSprite spriteId={c.spriteId} className="w-full h-full" scale={2.2} />
              </div>
              <h3 className="text-xs md:text-xl short:text-sm font-black text-white uppercase tracking-wider">{c.name}</h3>
              <div className="mt-1 md:mt-2 w-full bg-[#4d2813] pixel-border px-1 py-1 md:p-2">
                <p className="pixel-font text-[#ffc93c] text-[7px] md:text-[10px] uppercase flex items-center justify-center gap-1">
                  <Zap className="w-2.5 h-2.5 md:w-3 md:h-3" /> {c.powerUp.name}
                </p>
                <p className="hidden md:block short:hidden text-[#f4e7c3]/80 text-sm mt-1 leading-tight">{c.powerUp.description}</p>
              </div>
              <div className="mt-1.5 md:mt-3 short:mt-1 w-full">
                <div className="flex justify-between text-[10px] md:text-xs text-[#f4e7c3]/70 uppercase">
                  <span>Speed</span>
                  <span>{c.speed.toFixed(1)}</span>
                </div>
                <div className="w-full bg-[#261309] h-1.5 md:h-2.5 pixel-border overflow-hidden">
                  <div className="h-full" style={{ width: `${(c.speed / 5) * 100}%`, background: c.color }} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => navigate('/play')} variant="outline" size="lg" className="gap-2" data-pad-back>
            <ArrowLeft className="w-5 h-5" />
            Back
          </Button>
          <ComingSoon />
        </div>
      </div>
    </main>
  );
}
