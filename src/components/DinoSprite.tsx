import { useEffect, useState } from 'react';
import type { CharacterSpriteId } from '@/store/gameStore';

const FRAME = 24;
const COLS = 24;

/**
 * A dino running on the spot, drawn from the same sprite sheet the game uses.
 * Frames 4..9 are the run cycle.
 */
export function DinoSprite({ spriteId, scale = 2.9, className = '' }: { spriteId: CharacterSpriteId; scale?: number; className?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => (f + 1) % 6), 110);
    return () => window.clearInterval(id);
  }, []);

  const run = 4 + frame;
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="absolute"
        style={{
          width: FRAME,
          height: FRAME,
          left: '50%',
          top: '50%',
          backgroundImage: `url(${import.meta.env.BASE_URL}assets/characters/dino_${spriteId}.png)`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${-((run % COLS) * FRAME)}px ${-(Math.floor(run / COLS) * FRAME)}px`,
          imageRendering: 'pixelated',
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      />
    </div>
  );
}
