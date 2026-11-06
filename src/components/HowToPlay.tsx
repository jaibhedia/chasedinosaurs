/**
 * Two slides, shown once, before a player picks a mode.
 *
 * People who watched the game cold read it as a racing game — the dinos run, there's a
 * timer, and nothing on screen says what winning means. Shown once per device and
 * skippable, so it never becomes something to click through on the way to a rematch.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Egg, Zap } from 'lucide-react';

const SEEN_KEY = 'chase-how-to-play-seen';

const SLIDES = [
  {
    icon: Egg,
    title: 'Grab the egg',
    body: 'One egg. Everyone wants it. Whoever is holding it when the timer hits zero wins, so take it, then survive being chased for it.',
  },
  {
    icon: Zap,
    title: 'Use your power',
    body: 'Every dino has a power that unlocks 15 seconds in: speed, blast, shield or teleport. Press SPACE, or the power button on a phone. It reloads faster near the end.',
  },
];

export function HowToPlay() {
  const [open, setOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // Blocked storage: showing the intro every time is worse than not showing it.
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* see above */ }
  };

  const next = () => (slide < SLIDES.length - 1 ? setSlide(slide + 1) : dismiss());

  if (!open) return null;

  const { icon: Icon, title, body } = SLIDES[slide];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
        data-pad-scope
      >
        <motion.div
          key={slide}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md p-6 sm:p-8 pixel-panel text-center max-h-[92dvh] overflow-y-auto"
        >
          <Icon className="mx-auto mb-4 h-10 w-10 sm:h-12 sm:w-12 text-[#ffc93c]" aria-hidden />
          <h2 className="pixel-font mb-3 text-lg sm:text-2xl font-bold text-[#f4e7c3]">{title}</h2>
          <p className="mb-6 sm:mb-8 text-base leading-relaxed text-[#f4e7c3]/80">{body}</p>

          <div className="mb-5 flex justify-center gap-2" aria-hidden>
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className="h-2 w-2"
                style={{ background: i === slide ? '#ffc93c' : 'rgba(244,231,195,0.3)' }}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="w-full bg-[#ffc93c] px-6 py-3 pixel-font font-bold text-[#1a1a1a] transition hover:brightness-110"
          >
            {slide < SLIDES.length - 1 ? 'Next' : "Let's play"}
          </button>
          <button
            onClick={dismiss}
            className="mt-3 w-full px-6 py-2 text-sm text-[#f4e7c3]/60 transition hover:text-[#f4e7c3]"
            data-pad-back
          >
            Skip
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
