import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Egg, Zap } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { resolveSocketUrl } from '@/config';
import { WorldVerify } from '@/components/WorldVerify';

type Board = 'hold' | 'steals' | 'wins';
interface Row { rank: number; name: string; value: number; bestPoints: number; you: boolean }
/** `verifiedOnly`: World ID is on, so only verified humans rank (server/src/world.ts). */
interface BoardData { entries: Row[]; me: Row | null; verifiedOnly?: boolean; youVerified?: boolean }

const TABS: Array<{ id: Board; label: string; icon: typeof Egg; show: (v: number) => string; note: string }> = [
  { id: 'hold', label: 'Longest hold', icon: Egg, show: (v) => `${Math.floor(v / 1000)}s`, note: 'Longest time holding the egg in one online match.' },
  { id: 'steals', label: 'Most steals', icon: Zap, show: (v) => String(v), note: 'Most steals in one online match.' },
  { id: 'wins', label: 'Wins', icon: Crown, show: (v) => String(v), note: 'Online matches won.' },
];

/** An open board refreshes itself, so it can stay up on a screen at the event. */
const REFRESH_MS = 20_000;

/**
 * The all-time leaderboard. Hold and steals rank each player's best single match, not a
 * total, so one great match counts even if the rest were worse.
 */
export default function Leaderboard() {
  const navigate = useNavigate();
  const initUserId = useGameStore((s) => s.initUserId);
  const [me, setMe] = useState<string | null>(null);
  const [board, setBoard] = useState<Board>('hold');
  const [data, setData] = useState<BoardData | null>(null);
  const [failed, setFailed] = useState(false);
  // Bumped after a World ID verification, to reload the board with the player on it.
  const [reload, setReload] = useState(0);
  usePageTitle('Leaderboard');

  useEffect(() => { setMe(initUserId()); }, [initUserId]);

  useEffect(() => {
    if (me === null) return;
    let cancelled = false;
    const load = () => {
      fetch(`${resolveSocketUrl()}/leaderboard?board=${board}&me=${encodeURIComponent(me)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: BoardData) => { if (!cancelled) { setData(d); setFailed(false); } })
        .catch(() => { if (!cancelled) setFailed(true); });
    };
    setData(null);
    load();
    const t = window.setInterval(load, REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [board, me, reload]);

  const tab = TABS.find((t) => t.id === board)!;
  const meOffBoard = data?.me && !data.entries.some((e) => e.you) ? data.me : null;

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
            Leaderboard
          </h1>
        </div>

        {data?.verifiedOnly && !data.youVerified && me && (
          <WorldVerify userId={me} onVerified={() => setReload((n) => n + 1)} />
        )}

        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Leaderboard">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === board}
              onClick={() => setBoard(t.id)}
              className={`px-chip flex items-center justify-center gap-1.5 px-2 py-2 transition-all ${t.id === board ? 'brightness-125' : 'opacity-60 hover:opacity-90'}`}
              data-testid={`leaderboard-tab-${t.id}`}
            >
              <t.icon className="h-4 w-4 shrink-0 text-[#ffc93c]" />
              <span className="px-heading text-[8px] uppercase tracking-wider text-[#f4e7c3] sm:text-[10px]">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="px-panel p-3 sm:p-4" role="tabpanel">
          {failed && !data ? (
            <p className="text-center text-sm text-[#f4e7c3]/80">Can&apos;t reach the server. Trying again…</p>
          ) : !data ? (
            <p className="text-center text-sm text-[#f4e7c3]/80">Loading…</p>
          ) : data.entries.length === 0 ? (
            <p className="text-center text-sm text-[#f4e7c3]/80">
              {data.verifiedOnly ? 'No verified humans on this board yet.' : 'No online matches yet. Play one to get on the board.'}
            </p>
          ) : (
            <ol className="flex flex-col gap-1.5" data-testid="leaderboard-rows">
              {data.entries.map((e) => (
                <li
                  key={e.rank}
                  className={`flex items-center justify-between gap-3 px-2 py-1.5 pixel-border ${e.rank === 1 ? 'bg-[#804d2e]' : 'bg-[#4d2813]'}`}
                  style={e.you ? { borderColor: '#6ab04c' } : undefined}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="pixel-font w-8 shrink-0 text-sm text-[#ffc93c]">#{e.rank}</span>
                    <span className="truncate text-sm font-black text-white sm:text-base">{e.name}</span>
                    {e.you && <span className="shrink-0 bg-[#6ab04c] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">You</span>}
                  </span>
                  <span className="shrink-0 text-base font-black tabular-nums text-amber-300 sm:text-xl">{tab.show(e.value)}</span>
                </li>
              ))}
            </ol>
          )}
          {meOffBoard && (
            <p className="mt-2 text-center text-sm text-[#f4e7c3]">
              You: <span className="font-black text-[#6ab04c]">#{meOffBoard.rank}</span> · {tab.show(meOffBoard.value)}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-[#f4e7c3]/70">
          {tab.note}
          {data?.verifiedOnly && ' Verified humans only, one row each (World ID).'}
          {data?.youVerified && " You're verified."}
        </p>
      </div>
    </main>
  );
}
