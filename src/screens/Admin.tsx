import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, LogOut } from 'lucide-react';
import { useSocket, type LobbyPlayer } from '@/providers/SocketProvider';
import { useGameStore } from '@/store/gameStore';
import { usePageTitle } from '@/hooks/usePageTitle';
import { adminLogin, adminSignOut, isAdminSignedIn } from '@/lib/adminSession';
import { clearMatchConfig } from '@/lib/matchConfig';
import { matchPoints } from '@/lib/scoring';
import { characters } from '@/data/characters';
import { gameMaps } from '@/data/maps';

interface RoomInfo { code: string; players: string[]; isPublic: boolean; started: boolean; secondsLeft: number | null }
interface SpectateAck { ok: boolean; error?: string; mapId?: string; players?: LobbyPlayer[]; serverStartTime?: number | null }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Admin-only spectator mode: sign in, pick a live room, and watch its matches on any
 * screen without taking a seat. Between matches it shows the last result and waits;
 * RoomWatcher brings it back into the game when the host starts the next one.
 */
export default function Admin() {
  const navigate = useNavigate();
  const { socket, ensureConnected } = useSocket();
  const [signedIn, setSignedIn] = useState(isAdminSignedIn);
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const spectating = useGameStore((s) => s.spectating);
  const roomCode = useGameStore((s) => s.roomCode);
  const players = useGameStore((s) => s.players);
  const winner = useGameStore((s) => s.winner);
  usePageTitle('Admin');

  // Live rooms, refreshed every 3 seconds while picking.
  useEffect(() => {
    if (!signedIn || spectating || !socket) return;
    const load = () => socket.timeout(4000).emit('admin-rooms', (err: unknown, list?: RoomInfo[]) => {
      if (!err && Array.isArray(list)) setRooms(list);
    });
    load();
    const t = window.setInterval(load, 3000);
    return () => window.clearInterval(t);
  }, [signedIn, spectating, socket]);

  // The last match in the watched room, best first (the hidden spectator dino left out).
  const lastMatch = useMemo(
    () => players
      .filter((p) => p.id !== 'player')
      .map((p) => ({ ...p, points: matchPoints(p.eggHeldMs ?? 0, p.steals ?? 0, p.id === winner?.id) }))
      .sort((a, b) => b.points - a.points),
    [players, winner?.id],
  );

  const signIn = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (!socket || !(await ensureConnected())) {
      setBusy(false);
      setError("Can't reach the server.");
      return;
    }
    const res = await adminLogin(socket, email.trim(), passcode);
    setBusy(false);
    if (res.ok) setSignedIn(true);
    else setError(res.error ?? 'Not an admin.');
  };

  const watch = (code: string) => {
    if (!socket) return;
    setError(null);
    socket.timeout(5000).emit('spectate', { roomCode: code }, (err: unknown, res?: SpectateAck) => {
      if (err || !res?.ok) { setError(res?.error ?? "The server didn't answer."); return; }
      const store = useGameStore.getState();
      // A refresh mid-watch goes home rather than into a seat we don't have.
      clearMatchConfig();
      store.resetMatch();
      store.initUserId();
      store.setGameMode('multiplayer');
      store.setRoomCode(code);
      store.setRoomPlayers(res.players ?? []);
      store.setMap(gameMaps.find((m) => m.id === res.mapId) || gameMaps[0]);
      // The scene builds a local dino for every client; a spectator's stays hidden.
      if (!store.selectedCharacter) store.setCharacter(characters[0]);
      store.setServerStartTime(res.serverStartTime ?? null);
      store.setSpectating(true);
      // A match already running: straight in. Otherwise RoomWatcher brings us in at the start.
      if (res.serverStartTime) navigate('/game');
    });
  };

  const stopWatching = () => {
    socket?.emit('stop-spectating');
    const store = useGameStore.getState();
    store.setSpectating(false);
    store.setRoomCode(null);
    store.resetMatch();
  };

  const signOut = () => {
    stopWatching();
    adminSignOut();
    setSignedIn(false);
    setRooms(null);
  };

  const heading = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="pixel-button flex h-10 w-10 items-center justify-center !p-0"
        aria-label="Back to the main menu"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="px-heading flex-1 text-lg sm:text-2xl" style={{ color: '#ffc93c', textShadow: '3px 3px 0 #11111c' }}>
        Spectate
      </h1>
      {signedIn && (
        <button type="button" onClick={signOut} className="px-chip flex items-center gap-1.5 px-3 py-2" aria-label="Sign out">
          <LogOut className="h-4 w-4 text-[#e8503a]" />
          <span className="px-heading text-[8px] uppercase tracking-wider text-[#f4e7c3]">Sign out</span>
        </button>
      )}
    </div>
  );

  return (
    <main className="h-[100dvh] w-full overflow-y-auto bg-[#14141f] px-4 py-4 short:py-2">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3 short:gap-2">
        {heading}

        {!signedIn ? (
          <form onSubmit={signIn} className="px-panel flex flex-col gap-3 p-4">
            <p className="text-sm text-[#f4e7c3]/80">Admins only. Sign in to watch any live match without taking a seat.</p>
            <label className="flex flex-col gap-1">
              <span className="px-heading text-[9px] uppercase tracking-wider text-[#9fb0d8]">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pixel-border bg-[#261309] px-3 py-2 text-[#f4e7c3] outline-none focus:border-[#ffc93c]"
                data-testid="admin-email"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="px-heading text-[9px] uppercase tracking-wider text-[#9fb0d8]">Passcode</span>
              <input
                type="password"
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="pixel-border bg-[#261309] px-3 py-2 text-[#f4e7c3] outline-none focus:border-[#ffc93c]"
                data-testid="admin-passcode"
              />
            </label>
            <button type="submit" disabled={busy} className="pixel-button py-2 disabled:opacity-60" data-testid="admin-sign-in">
              {busy ? 'Checking…' : 'Sign in'}
            </button>
          </form>
        ) : spectating && roomCode ? (
          <div className="px-panel flex flex-col gap-3 p-4">
            <p className="px-heading text-xs uppercase tracking-wider text-[#f4e7c3]">
              Watching <span className="text-[#ffc93c]">{roomCode}</span>
            </p>
            <p className="text-sm text-[#f4e7c3]/80">The next match opens here as soon as the host starts it.</p>
            {lastMatch.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="px-heading text-[8px] uppercase tracking-[0.2em] text-[#9fb0d8]">Last match</span>
                {lastMatch.map((p, i) => (
                  <div key={p.id} className={`flex items-center justify-between gap-3 px-2 py-1.5 pixel-border ${i === 0 ? 'bg-[#804d2e]' : 'bg-[#4d2813]'}`}>
                    <span className="truncate text-sm font-black text-white">
                      #{i + 1} {p.character.name}{p.id === winner?.id ? ' 🥚' : ''}
                    </span>
                    <span className="shrink-0 text-sm font-black tabular-nums text-amber-300">{p.points} pts</span>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={stopWatching} className="pixel-button py-2">Stop watching</button>
          </div>
        ) : (
          <div className="px-panel flex flex-col gap-2 p-4">
            <span className="px-heading text-[8px] uppercase tracking-[0.2em] text-[#9fb0d8]">Live rooms</span>
            {rooms === null ? (
              <p className="text-sm text-[#f4e7c3]/80">Loading…</p>
            ) : rooms.length === 0 ? (
              <p className="text-sm text-[#f4e7c3]/80">No rooms open right now.</p>
            ) : (
              rooms.map((r) => (
                <div key={r.code} className="flex items-center justify-between gap-3 px-2 py-2 pixel-border bg-[#4d2813]">
                  <div className="min-w-0">
                    <p className="px-heading text-[10px] text-[#ffc93c]">
                      {r.code} <span className="text-[#9fb0d8]">· {r.started && r.secondsLeft !== null ? `in match, ${fmt(r.secondsLeft)} left` : 'in the lobby'}</span>
                    </p>
                    <p className="truncate text-sm text-[#f4e7c3]">{r.players.join(', ') || 'Empty'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => watch(r.code)}
                    className="px-chip flex shrink-0 items-center gap-1.5 px-3 py-2"
                    data-testid={`admin-watch-${r.code}`}
                  >
                    <Eye className="h-4 w-4 text-[#5fcde4]" />
                    <span className="px-heading text-[8px] uppercase tracking-wider text-[#f4e7c3]">Watch</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {error && <p className="text-center text-sm text-[#e8503a]" role="alert">{error}</p>}
      </div>
    </main>
  );
}
