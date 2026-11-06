/**
 * Express + Socket.IO multiplayer backend for Chase.
 *
 * The only backend in the project. Holds room state in memory and relays
 * lobby + in-game events between the React game clients.
 *
 * Resilience: players are keyed by a stable `user_id`, so a refresh or a brief
 * network drop does NOT free their slot immediately. On disconnect the slot is
 * kept for RECONNECT_GRACE_MS; if the same user re-attaches (via `rejoin-room`)
 * within the window their slot — and live game session — is restored, exactly
 * like professional games. Voice signalling (WebRTC offer/answer/ICE) is relayed
 * room-scoped for proximity voice chat.
 *
 *   dev:   npm run dev    (tsx watch, hot reload)
 *   start: npm start      (tsx, used by Render — see ../render.yaml)
 *
 * Port: PORT (Render) or SOCKET_PORT, default 3001.
 */
// MUST be first: loads server/.env into process.env before any module below reads
// it (ai/provider.ts reads AI_* at import time). No-op on Render, which injects
// env vars directly. Never commit the real .env.
import 'dotenv/config';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server, type Socket } from 'socket.io';
import { botLine, matchRoast } from './botVoice';
import { aiEnabled, getAiClient, AI_MODEL, aiProviderName } from './ai/provider';
import { recentReceipts } from './ai/receipts';
import { Match } from './match';
import { BOARDS, flushLeaderboard, isVerified, leaderboard, leaderboardStore, loadLeaderboard, markVerified, recordMatch } from './leaderboard';
import { rpContext, verifyProof, worldConfig, worldEnabled, WorldError } from './world';
import { cleanName, uniqueName } from './names';

const PORT = Number(process.env.SOCKET_PORT || process.env.PORT || 3001);
/** How long a disconnected player's slot is held open for them to come back. */
const RECONNECT_GRACE_MS = 30_000;

interface LobbyPlayer {
  id: string;
  player_name: string;
  user_id: string;
  is_ready: boolean;
  /** Numeric character index (1-4) the client derives from the selected character. */
  character_id: number;
  /** Live connection bookkeeping for reconnect + voice routing. */
  connected: boolean;
  socket_id: string;
}

interface Room {
  mapId: string;
  isPublic: boolean;
  players: LobbyPlayer[];
  hostUserId: string;
  started: boolean;
  serverStartTime: number | null;
  /** user_id -> pending removal timer (cleared if they reconnect in time). */
  graceTimers: Map<string, ReturnType<typeof setTimeout>>;
  /** user_ids currently in the proximity voice channel. */
  voiceUsers: Set<string>;
  /** The match in progress: egg ownership, clock, stats. Null in the lobby. */
  match: Match | null;
  /** Fires at the buzzer to settle the match. */
  endTimer: ReturnType<typeof setTimeout> | null;
  /** Sends the live board (match-scores) once a second while the match runs. */
  scoreTimer: ReturnType<typeof setInterval> | null;
  /** Quick Play room: filled by matchmaking and started on a timer, no ready-up. */
  quick: boolean;
  /** Who has reported whom (reported userId → reporter userIds). */
  reports: Map<string, Set<string>>;
  /** Players dropped from voice after reports. */
  voiceBlocked: Set<string>;
  /** Server time a Quick Play room starts, if it's counting down. */
  startsAt: number | null;
  autoStart: ReturnType<typeof setTimeout> | null;
}

/** How long a Quick Play room waits for more players before bots fill the seats. */
const QUICK_WAIT_MS = 8000;
/** Don't drop a new player into a room that's about to start without them seeing it. */
const QUICK_JOIN_CUTOFF_MS = 1500;

function newRoom(mapId: string, isPublic: boolean, host: LobbyPlayer, quick = false): Room {
  return {
    mapId,
    isPublic,
    players: [host],
    hostUserId: host.user_id,
    started: false,
    serverStartTime: null,
    graceTimers: new Map(),
    voiceUsers: new Set(),
    match: null,
    endTimer: null,
    scoreTimer: null,
    quick,
    reports: new Map(),
    voiceBlocked: new Set(),
    startsAt: null,
    autoStart: null,
  };
}

/** In-memory room store, keyed by 6-char room code. */
const rooms = new Map<string, Room>();



function genRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** Public-facing player shape, broadcast to everyone in the room. */
function publicPlayers(room: Room): Array<LobbyPlayer & { host: boolean }> {
  return room.players.map((p) => ({
    id: p.id,
    player_name: p.player_name,
    user_id: p.user_id,
    is_ready: p.is_ready,
    character_id: p.character_id,
    connected: p.connected,
    socket_id: p.socket_id,
    host: p.user_id === room.hostUserId,
  }));
}

/** Drop a player from a room: hands the host role on, or closes an empty room. */
function removePlayer(rc: string, room: Room, uid: string): void {
  room.players = room.players.filter((p) => p.user_id !== uid);
  if (room.players.length === 0) {
    if (room.endTimer) clearTimeout(room.endTimer);
    if (room.scoreTimer) clearInterval(room.scoreTimer);
    if (room.autoStart) clearTimeout(room.autoStart);
    rooms.delete(rc);
    return;
  }
  if (room.hostUserId === uid) room.hostUserId = room.players[0].user_id;
  io.to(rc).emit('player-left', {
    userId: uid,
    players: publicPlayers(room),
    currentPlayers: room.players.length,
  });
}

