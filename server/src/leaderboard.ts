/**
 * The all-time leaderboard. Each player keeps their best single match, not a running
 * total: a great first match stays on the board even if every match after it is worse.
 * Three boards: longest egg hold (best match), most steals (best match), and wins
 * (matches won, the one board where a total is the only meaningful number).
 *
 * Only online matches count, because the server saw them; solo matches run in the browser.
 * Held in memory and written to DATA_DIR/leaderboard.json. On Render's free plan that disk
 * is wiped on every restart and deploy, so point DATA_DIR at a persistent disk to keep it.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MatchResult } from './match';

export type Board = 'hold' | 'steals' | 'wins';
export const BOARDS: Board[] = ['hold', 'steals', 'wins'];

interface Entry {
  userId: string;
  name: string;
  /** Longest time holding the egg in one match (ms). */
  bestHoldMs: number;
  /** Most steals in one match. */
  bestSteals: number;
  /** Most points in one match; breaks ties. */
  bestPoints: number;
  wins: number;
  matches: number;
  updatedAt: number;
}

export interface BoardRow { rank: number; name: string; value: number; bestPoints: number; you: boolean }

const entries = new Map<string, Entry>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// Read lazily so tests (and a late env change) can point it elsewhere.
const dataFile = () => join(process.env.DATA_DIR || join(process.cwd(), 'data'), 'leaderboard.json');

export function loadLeaderboard(): void {
  try {
    const list = JSON.parse(readFileSync(dataFile(), 'utf8')) as Entry[];
    for (const e of list) if (e && typeof e.userId === 'string') entries.set(e.userId, e);
    console.log(`[leaderboard] loaded ${entries.size} players from ${dataFile()}`);
  } catch {
    console.log(`[leaderboard] starting empty (${dataFile()})`);
  }
}

/** Write at most every 2s, atomically (temp file + rename) so a crash can't truncate it. */
function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const file = dataFile();
      mkdirSync(join(file, '..'), { recursive: true });
      writeFileSync(`${file}.tmp`, JSON.stringify([...entries.values()]));
      renameSync(`${file}.tmp`, file);
    } catch (err) {
      console.warn('[leaderboard] save failed:', (err as Error).message);
    }
  }, 2000);
  saveTimer.unref();
}

/** Fold a finished online match into each human player's bests. Bots never get an entry. */
export function recordMatch(result: MatchResult, players: Array<{ userId: string; name: string }>, now = Date.now()): void {
  for (const pl of players) {
    const st = result.stats.find((s) => s.userId === pl.userId);
    const e = entries.get(pl.userId)
      ?? { userId: pl.userId, name: pl.name, bestHoldMs: 0, bestSteals: 0, bestPoints: 0, wins: 0, matches: 0, updatedAt: now };
    e.name = pl.name || e.name;
    e.matches += 1;
    if (st) {
      e.bestHoldMs = Math.max(e.bestHoldMs, st.heldMs);
      e.bestSteals = Math.max(e.bestSteals, st.steals);
      e.bestPoints = Math.max(e.bestPoints, st.points);
    }
    if (result.winnerUserId === pl.userId) e.wins += 1;
    e.updatedAt = now;
    entries.set(pl.userId, e);
  }
  scheduleSave();
}

const VALUE: Record<Board, (e: Entry) => number> = {
  hold: (e) => e.bestHoldMs,
  steals: (e) => e.bestSteals,
  wins: (e) => e.wins,
};

/**
 * The top `limit` on a board, best first (ties: best match points, then whoever got there
 * first). User ids stay private: `me` only marks the caller's own row, and `me` in the
 * result is their own rank even when it's outside the top.
 */
export function leaderboard(board: Board, me = '', limit = 20): { board: Board; entries: BoardRow[]; me: BoardRow | null } {
  const value = VALUE[board];
  const ranked = [...entries.values()]
    .filter((e) => value(e) > 0)
    .sort((a, b) => value(b) - value(a) || b.bestPoints - a.bestPoints || a.updatedAt - b.updatedAt);
  const row = (e: Entry, i: number): BoardRow => ({ rank: i + 1, name: e.name, value: value(e), bestPoints: e.bestPoints, you: !!me && e.userId === me });
  const mine = me ? ranked.findIndex((e) => e.userId === me) : -1;
  return { board, entries: ranked.slice(0, limit).map(row), me: mine >= 0 ? row(ranked[mine], mine) : null };
}
