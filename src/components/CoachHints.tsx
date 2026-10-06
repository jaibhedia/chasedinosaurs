import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice';

const KEY = 'chase-coach-matches';
/** How many solo matches get hints before we trust the player to know the rules. */
const COACHED_MATCHES = 2;
const SHOW_MS = 3500;

function coachedSoFar(): number {
  try { return Number(localStorage.getItem(KEY) || 0); } catch { return COACHED_MATCHES; }
}

/**
 * First-run coaching: short hints that appear as the situations they describe happen,
 * during a player's first couple of solo matches. Each hint shows once per match. This
 * teaches by playing rather than by a slideshow before playing.
 */
export function CoachHints() {
  const gameMode = useGameStore((s) => s.gameMode);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const players = useGameStore((s) => s.players);
  const timeRemaining = useGameStore((s) => s.timeRemaining);
  const touch = useIsTouchDevice();
  const [enabled] = useState(() => gameMode === 'single-player' && coachedSoFar() < COACHED_MATCHES);
  const shown = useRef(new Set<string>());
  const [hint, setHint] = useState<{ key: string; text: string } | null>(null);
  const counted = useRef(false);

  // Count the match once it ends, so coaching stops after COACHED_MATCHES.
  useEffect(() => {
    if (!enabled || gamePhase !== 'ended' || counted.current) return;
    counted.current = true;
    try { localStorage.setItem(KEY, String(coachedSoFar() + 1)); } catch { /* fine */ }
  }, [enabled, gamePhase]);

  // Clear the current hint after a moment.
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [hint]);

  useEffect(() => {
    if (!enabled || gamePhase !== 'playing' || hint) return;
    const me = players.find((p) => p.id === 'player');
    if (!me) return;
    const holder = players.find((p) => p.hasEgg);
    const candidates: Array<[string, boolean, string]> = [
      ['egg', !holder, 'Run to the golden egg! Follow the yellow arrow.'],
      ['have', !!me.hasEgg, 'You have it! Keep away until the timer hits zero.'],
      // No name: the egg can change hands while the hint is up, and a named one then
      // contradicts the "CHASE <name>" chip in the HUD.
      ['chase', !!holder && !me.hasEgg, 'Catch whoever has the egg to steal it.'],
      ['power', !!me.powerUpReady, touch ? 'Your power is ready: tap the ⚡ button.' : 'Your power is ready: press SPACE.'],
      ['final', timeRemaining > 0 && timeRemaining <= 10, 'Ten seconds! Hold the egg at zero to win.'],
    ];
    for (const [key, when, text] of candidates) {
      if (when && !shown.current.has(key)) {
        shown.current.add(key);
        setHint({ key, text });
        break;
      }
    }
  }, [enabled, gamePhase, players, timeRemaining, hint, touch]);

  // Centred by a full-width flex row, not left-1/2 + -translate-x-1/2: framer-motion
  // writes its own `transform` for the slide-in, which wiped out the translate and
  // left the hint hanging off to the right of centre.
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 4.5rem)' }}
    >
      <AnimatePresence>
        {hint && (
          <motion.div
            key={hint.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-panel px-4 py-2 text-center max-w-[80vw]"
            data-testid="coach-hint"
          >
            <p className="px-heading text-[10px] sm:text-xs leading-relaxed text-[#ffc93c]">{hint.text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