/**
 * The buzzer. The server's clock decides when the match is over and who won, so every
 * screen shows the same result. The room then drops back to the lobby, unready, so the
 * same group can go again.
 */
/** Start the match: the server's clock, egg and buzzer take over from here. */
function startMatch(rc: string): void {
  const room = rooms.get(rc);
  if (!room || room.started) return;
  if (room.autoStart) clearTimeout(room.autoStart);
  room.autoStart = null;
  room.startsAt = null;
  room.started = true;
  room.serverStartTime = Date.now();
  room.match = new Match(room.serverStartTime);
  if (room.endTimer) clearTimeout(room.endTimer);
  // A little after the buzzer, so the last claims in flight still land.
  room.endTimer = setTimeout(() => finishMatch(rc), room.match.endAt - Date.now() + 150);
  // The live board: everyone's points once a second (a steal also sends one at once).
  if (room.scoreTimer) clearInterval(room.scoreTimer);
  room.scoreTimer = setInterval(() => {
    const m = room.match;
    if (m && !m.ended && Date.now() >= m.playAt) io.to(rc).emit('match-scores', { stats: m.scores() });
  }, 1000);
  io.to(rc).emit('game-started', {
    serverTime: room.serverStartTime,
    now: Date.now(),
    players: publicPlayers(room),
    mapId: room.mapId,
  });
}

function finishMatch(rc: string): void {
  const room = rooms.get(rc);
  if (!room?.match || room.match.ended) return;
  const result = room.match.finish();
  // The humans still in the room go on the all-time board; bots never do.
  recordMatch(result, room.players.map((p) => ({ userId: p.user_id, name: p.player_name })));
  room.match = null;
  room.endTimer = null;
  if (room.scoreTimer) clearInterval(room.scoreTimer);
  room.scoreTimer = null;
  room.started = false;
  room.serverStartTime = null;
  // A Quick Play group that stays together carries on as an ordinary room.
  room.quick = false;
  for (const p of room.players) p.is_ready = false;
  io.to(rc).emit('match-result', result);
  io.to(rc).emit('room-update', { room: { map_id: room.mapId }, players: publicPlayers(room), readyPlayers: 0 });
}

/** Find the live socket id for a user in a room (for targeted voice relay). */
function socketIdFor(room: Room, userId: string): string | null {
  const p = room.players.find((x) => x.user_id === userId && x.connected);
  return p ? p.socket_id : null;
}

/** True if `characterId` is already claimed by another player in the room. With 4
 *  characters and 4 max players, every player can hold a distinct one. */
function characterTaken(room: Room, characterId: unknown, exceptUserId?: string): boolean {
  const cid = Number(characterId);
  return room.players.some((p) => p.user_id !== exceptUserId && Number(p.character_id) === cid);
}

/** The player's preferred character if free, else the first unclaimed one (1-4). Used to
 *  auto-resolve a duplicate pick at join time so a join never fails on a clash. */
function resolveCharacter(room: Room, preferred: unknown): number {
  const pref = Number(preferred) || 1;
  if (!characterTaken(room, pref)) return pref;
  for (let i = 1; i <= 4; i++) if (!characterTaken(room, i)) return i;
  return pref;
}

// --- Abuse / DoS guards -----------------------------------------------------
/** Hard cap on concurrent rooms — bounds the in-memory store against a create-spam
 *  memory-exhaustion DoS. */
const MAX_ROOMS = 1000;
const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;

/** Clamp an untrusted string to a max length (drops payload-bloat griefing). */
function cleanStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
/** Finite number clamped to a sane range (drops NaN/Infinity/absurd coordinates). */
function cleanNum(v: unknown, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(max, Math.max(min, n));
}

/** True only if this socket is a live member of a real `roomCode` — the core guard that
 *  stops a client spoofing/griefing a room it never joined. */
function isRoomMember(socket: Socket<any, any, any, SocketData>, roomCode: unknown): roomCode is string {
  if (typeof roomCode !== 'string' || !ROOM_CODE_RE.test(roomCode)) return false;
  if (socket.data.roomCode !== roomCode) return false;
  const room = rooms.get(roomCode);
  return !!room && room.players.some((p) => p.user_id === socket.data.userId);
}

/** Membership guard that also allows a single-player `solo-<userId>` id (which has no
 *  Socket.IO fan-out, so it can't reach anyone else). Used by requests that both
 *  single-player and multiplayer make (bot lines, roasts). */
function canUseRoom(socket: Socket<any, any, any, SocketData>, roomCode: unknown): roomCode is string {
  if (typeof roomCode === 'string' && roomCode.startsWith('solo-')) return true;
  return isRoomMember(socket, roomCode);
}

/** Sliding-window per-socket rate limiter (keyed by socket id + action) — throttles room
 *  create/join floods. Entries are cleared on disconnect. */
