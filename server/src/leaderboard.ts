/**
 * The all-time leaderboard. Each player keeps their best single match, not a running
 * total: a great first match stays on the board even if every match after it is worse.
 * Three boards: longest egg hold (best match), most steals (best match), and wins
 * (matches won, the one board where a total is the only meaningful number).
 *
 * Only online matches count, because the server saw them; solo matches run in the browser.
 * Held in memory and saved to Upstash Redis when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set (free, and it survives restarts, deploys and idle sleeps).
 * Otherwise it goes to DATA_DIR/leaderboard.json, which Render's free plan wipes on all three.
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
  /** Proved a unique human with World ID (see world.ts). */
  verified?: boolean;
  /** That proof's nullifier, as a decimal: one World ID backs one player. Never sent out. */
  nullifier?: string;
}

export interface BoardRow { rank: number; name: string; value: number; bestPoints: number; you: boolean; verified: boolean }

const entries = new Map<string, Entry>();
/** False until the stored board has been read. Saving before then would overwrite it. */
let loaded = false;
/** There are changes that haven't been saved. */
let dirty = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
/** Saves run one after another, so a slow one can't land after a newer one. */
let saving: Promise<void> = Promise.resolve();

const REDIS_KEY = 'chase:leaderboard';

// Read lazily so tests (and a late env change) can point it elsewhere.
const dataFile = () => join(process.env.DATA_DIR || join(process.cwd(), 'data'), 'leaderboard.json');

function upstash(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

const where = () => (upstash() ? 'Upstash' : dataFile());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms).unref());

/** One Redis command over Upstash's REST API (a JSON array in the body), so no client library. */
async function redis(cfg: { url: string; token: string }, command: string[]): Promise<unknown> {
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(5000),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || body.error) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.result;
}

/** The stored board as JSON, or null when nothing is stored yet. Throws when it can't be read. */
async function readStore(): Promise<string | null> {
  const cfg = upstash();
  if (cfg) return ((await redis(cfg, ['GET', REDIS_KEY])) as string | null) ?? null;
  try {
    return readFileSync(dataFile(), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function writeStore(json: string): Promise<void> {
  const cfg = upstash();
  if (cfg) {
    await redis(cfg, ['SET', REDIS_KEY, json]);
    return;
  }
  // Atomically (temp file + rename), so a crash can't truncate it.
  const file = dataFile();
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(`${file}.tmp`, json);
  renameSync(`${file}.tmp`, file);
}

/** A stored entry plus the matches recorded since startup. The two never overlap. */
function merge(stored: Entry, recent?: Entry): Entry {
  if (!recent) return stored;
  return {
    ...recent,
    bestHoldMs: Math.max(stored.bestHoldMs, recent.bestHoldMs),
    bestSteals: Math.max(stored.bestSteals, recent.bestSteals),
    bestPoints: Math.max(stored.bestPoints, recent.bestPoints),
    wins: stored.wins + recent.wins,
    matches: stored.matches + recent.matches,
    verified: stored.verified || recent.verified,
    nullifier: recent.nullifier ?? stored.nullifier,
  };
}

/**
 * Read the stored board, retrying until it can be read (Upstash may be briefly unreachable).
 * Matches that finish meanwhile are merged in, and nothing is saved before the read, so a
 * failed read can't wipe the board.
 */
export async function loadLeaderboard(): Promise<void> {
  for (let wait = 1000; ; wait = Math.min(wait * 2, 60_000)) {
    let raw: string | null;
    try {
      raw = await readStore();
    } catch (err) {
      console.warn(`[leaderboard] can't read ${where()}, retrying in ${wait / 1000}s:`, (err as Error).message);
      await sleep(wait);
      continue;
    }
    let list: Entry[] = [];
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) list = parsed as Entry[];
    } catch {
      console.warn(`[leaderboard] ${where()} isn't valid JSON; starting empty`);
    }
    for (const e of list) if (e && typeof e.userId === 'string') entries.set(e.userId, merge(e, entries.get(e.userId)));
    loaded = true;
    console.log(`[leaderboard] loaded ${list.length} players from ${where()}`);
    if (dirty) scheduleSave();
    return;
  }
}

async function save(): Promise<void> {
  dirty = false;
  try {
    await writeStore(JSON.stringify([...entries.values()]));
  } catch (err) {
    console.warn(`[leaderboard] save to ${where()} failed, retrying in 10s:`, (err as Error).message);
    scheduleSave(10_000);
  }
}

/** Save at most every 2s. Before the stored board has been read, only note that a save is owed. */
function scheduleSave(delay = 2000): void {
  dirty = true;
  if (!loaded || saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saving = saving.then(save);
  }, delay);
  saveTimer.unref();
}

/** Save any pending change now, before the process exits. */
export async function flushLeaderboard(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (loaded && dirty) saving = saving.then(save);
  await saving;
}

/** For /health: where the board is kept, and whether it has been read yet. */
export function leaderboardStore(): { store: 'upstash' | 'file'; loaded: boolean } {
  return { store: upstash() ? 'upstash' : 'file', loaded };
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

/**
 * Mark a player as a verified human, keyed by their World ID nullifier. One World ID backs
 * one player: 'taken' when a different player already holds this nullifier.
 */
export function markVerified(userId: string, nullifier: string, now = Date.now()): 'ok' | 'taken' {
  for (const e of entries.values()) if (e.nullifier === nullifier && e.userId !== userId) return 'taken';
  const e = entries.get(userId)
    ?? { userId, name: 'Player', bestHoldMs: 0, bestSteals: 0, bestPoints: 0, wins: 0, matches: 0, updatedAt: now };
  e.verified = true;
  e.nullifier = nullifier;
  entries.set(userId, e);
  scheduleSave();
  return 'ok';
}

export function isVerified(userId: string): boolean {
  return !!userId && entries.get(userId)?.verified === true;
}

const VALUE: Record<Board, (e: Entry) => number> = {
  hold: (e) => e.bestHoldMs,
  steals: (e) => e.bestSteals,
  wins: (e) => e.wins,
};

/**
 * The top `limit` on a board, best first (ties: best match points, then whoever got there
 * first). User ids stay private: `me` only marks the caller's own row, and `me` in the
 * result is their own rank even when it's outside the top. With `verifiedOnly` (World ID
 * on), only verified humans rank.
 */
export function leaderboard(board: Board, me = '', limit = 20, verifiedOnly = false): { board: Board; entries: BoardRow[]; me: BoardRow | null } {
  const value = VALUE[board];
  const ranked = [...entries.values()]
    .filter((e) => value(e) > 0 && (!verifiedOnly || e.verified === true))
    .sort((a, b) => value(b) - value(a) || b.bestPoints - a.bestPoints || a.updatedAt - b.updatedAt);
  const row = (e: Entry, i: number): BoardRow => ({
    rank: i + 1, name: e.name, value: value(e), bestPoints: e.bestPoints, you: !!me && e.userId === me, verified: e.verified === true,
  });
  const mine = me ? ranked.findIndex((e) => e.userId === me) : -1;
  return { board, entries: ranked.slice(0, limit).map(row), me: mine >= 0 ? row(ranked[mine], mine) : null };
}
