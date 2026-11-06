import { Egg } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';

/**
 * The live in-match leaderboard: points so far (a second with the egg, 5 a steal), fed by
 * the scene a few times a second. The 30-point win bonus lands on the results screen.
 */
export function LiveScoreboard({ compact }: { compact: boolean }) {
  const rows = useGameStore((s) => s.scoreboard);
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.heldS - a.heldS);

  return (
    <div className={`pointer-events-none px-panel hud-lite ${compact ? 'w-[132px] px-2 py-1' : 'w-[210px] px-3 py-2'}`}>
      <div className="mb-1 flex items-center justify-between">
        <span className="px-heading text-[7px] uppercase tracking-[0.2em] text-[#9fb0d8] sm:text-[8px]">Points</span>
        {!compact && <span className="px-heading text-[7px] uppercase tracking-wider text-[#9fb0d8]">held · steals</span>}
      </div>
      <div className="flex flex-col gap-1">
        {sorted.map((r, i) => (
          <div key={r.id} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <span className="px-heading text-[8px] text-[#9fb0d8]">{i + 1}</span>
              {r.hasEgg && <Egg className="h-3 w-3 shrink-0 text-[#ffc93c]" aria-label="has the egg" />}
              <span className="px-heading truncate text-[8px] sm:text-[9px]" style={{ color: r.isSelf ? '#4ade80' : '#f4e7c3' }}>
                {r.name}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-1.5">
              {!compact && <span className="px-heading text-[7px] tabular-nums text-[#9fb0d8]">{r.heldS}s · {r.steals}</span>}
              <span className="px-heading text-[9px] tabular-nums text-[#ffc93c] sm:text-[10px]">{r.points}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