const recentActions = new Map<string, number[]>();
function rateOk(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (recentActions.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { recentActions.set(key, arr); return false; }
  arr.push(now);
  recentActions.set(key, arr);
  return true;
}

// Allowed origins: comma-separated CORS_ORIGIN (e.g. "https://chase.example.com") in
// production; defaults to `true` (reflect any origin) for local dev / quick demos.
const corsOrigin: boolean | string[] = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : true;

// In production, reflecting any origin is a real risk — make the misconfig loud.
if (process.env.NODE_ENV === 'production' && corsOrigin === true) {
  console.warn('[security] CORS_ORIGIN is unset in production — reflecting ANY origin. Set CORS_ORIGIN to your site(s).');
}

// --- Express app (health checks + future REST endpoints) ---
const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
// Basic abuse guard on the HTTP routes (the socket has its own per-action limiter).
app.use(rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));
app.get('/', (_req, res) => {
  res.type('text/plain').send('chase socket ok');
});
/**
 * Liveness report, and the keepalive target. Render's free plan spins a service down
 * after ~15 minutes idle, so a cron can hit this every 10 minutes. Everything here is an
 * in-memory read, so it stays safe to hammer.
 */
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    rooms: rooms.size,
    uptime: process.uptime(),
    ai: { enabled: aiEnabled, provider: aiProviderName, model: AI_MODEL || null, lastReceipt: recentReceipts(1)[0] ?? null },
    leaderboard: leaderboardStore(),
    world: { enabled: worldEnabled },
  });
});

/**
 * The all-time leaderboard: best single match per player (hold, steals) and total wins.
 * `me` (the caller's own user id) only marks their row; other players' ids are never sent.
 */
app.get('/leaderboard', (req, res) => {
  const board = BOARDS.find((b) => b === req.query.board) ?? 'hold';
  const me = typeof req.query.me === 'string' ? req.query.me.slice(0, 64) : '';
  res.json({ ...leaderboard(board, me, 20, worldEnabled), verifiedOnly: worldEnabled, youVerified: worldEnabled && isVerified(me) });
});

/**
 * Receipts for the bots' recent AI lines on the 0G Compute Router: request id, provider
 * address and time. Empty on other providers. No prompts or lines.
 */
app.get('/ai/receipts', (_req, res) => {
  res.json({ provider: aiProviderName, receipts: recentReceipts() });
});

// --- World ID: one human, one row on the all-time board (off unless configured) --------
app.get('/world/config', (_req, res) => {
  res.json(worldConfig());
});

app.post('/world/rp-context', (_req, res) => {
  if (!worldEnabled) { res.status(404).json({ error: 'off' }); return; }
  res.json(rpContext());
});

app.post('/world/verify', express.json({ limit: '64kb' }), async (req, res) => {
  if (!worldEnabled) { res.status(404).json({ error: 'off' }); return; }
  const userId = typeof req.body?.userId === 'string' ? req.body.userId.slice(0, 64) : '';
  if (!userId) { res.status(400).json({ error: 'missing-player' }); return; }
  try {
    const proof = await verifyProof(req.body?.result);
    if (markVerified(userId, proof.nullifier) === 'taken') {
      res.status(409).json({ error: 'already-linked' });
      return;
    }
    const score = proof.sybilScore === undefined ? '' : `, sybil score ${proof.sybilScore}`;
    console.log(`[world] verified a player (${proof.credential}${score})`);
    res.json({ ok: true });
  } catch (err) {
    const code = err instanceof WorldError ? err.code : 'invalid';
    console.warn(`[world] verify failed (${code}):`, (err as Error).message);
    res.status(code === 'unreachable' ? 502 : 400).json({ error: code });
  }
});

void loadLeaderboard();
// Render sends SIGTERM before every deploy and restart: save the board's last changes first.
process.once('SIGTERM', () => {
  void flushLeaderboard().finally(() => process.exit(0));
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
  // Game/lobby payloads are tiny; cap the frame size to mitigate the socket.io
  // unbounded-binary-attachment advisory + memory-exhaustion via giant frames.
  maxHttpBufferSize: 1e5, // 100 KB
});

// --- Admin spectators --------------------------------------------------------
/**
 * Admins can watch any room without taking a seat. Identity is an email on the
 * ADMIN_EMAILS allowlist for now (a wallet address once the Web3 layer is back). Anyone can
 * type an email, so with ADMIN_PASSCODE set they need that too.
 */
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
);
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || '';
if (ADMIN_EMAILS.size > 0 && !ADMIN_PASSCODE) {
  console.warn('[admin] ADMIN_PASSCODE is unset: anyone who types an admin email can spectate.');
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

interface SocketData {
  userId: string | null;
  roomCode: string | null;
  /** Signed in as an admin (admin-login). */
  admin?: boolean;
  /** The room this admin is watching. Spectators are never in room.players. */
  spectating?: string | null;
}

io.on('connection', (socket: Socket<any, any, any, SocketData>) => {
  socket.data.userId = null;
  socket.data.roomCode = null;

  socket.on('create-room', (data: any) => {
    if (rooms.size >= MAX_ROOMS) {
      socket.emit('error', { message: 'Server is at capacity, try again shortly.' });
      return;
    }
    if (!rateOk(`${socket.id}:create`, 10, 60_000)) {
      socket.emit('error', { message: 'Slow down — too many rooms created.' });
      return;
    }
    if (typeof data?.userId !== 'string' || !data.userId) {
      socket.emit('error', { message: 'Invalid session.' });
      return;
    }
    const roomCode = genRoomCode();
    const player: LobbyPlayer = {
      id: `p-${socket.id.slice(0, 8)}`,
      player_name: cleanName(data.playerName) || 'Host',
      user_id: data.userId,
      is_ready: false,
      character_id: cleanNum(data.characterId, 1, 4) || 1,
      connected: true,
      socket_id: socket.id,
    };
    rooms.set(roomCode, newRoom(cleanStr(data.mapId, 16) || 'map-1', data.isPublic !== false, player));
    socket.data.userId = data.userId;
    socket.data.roomCode = roomCode;
    socket.join(roomCode);
    socket.emit('room-created', {
      roomCode,
      players: publicPlayers(rooms.get(roomCode)!),
      room: { map_id: data.mapId || 'map-1' },
    });
  });

  socket.on('join-room', (data: any) => {
    if (!rateOk(`${socket.id}:join`, 30, 60_000)) {
      socket.emit('error', { message: 'Slow down — too many join attempts.' });
      return;
    }
    if (typeof data?.userId !== 'string' || !data.userId || typeof data?.roomCode !== 'string') {
      socket.emit('error', { message: 'Invalid join request.' });
      return;
    }
    const room = rooms.get(data.roomCode);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    // Treat a join for a user already in the room as a reconnect (idempotent).
    const existing = room.players.find((p) => p.user_id === data.userId);
    if (existing) {
      const t = room.graceTimers.get(data.userId);
      if (t) { clearTimeout(t); room.graceTimers.delete(data.userId); }
      existing.connected = true;
      existing.socket_id = socket.id;
    } else {
      if (room.players.length >= 4) {
        socket.emit('error', { message: 'Room full' });
        return;
      }
      // Auto-resolve a duplicate character pick to the first free one so the join
      // never fails on a clash; the lobby picker lets them swap afterwards.
      room.players.push({
        id: `p-${socket.id.slice(0, 8)}`,
        player_name: uniqueName(cleanName(data.playerName) || 'Player', room.players.map((p) => p.player_name)),
        user_id: data.userId,
        is_ready: false,
        character_id: resolveCharacter(room, data.characterId),
        connected: true,
        socket_id: socket.id,
      });
    }
    socket.data.userId = data.userId;
    socket.data.roomCode = data.roomCode;
    socket.join(data.roomCode);
    io.to(data.roomCode).emit('player-joined', {
      players: publicPlayers(room),
      currentPlayers: room.players.length,
    });
    socket.emit('room-joined', {
      roomCode: data.roomCode,
      players: publicPlayers(room),
      room: { map_id: room.mapId },
      quick: room.quick,
      startsAt: room.startsAt,
      now: Date.now(),
    });
  });

  /**
   * Quick Play: drop the player into a Quick Play room that's still filling, or open a
   * new one. Quick rooms start themselves QUICK_WAIT_MS after they open (sooner when
   * full), and the empty seats are played by bots.
   */
  socket.on('quick-play', (data: any) => {
    if (!rateOk(`${socket.id}:join`, 30, 60_000)) {
      socket.emit('error', { message: 'Slow down — too many join attempts.' });
      return;
    }
    if (typeof data?.userId !== 'string' || !data.userId) {
      socket.emit('error', { message: 'Invalid session.' });
      return;
    }
    const now = Date.now();
    let rc: string | null = null;
    for (const [code, r] of rooms) {
      if (r.quick && !r.started && r.players.length < 4 && (r.startsAt ?? 0) - now > QUICK_JOIN_CUTOFF_MS) { rc = code; break; }
    }
    const player: LobbyPlayer = {
      id: `p-${socket.id.slice(0, 8)}`,
      player_name: cleanName(data.playerName) || 'Player',
      user_id: data.userId,
      is_ready: true, // nothing to ready up for; the timer starts it
      character_id: cleanNum(data.characterId, 1, 4) || 1,
      connected: true,
      socket_id: socket.id,
    };
    let room: Room;
    if (rc) {
      room = rooms.get(rc)!;
      player.character_id = resolveCharacter(room, player.character_id);
      player.player_name = uniqueName(player.player_name, room.players.map((p) => p.player_name));
      room.players.push(player);
    } else {
      if (rooms.size >= MAX_ROOMS) {
        socket.emit('error', { message: 'Server is at capacity, try again shortly.' });
        return;
      }
      rc = genRoomCode();
      room = newRoom('map-1', false, player, true);
      room.startsAt = now + QUICK_WAIT_MS;
      const code = rc;
      room.autoStart = setTimeout(() => startMatch(code), QUICK_WAIT_MS);
      rooms.set(rc, room);
    }
    socket.data.userId = data.userId;
    socket.data.roomCode = rc;
    socket.join(rc);
    io.to(rc).emit('player-joined', { players: publicPlayers(room), currentPlayers: room.players.length });
    socket.emit('room-joined', {
      roomCode: rc,
      players: publicPlayers(room),
      room: { map_id: room.mapId },
      quick: true,
      startsAt: room.startsAt,
      now: Date.now(),
    });
    // A full room doesn't need to wait; a short beat lets the last arrival see it.
    if (room.players.length >= 4) {
      const code = rc;
      if (room.autoStart) clearTimeout(room.autoStart);
      room.startsAt = Date.now() + 1500;
      io.to(rc).emit('room-update', { room: { map_id: room.mapId }, players: publicPlayers(room), startsAt: room.startsAt });
      room.autoStart = setTimeout(() => startMatch(code), 1500);
    }
  });

  /**
   * Reconnect / refresh recovery. The game client (a fresh socket after the
   * cross-origin handoff or a page refresh) calls this to re-attach to its room
   * without losing its slot or the in-progress match.
   */
  socket.on('rejoin-room', (data: { roomCode: string; userId: string }) => {
    const room = data?.roomCode ? rooms.get(data.roomCode) : null;
    if (!room) {
      socket.emit('rejoin-failed', { reason: 'room-gone' });
      return;
    }
    const player = room.players.find((p) => p.user_id === data.userId);
    if (!player) {
      socket.emit('rejoin-failed', { reason: 'slot-released' });
      return;
    }
    const t = room.graceTimers.get(data.userId);
    if (t) { clearTimeout(t); room.graceTimers.delete(data.userId); }
    player.connected = true;
    player.socket_id = socket.id;
    socket.data.userId = data.userId;
    socket.data.roomCode = data.roomCode;
    socket.join(data.roomCode);
    socket.emit('room-rejoined', {
      roomCode: data.roomCode,
      players: publicPlayers(room),
      room: { map_id: room.mapId },
      started: room.started,
      serverStartTime: room.serverStartTime,
      quick: room.quick,
      startsAt: room.startsAt,
      // A returning client resyncs the egg rather than trusting what it last saw.
      egg: room.match?.owner() ?? null,
      now: Date.now(),
    });
    socket.to(data.roomCode).emit('player-reconnected', {
      userId: data.userId,
      players: publicPlayers(room),
    });
  });

  socket.on('set-ready', ({ isReady, roomCode, userId }: { isReady: boolean; roomCode?: string; userId?: string }) => {
    const rc = roomCode || socket.data.roomCode;
    if (!rc) return;
    const room = rooms.get(rc);
    if (!room) return;
    const uid = userId || socket.data.userId;
    const p = room.players.find((x) => x.user_id === uid);
    if (!p) return;
    p.is_ready = !!isReady;
    // Re-bind this socket so later events resolve even after a lobby refresh/reconnect.
    socket.data.roomCode = rc;
    socket.data.userId = uid;
    socket.join(rc);
    const readyCount = room.players.filter((x) => x.is_ready).length;
    io.to(rc).emit('room-update', {
      room: { map_id: room.mapId },
      players: publicPlayers(room),
      readyPlayers: readyCount,
    });
    io.to(rc).emit('player-ready-update', {
      players: publicPlayers(room),
      readyCount,
      totalCount: room.players.length,
    });
  });

  // Lobby character swap. The server is the single source of truth for who holds which
  // character: reject if another player already claimed it (race), else apply + broadcast.
  socket.on('set-character', ({ roomCode, userId, characterId, playerName }: { roomCode?: string; userId?: string; characterId: number; playerName?: string }) => {
    const rc = roomCode || socket.data.roomCode;
    if (!rc) return;
    const room = rooms.get(rc);
    if (!room || room.started) return; // locked once the match begins
    const uid = userId || socket.data.userId;
    if (!uid) return;
    const p = room.players.find((x) => x.user_id === uid);
    if (!p) return;
    if (characterTaken(room, characterId, uid)) {
      socket.emit('character-taken', { characterId: Number(characterId) });
      return;
    }
    p.character_id = Number(characterId);
    // The player's chosen name (older clients still send their dino's).
    const name = cleanName(playerName);
    if (name) p.player_name = uniqueName(name, room.players.filter((x) => x !== p).map((x) => x.player_name));
    socket.data.roomCode = rc;
    socket.data.userId = uid;
    socket.join(rc);
    io.to(rc).emit('room-update', {
      room: { map_id: room.mapId },
      players: publicPlayers(room),
      readyPlayers: room.players.filter((x) => x.is_ready).length,
    });
    io.to(rc).emit('player-joined', { players: publicPlayers(room), currentPlayers: room.players.length });
  });

  socket.on('start-game', () => {
    const rc = socket.data.roomCode;
    if (!rc) return;
    const room = rooms.get(rc);
    if (!room || room.started) return;
    if (room.hostUserId !== socket.data.userId) {
      socket.emit('error', { message: 'Only the host can start the match.' });
      return;
    }

    startMatch(rc);
  });

  socket.on('get-public-rooms', () => {
    const list: Array<{ room_code: string; current_players: number; map_id: string }> = [];
    for (const [code, room] of rooms.entries()) {
      if (room.isPublic && !room.started && room.players.length < 4) {
        list.push({
          room_code: code,
          current_players: room.players.length,
          map_id: room.mapId,
        });
      }
    }
    socket.emit('public-rooms-list', list);
  });

  socket.on('get-room-state', ({ roomCode }: { roomCode: string }) => {
    const room = rooms.get(roomCode);
    if (!room) return;
    socket.emit('room-state-response', {
      room: { map_id: room.mapId },
      players: publicPlayers(room),
    });
  });

  socket.on('player-input', (payload: any) => {
    // Membership-gated + re-built from sanitized fields so a peer can't inject junk.
    // The sender is whoever this socket joined as, never what the payload claims.
    if (!isRoomMember(socket, payload?.roomCode)) return;
    const uid = socket.data.userId as string;
    const x = cleanNum(payload.x, -1e5, 1e5);
    const y = cleanNum(payload.y, -1e5, 1e5);
    const isInvincible = !!payload.isInvincible;
    rooms.get(payload.roomCode)?.match?.report(uid, x, y, isInvincible);
    socket.to(payload.roomCode).emit('player-input', {
      roomCode: payload.roomCode,
      userId: uid,
      x,
      y,
      vx: cleanNum(payload.vx, -1e5, 1e5),
      vy: cleanNum(payload.vy, -1e5, 1e5),
      isInvincible,
    });
  });

  // Fill-agent positions, broadcast by the room's agent-authority client so the other
  // clients can render the AI agents that are filling empty seats. Pure relay, like
  // player-input — the authority is the single source of truth for bot movement.
  socket.on('agent-state', (payload: any) => {
    if (!isRoomMember(socket, payload?.roomCode)) return;
    const match = rooms.get(payload.roomCode)?.match;
    if (match && Array.isArray(payload.agents)) {
      for (const a of payload.agents.slice(0, 4)) {
        const uid = cleanStr(a?.uid, 32);
        if (uid.startsWith('agent_')) match.report(uid, cleanNum(a.x, -1e5, 1e5), cleanNum(a.y, -1e5, 1e5), !!a.isInvincible);
      }
    }
    socket.to(payload.roomCode).emit('agent-state', payload);
  });

  /**
   * "I (or a bot I steer) just reached the egg / touched its holder." The server checks
   * the claim against the positions it has seen and, if it holds, tells the whole room
   * the new owner with a sequence number. A rejected claimer gets the current owner
   * back, so a client that guessed wrong corrects itself.
   */
  socket.on('egg-claim', (payload: any) => {
    const rc = payload?.roomCode;
    if (!isRoomMember(socket, rc)) return;
    if (!rateOk(`${socket.id}:claim`, 40, 1000)) return;
    const match = rooms.get(rc)?.match;
    if (!match) return;
    const claimer = cleanStr(payload.claimerId, 64);
    // You can claim for yourself, or for a fill-bot (whoever is steering them).
    if (claimer !== socket.data.userId && !claimer.startsWith('agent_')) return;
    const eggX = payload.eggX == null ? null : cleanNum(payload.eggX, -1e5, 1e5);
    const eggY = payload.eggY == null ? null : cleanNum(payload.eggY, -1e5, 1e5);
    const accepted = match.claim(claimer, eggX, eggY);
    if (accepted) {
      io.to(rc).emit('egg-owner', accepted);
      io.to(rc).emit('match-scores', { stats: match.scores() });
    } else {
      socket.emit('egg-owner', match.owner());
    }
  });

  /** A player (or a bot someone steers) used a power: relay it so everyone sees and feels it. */
  socket.on('power-used', (payload: any) => {
    const rc = payload?.roomCode;
    if (!isRoomMember(socket, rc)) return;
    if (!rateOk(`${socket.id}:power`, 12, 1000)) return;
    const userId = cleanStr(payload.userId, 64);
    if (userId !== socket.data.userId && !userId.startsWith('agent_')) return;
    const type = cleanStr(payload.type, 16);
    if (!['speed-boost', 'earthquake', 'shield', 'teleport'].includes(type)) return;
    socket.to(rc).emit('power-used', { userId, type, x: cleanNum(payload.x, -1e5, 1e5), y: cleanNum(payload.y, -1e5, 1e5) });
  });

  /** Clock sync: clients estimate their offset from the server's clock. */
  socket.on('time-sync', (_t0: unknown, ack?: (now: number) => void) => {
    if (typeof ack === 'function') ack(Date.now());
  });

  /**
   * A bot has something to say (it just stole the egg, lost it, is closing in, the round
   * is ending). Answers with one LLM line, or null, in which case the client uses its
   * own canned line. Solo asks for itself; online, the bot-steering client asks and then
   * shares the chosen line with bot-said.
   */
  socket.on('bot-line', async (payload: any, ack?: (res: { line: string | null }) => void) => {
    if (typeof ack !== 'function') return;
    if (!canUseRoom(socket, payload?.roomCode) || !rateOk(`${socket.id}:voice`, 6, 10_000)) { ack({ line: null }); return; }
    ack({ line: await botLine(payload ?? {}) });
  });

  /** Share a bot's line with the rest of the room, so everyone sees the same banter. */
  socket.on('bot-said', (payload: any) => {
    const rc = payload?.roomCode;
    if (!isRoomMember(socket, rc) || !rateOk(`${socket.id}:said`, 10, 10_000)) return;
    const uid = cleanStr(payload.uid, 32);
    const line = cleanStr(payload.line, 80);
    if (!uid.startsWith('agent_') || !line) return;
    socket.to(rc).emit('bot-said', { uid, line });
  });

  /** One line summing up the finished match for the results screen, or null. */
  socket.on('match-roast', async (payload: any, ack?: (res: { line: string | null; receipt?: { requestId: string; provider: string | null } | null }) => void) => {
    if (typeof ack !== 'function') return;
    if (!rateOk(`${socket.id}:roast`, 3, 30_000)) { ack({ line: null }); return; }
    const roast = await matchRoast(payload?.stats ?? [], payload?.winner);
    const r = roast?.receipt;
    ack({ line: roast?.line ?? null, receipt: r ? { requestId: r.requestId, provider: r.provider } : null });
  });

  /** Admin sign-in for spectating: an allowlisted email, plus the passcode when one is set. */
  socket.on('admin-login', (payload: any, ack?: (res: { ok: boolean; error?: string }) => void) => {
    if (typeof ack !== 'function') return;
    if (!rateOk(`${socket.id}:admin`, 5, 60_000)) { ack({ ok: false, error: 'Too many tries. Wait a minute.' }); return; }
    const email = cleanStr(payload?.email, 120).trim().toLowerCase();
    const ok = ADMIN_EMAILS.has(email) && (!ADMIN_PASSCODE || safeEqual(cleanStr(payload?.passcode, 200), ADMIN_PASSCODE));
    socket.data.admin = ok;
    if (!ok) console.warn(`[admin] refused sign-in for "${email}"`);
    ack(ok ? { ok: true } : { ok: false, error: "That email and passcode don't match an admin." });
  });

  /** Admins only: every room, live, for the spectator picker. */
  socket.on('admin-rooms', (ack?: (rooms: unknown[]) => void) => {
    if (typeof ack !== 'function') return;
    if (!socket.data.admin) { ack([]); return; }
    const now = Date.now();
    ack([...rooms.entries()].map(([code, room]) => ({
      code,
      players: room.players.map((p) => p.player_name),
      isPublic: room.isPublic,
      started: room.started,
      secondsLeft: room.match ? Math.max(0, Math.ceil((room.match.endAt - now) / 1000)) : null,
    })));
  });

  /**
   * Admins only: watch a room. The socket joins the room's broadcasts (positions, egg,
   * scores, results) but never its roster, so it takes no seat, can't send gameplay events
   * (isRoomMember fails) and never steers the bots. Safe to repeat: the scene asks again
   * once it has loaded, to pick up the egg and scores of a match already running.
   */
  socket.on('spectate', (payload: any, ack?: (res: unknown) => void) => {
    if (typeof ack !== 'function') return;
    if (!socket.data.admin) { ack({ ok: false, error: 'Sign in as an admin first.' }); return; }
    const rc = cleanStr(payload?.roomCode, 6).toUpperCase();
    const room = rooms.get(rc);
    if (!room) { ack({ ok: false, error: 'That room has closed.' }); return; }
    if (socket.data.spectating && socket.data.spectating !== rc) socket.leave(socket.data.spectating);
    socket.data.spectating = rc;
    socket.join(rc);
    ack({
      ok: true,
      roomCode: rc,
      mapId: room.mapId,
      players: publicPlayers(room),
      serverStartTime: room.serverStartTime,
      egg: room.match?.owner() ?? null,
      scores: room.match?.scores() ?? [],
    });
  });

  socket.on('stop-spectating', () => {
    if (socket.data.spectating) socket.leave(socket.data.spectating);
    socket.data.spectating = null;
  });

  // Lightweight RTT probe for the optional in-game net-stats overlay. Echoes the
  // client's timestamp straight back so the client can measure round-trip latency.
  socket.on('ping-check', (t: number) => socket.emit('pong-check', t));


  // --- Proximity voice chat: WebRTC signalling relay (room-scoped) ---
  socket.on('voice-join', ({ roomCode, userId }: { roomCode: string; userId: string }) => {
    const room = rooms.get(roomCode);
    if (!room || room.voiceBlocked.has(userId)) return;
    socket.join(`voice:${roomCode}`);
    // Tell the newcomer who's already in the voice channel so it can call them.
    const peers = [...room.voiceUsers].filter((u) => u !== userId);
    socket.emit('voice-peers', { peers });
    room.voiceUsers.add(userId);
    // Tell existing peers a new voice peer arrived (they answer incoming offers).
    socket.to(`voice:${roomCode}`).emit('voice-peer-joined', { userId });
  });

  socket.on('voice-leave', ({ roomCode, userId }: { roomCode: string; userId: string }) => {
    socket.leave(`voice:${roomCode}`);
    rooms.get(roomCode)?.voiceUsers.delete(userId);
    socket.to(`voice:${roomCode}`).emit('voice-peer-left', { userId });
  });

  /**
   * Report a player (today: for voice chat). Logged for moderation; when two different
   * players in the room have reported the same person, that person is dropped from the
   * room's voice channel for the rest of the room's life.
   */
  socket.on('report-player', (payload: { roomCode?: string; userId?: string; reason?: string }) => {
    const rc = payload?.roomCode;
    if (!isRoomMember(socket, rc) || !rateOk(`${socket.id}:report`, 5, 60_000)) return;
    const room = rooms.get(rc)!;
    const target = cleanStr(payload.userId, 64);
    const reporter = socket.data.userId as string;
    if (!target || target === reporter || !room.players.some((p) => p.user_id === target)) return;
    const by = room.reports.get(target) ?? new Set<string>();
    by.add(reporter);
    room.reports.set(target, by);
    console.warn(`[report] room=${rc} reported=${target} by=${reporter} reason=${cleanStr(payload.reason, 16) || 'unspecified'} count=${by.size}`);
    if (by.size >= 2 && !room.voiceBlocked.has(target)) {
      room.voiceBlocked.add(target);
      room.voiceUsers.delete(target);
      io.to(`voice:${rc}`).emit('voice-peer-left', { userId: target });
      const sid = socketIdFor(room, target);
      if (sid) io.to(sid).emit('voice-blocked');
    }
  });

  // Relay an SDP/ICE message to a specific peer in the room.
  socket.on('voice-signal', (payload: { roomCode: string; from: string; to: string; data: any }) => {
    const room = payload?.roomCode ? rooms.get(payload.roomCode) : null;
    if (!room) return;
    const targetSocket = socketIdFor(room, payload.to);
    if (targetSocket) {
      io.to(targetSocket).emit('voice-signal', {
        from: payload.from,
        to: payload.to,
        data: payload.data,
      });
    }
  });

  // Explicit leave (from the lobby "Leave Room" button). Removes the player from the
  // room immediately WITHOUT tearing down the socket, so the client can create/join
  // another room afterwards.
  socket.on('leave-room', () => {
    const rc = socket.data.roomCode;
    const uid = socket.data.userId;
    socket.data.roomCode = null;
    if (!rc || !uid) return;
    socket.leave(rc);
    const room = rooms.get(rc);
    if (!room) return;
    const t = room.graceTimers.get(uid);
    if (t) { clearTimeout(t); room.graceTimers.delete(uid); }
    room.voiceUsers.delete(uid);
    removePlayer(rc, room, uid);
  });

  socket.on('disconnect', () => {
    recentActions.delete(`${socket.id}:create`);
    recentActions.delete(`${socket.id}:join`);
    const rc = socket.data.roomCode;
    const uid = socket.data.userId;
    if (!rc || !uid) return;
    const room = rooms.get(rc);
    if (!room) return;
    const player = room.players.find((p) => p.user_id === uid);
    // Ignore a stale socket whose slot was already taken over by a newer one.
    if (!player || player.socket_id !== socket.id) return;

    player.connected = false;
    room.voiceUsers.delete(uid);
    // Let peers show a "reconnecting" indicator and tear down voice immediately.
    io.to(rc).emit('player-disconnected', { userId: uid, players: publicPlayers(room) });
    socket.to(`voice:${rc}`).emit('voice-peer-left', { userId: uid });

    // Hold the slot open; only release it if they don't return in time.
    const existing = room.graceTimers.get(uid);
    if (existing) clearTimeout(existing);
    room.graceTimers.set(
      uid,
      setTimeout(() => {
        room.graceTimers.delete(uid);
        const stillGone = room.players.find((p) => p.user_id === uid);
        if (!stillGone || stillGone.connected) return;
        removePlayer(rc, room, uid);
      }, RECONNECT_GRACE_MS),
    );
  });
});

// Fail clean on a busy port (a leftover dev instance) instead of dumping an unhandled
// 'error' event stack trace. The tsx watcher restarts; one clear line is enough.
httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[chase-server] Port ${PORT} is already in use — another instance is running. Free it with: npx kill-port ${PORT}`);
    process.exit(1);
  }
  throw err;
});

httpServer.listen(PORT, () => {
  console.log(`[chase-server] Express + Socket.IO listening on http://localhost:${PORT}`);
  void aiSmokeTest();
});

/**
 * Non-fatal boot check: prove the LLM provider is reachable and time one round-trip.
 * Never throws — a failed smoke test just means agents start on local tactics until
 * the provider recovers.
 */
async function aiSmokeTest(): Promise<void> {
  const llm = getAiClient();
  if (!llm) {
    console.warn('[ai] smoke test skipped — no provider configured.');
    return;
  }
  const started = Date.now();
  try {
    const r = await llm.chat.completions.create(
      { model: AI_MODEL, messages: [{ role: 'user', content: 'Reply with the single word: ok' }], max_tokens: 16 },
      { timeout: 8000, maxRetries: 0 },
    );
    const reply = r.choices?.[0]?.message?.content?.trim() ?? '';
    console.log(`[ai] ${aiProviderName} reachable ✓ model=${AI_MODEL} latency=${Date.now() - started}ms reply="${reply}"`);
  } catch (err) {
    console.warn(`[ai] smoke test FAILED (${Date.now() - started}ms):`, (err as Error).message);
  }
}
