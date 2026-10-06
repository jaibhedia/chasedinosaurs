import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bot, Check, Copy, Globe, Link2, Lock, Play, Share2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ComingSoon } from '@/components/ComingSoon';
import { DinoSprite } from '@/components/DinoSprite';
import { useGameStore } from '@/store/gameStore';
import { useSocket, type LobbyPlayer } from '@/providers/SocketProvider';
import { characters } from '@/data/characters';
import { gameMaps } from '@/data/maps';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getServerOffset } from '@/lib/socketBridge';
import { copyText } from '@/lib/clipboard';
import { extractRoomCode, inviteLink } from '@/lib/roomCode';

interface PublicRoom {
  room_code: string;
  current_players: number;
  map_id: string;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const charNum = (c: { id: string }) => parseInt(c.id.split('-')[1], 10);

/**
 * Multiplayer: create a room, join by code or from the public list, or (with `quick`)
 * matchmake into a Quick Play room that starts itself with bots in the empty seats.
 */
export default function Lobby({ quick = false }: { quick?: boolean }) {
  const navigate = useNavigate();
  const params = useParams<{ code?: string }>();
  usePageTitle(quick ? 'Quick Play' : 'Multiplayer lobby');

  const {
    selectedCharacter, setCharacter, setGameMode, setQuickPlay,
    setRoomCode: setStoreRoomCode, userId: storeUserId, initUserId, roomCode: storeRoomCode,
  } = useGameStore();
  const { socket, ensureConnected, createRoom, joinRoom, quickPlay, setPlayerReady, chooseCharacter, startGame, leaveRoom } = useSocket();

  const [roomCode, setRoomCode] = useState(extractRoomCode(params.code ?? ''));
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);
  const [error, setError] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [charNotice, setCharNotice] = useState('');
  /** Which copy/share button just worked, for its "Copied!" label. */
  const [copied, setCopied] = useState<'code' | 'link' | 'share' | 'failed' | null>(null);
  const autoJoinTried = useRef(false);
  const rejoinTried = useRef(false);
  const quickTried = useRef(false);
  const [quickRoom, setQuickRoom] = useState(false);
  /** Server time a Quick Play room starts. */
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const userId = storeUserId || initUserId();

  useEffect(() => {
    setGameMode('multiplayer');
    if (!selectedCharacter) setCharacter(characters[0]);
  }, [setGameMode, selectedCharacter, setCharacter]);

  // Roster + start events.
  useEffect(() => {
    if (!socket) return;
    const onRoster = ({ players: list, startsAt: at }: { players?: LobbyPlayer[]; startsAt?: number | null }) => {
      if (Array.isArray(list)) setPlayers([...list]);
      if (typeof at === 'number') setStartsAt(at);
    };
    const onRoomState = ({ players: list }: { players?: LobbyPlayer[] }) => {
      if (!Array.isArray(list)) return;
      // Only re-render when something actually changed.
      setPlayers((prev) => {
        const sig = (l: LobbyPlayer[]) => l.map((p) => `${p.user_id}:${p.character_id}:${p.is_ready}:${p.connected}`).join('|');
        return sig(prev) === sig(list) ? prev : list;
      });
    };
    const onPublicRooms = (rooms: PublicRoom[]) => setPublicRooms(Array.isArray(rooms) ? rooms : []);
    const onCharTaken = () => setCharNotice('That dino was just taken. Pick another.');

    socket.on('player-joined', onRoster);
    socket.on('player-left', onRoster);
    socket.on('room-update', onRoster);
    socket.on('player-ready-update', onRoster);
    socket.on('player-disconnected', onRoster);
    socket.on('player-reconnected', onRoster);
    socket.on('room-state-response', onRoomState);
    socket.on('public-rooms-list', onPublicRooms);
    socket.on('character-taken', onCharTaken);
    return () => {
      socket.off('player-joined', onRoster);
      socket.off('player-left', onRoster);
      socket.off('room-update', onRoster);
      socket.off('player-ready-update', onRoster);
      socket.off('player-disconnected', onRoster);
      socket.off('player-reconnected', onRoster);
      socket.off('room-state-response', onRoomState);
      socket.off('public-rooms-list', onPublicRooms);
      socket.off('character-taken', onCharTaken);
    };
  }, [socket]);

  // The server may auto-resolve a duplicate pick on join; mirror its choice locally,
  // since the scene reads the local player's sprite from the store.
  useEffect(() => {
    if (!isInRoom) return;
    const mine = players.find((p) => p.user_id === userId);
    if (!mine) return;
    const ch = characters.find((c) => charNum(c) === Number(mine.character_id));
    if (ch && ch.id !== selectedCharacter?.id) setCharacter(ch);
  }, [players, userId, isInRoom, selectedCharacter?.id, setCharacter]);

  // Poll the public list while browsing, and the room state while in a room.
  useEffect(() => {
    if (!socket) return;
    if (!isInRoom) {
      socket.emit('get-public-rooms');
      const t = setInterval(() => socket.emit('get-public-rooms'), 3000);
      return () => clearInterval(t);
    }
    const t = setInterval(() => socket.emit('get-room-state', { roomCode }), 2000);
    return () => clearInterval(t);
  }, [socket, isInRoom, roomCode]);

  const enterRoom = (code: string, list: LobbyPlayer[], info?: { quick?: boolean; startsAt?: number | null }) => {
    setRoomCode(code);
    setStoreRoomCode(code);
    setPlayers(list ?? []);
    setQuickRoom(!!info?.quick);
    setQuickPlay(!!info?.quick);
    setStartsAt(info?.startsAt ?? null);
    setIsInRoom(true);
  };

  // Quick Play countdown.
  useEffect(() => {
    if (!startsAt) return;
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [startsAt]);

  // Quick Play: matchmake once on arrival.
  const runQuickPlay = async () => {
    const character = selectedCharacter ?? characters[0];
    setBusy('join');
    setError('');
    if (storeRoomCode) { leaveRoom(); setStoreRoomCode(null); }
    if (!(await ensureConnected())) {
      setError("Can't reach the game server. Check your connection, or play solo for now.");
      setBusy(null);
      return;
    }
    try {
      const res = await quickPlay({ userId, characterId: charNum(character), playerName: character.name });
      enterRoom(res.roomCode, res.players, res);
    } catch (err) {
      setError((err as Error).message || 'Could not find a match.');
    } finally {
      setBusy(null);
    }
  };
  useEffect(() => {
    if (!quick || !socket || quickTried.current) return;
    quickTried.current = true;
    void runQuickPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick, socket]);

  // Coming back from a match: the room is still ours, so go straight to its waiting room.
  useEffect(() => {
    if (!socket || !storeRoomCode || rejoinTried.current || params.code || quick) return;
    rejoinTried.current = true;
    const code = storeRoomCode;
    const onRejoined = (res: { roomCode: string; players: LobbyPlayer[]; started: boolean; quick?: boolean; startsAt?: number | null }) => {
      socket.off('rejoin-failed', onFailed);
      if (res.started) return; // a match is running; the play screen handles that
      enterRoom(res.roomCode, res.players, res);
    };
    const onFailed = () => {
      socket.off('room-rejoined', onRejoined);
      setStoreRoomCode(null);
    };
    socket.once('room-rejoined', onRejoined);
    socket.once('rejoin-failed', onFailed);
    socket.emit('rejoin-room', { roomCode: code, userId });
    return () => {
      socket.off('room-rejoined', onRejoined);
      socket.off('rejoin-failed', onFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, storeRoomCode]);

  const handleCreate = async () => {
    const character = selectedCharacter ?? characters[0];
    setBusy('create');
    setError('');
    if (!(await ensureConnected())) {
      setError("Can't reach the game server. Check your connection and try again.");
      setBusy(null);
      return;
    }
    try {
      const res = await createRoom({
        userId,
        mapId: gameMaps[0].id,
        characterId: charNum(character),
        playerName: character.name,
        isPublic,
      });
      enterRoom(res.roomCode, res.players);
    } catch (err) {
      setError((err as Error).message || 'Could not create a room.');
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async (codeIn?: string) => {
    const code = extractRoomCode(codeIn ?? roomCode);
    if (!code) { setError('Enter a room code.'); return; }
    if (code.length !== 6) { setError('Room codes are 6 characters.'); return; }
    const character = selectedCharacter ?? characters[0];
    setBusy('join');
    setError('');
    if (!(await ensureConnected())) {
      setError("Can't reach the game server. Check your connection and try again.");
      setBusy(null);
      return;
    }
    try {
      const res = await joinRoom({ roomCode: code, userId, characterId: charNum(character), playerName: character.name });
      enterRoom(res.roomCode ?? code, res.players, res);
    } catch (err) {
      const msg = (err as Error).message;
      setStoreRoomCode(null);
      if (msg === 'Room not found') {
        setPublicRooms((prev) => prev.filter((r) => r.room_code !== code));
        setError('No room with that code. It may have closed.');
      } else if (msg === 'Room full') {
        setError('That room is full.');
      } else {
        setError(msg || 'Could not join that room.');
      }
    } finally {
      setBusy(null);
    }
  };

  // /join/ABC123 links drop you straight into the room.
  useEffect(() => {
    if (!params.code || autoJoinTried.current || !socket) return;
    autoJoinTried.current = true;
    void handleJoin(extractRoomCode(params.code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code, socket]);

  const leave = () => {
    leaveRoom();
    setIsInRoom(false);
    setPlayers([]);
    setStoreRoomCode(null);
    setRoomCode('');
    setQuickRoom(false);
    setStartsAt(null);
    if (quick) navigate('/play');
  };

  const flash = (what: 'code' | 'link' | 'share' | 'failed') => {
    setCopied(what);
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 1800);
  };
  // Copy exactly one thing: the code alone, or the link alone. The old single button
  // opened the share sheet on every device that had one (Macs included), and a shared
  // "Join my room: CODE" message pasted into the code box came out as "JOIN M".
  const copyCode = async () => flash((await copyText(roomCode)) ? 'code' : 'failed');
  const copyLink = async () => flash((await copyText(inviteLink(roomCode))) ? 'link' : 'failed');
  const canShare = typeof navigator.share === 'function' && window.matchMedia?.('(pointer: coarse)').matches;
  const shareInvite = async () => {
    try {
      await navigator.share({ title: 'Chase Dinosaurs', text: `Play Chase Dinosaurs with me. Room code: ${roomCode}`, url: inviteLink(roomCode) });
      flash('share');
    } catch { /* share sheet dismissed */ }
  };

  const me = players.find((p) => p.user_id === userId);
  // The server names the host, and hands the role on if the host leaves.
  const isHost = !!me?.host;
  const isReady = !!me?.is_ready;
  const allReady = players.length > 0 && players.every((p) => p.is_ready);
  const canStart = players.length >= MIN_PLAYERS && allReady;
  const myCharNum = me ? Number(me.character_id) : selectedCharacter ? charNum(selectedCharacter) : null;
  const takenByOthers = new Set(players.filter((p) => p.user_id !== userId).map((p) => Number(p.character_id)));

  const pickCharacter = (c: (typeof characters)[number]) => {
    const cn = charNum(c);
    if (cn === myCharNum || takenByOthers.has(cn)) return;
    setCharNotice('');
    setCharacter(c);
    chooseCharacter(cn, c.name, roomCode, userId);
  };

  const shell = 'h-[100dvh] w-full px-solid-bg flex flex-col overflow-y-auto p-3 md:p-4';
  const chip = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-[#4d2813] pixel-border text-sm font-semibold text-[#ffc93c] hover:brightness-110';
  const shellStyle = {
    paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 0.75rem)',
    paddingRight: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
  };

  if (!isInRoom && quick) {
    return (
      <div className={shell} style={shellStyle}>
        <div className="w-full max-w-md mx-auto my-auto pixel-panel p-5 text-center space-y-4">
          <Zap className="w-10 h-10 mx-auto text-[#ffc93c]" />
          <h1 className="text-lg md:text-2xl title-pixel">Quick Play</h1>
          {error ? (
            <>
              <p className="text-red-300 font-semibold" data-testid="lobby-error">{error}</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => void runQuickPlay()}>Try again</Button>
                <Button variant="secondary" onClick={() => navigate('/solo')}>Play solo</Button>
              </div>
            </>
          ) : (
            <p className="text-[#f4e7c3]/80">Finding a match…</p>
          )}
          <Button variant="outline" onClick={() => navigate('/play')} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>
      </div>
    );
  }

  if (!isInRoom) {
    return (
      <div className={shell} style={shellStyle}>
        <div className="w-full max-w-6xl mx-auto my-auto">
          <h1 className="text-xl md:text-3xl short:text-lg title-pixel text-center mb-4 md:mb-8 short:mb-2">Multiplayer</h1>

          <div className="grid grid-cols-3 gap-2 md:gap-6 mb-4 md:mb-6">
            {/* Create */}
            <div className="p-3 md:p-6 pixel-panel flex flex-col">
              <h2 className="pixel-font text-sm md:text-xl short:text-xs text-[#f4e7c3] mb-2 md:mb-4 short:mb-2">Create room</h2>
              <div className="grid grid-cols-2 gap-1.5 md:gap-2 mb-2 md:mb-4">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  aria-pressed={isPublic}
                  className={`flex flex-col items-center gap-1 p-1.5 md:p-3 pixel-border transition-all ${isPublic ? 'bg-[#6ab04c] text-[#0e2a08]' : 'bg-[#4d2813] text-[#f4e7c3]/60'}`}
                >
                  <Globe className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="font-bold text-xs md:text-sm uppercase">Public</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  aria-pressed={!isPublic}
                  className={`flex flex-col items-center gap-1 p-1.5 md:p-3 pixel-border transition-all ${!isPublic ? 'bg-[#ffc93c] text-[#2b2410]' : 'bg-[#4d2813] text-[#f4e7c3]/60'}`}
                >
                  <Lock className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="font-bold text-xs md:text-sm uppercase">Private</span>
                </button>
              </div>
              <p className="hidden md:block short:hidden text-[#f4e7c3]/60 text-sm mb-4 flex-1">
                {isPublic ? 'Anyone can find it in the public list.' : 'Only people with the code can join.'}
              </p>
              <Button onClick={handleCreate} disabled={busy !== null} className="w-full mt-auto" data-testid="lobby-create">
                {busy === 'create' ? 'Creating…' : 'Create'}
              </Button>
            </div>

            {/* Join by code */}
            <div className="p-3 md:p-6 pixel-panel flex flex-col">
              <h2 className="pixel-font text-sm md:text-xl short:text-xs text-[#f4e7c3] mb-2 md:mb-4 short:mb-2">Join with code</h2>
              <input
                type="text"
                value={roomCode}
                // No maxLength: it cut a pasted message or link to its first 6 letters
                // before we could pull the code out of it.
                onChange={(e) => { setRoomCode(extractRoomCode(e.target.value)); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleJoin(); }}
                placeholder="CODE"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                data-testid="lobby-code"
                className="w-full px-2 py-2 md:py-3 bg-[#4d2813] border-4 border-[#261309] text-[#f4e7c3] text-center text-lg md:text-xl font-bold mb-2 md:mb-4 uppercase tracking-widest focus:outline-none focus:border-[#ffc93c] select-text"
              />
              <Button onClick={() => void handleJoin()} disabled={busy !== null || !roomCode.trim()} className="w-full mt-auto" data-testid="lobby-join">
                {busy === 'join' ? 'Joining…' : 'Join'}
              </Button>
            </div>

            {/* Public rooms */}
            <div className="p-3 md:p-6 pixel-panel flex flex-col">
              <h2 className="pixel-font text-sm md:text-xl short:text-xs text-[#f4e7c3] mb-2 md:mb-4 short:mb-2">Public rooms</h2>
              <div className="flex-1 space-y-1.5 md:space-y-2 max-h-40 md:max-h-56 overflow-y-auto">
                {publicRooms.length === 0 && (
                  <p className="text-[#f4e7c3]/60 text-sm">None open right now. Create one!</p>
                )}
                {publicRooms.map((room) => (
                  <button
                    key={room.room_code}
                    type="button"
                    disabled={busy !== null || room.current_players >= MAX_PLAYERS}
                    onClick={() => void handleJoin(room.room_code)}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-[#4d2813] pixel-border text-left hover:brightness-110 disabled:opacity-50"
                  >
                    <span className="font-bold text-[#f4e7c3] tracking-widest">{room.room_code}</span>
                    <span className="inline-flex items-center gap-1 text-sm text-[#ffc93c]">
                      {room.current_players}/{MAX_PLAYERS} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border-2 border-red-500">
              <p className="text-red-300 text-center font-semibold" data-testid="lobby-error">{error}</p>
            </div>
          )}

          <div className="text-center">
            <Button variant="outline" onClick={() => navigate('/play')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={shell} style={shellStyle}>
      <div className="w-full max-w-5xl mx-auto my-auto grid md:grid-cols-2 gap-3 md:gap-6">
        {/* Left: room + roster */}
        <div className="space-y-3 md:space-y-4">
          {quickRoom ? (
          <div className="p-3 md:p-5 pixel-panel text-center" data-testid="quick-header">
            <p className="text-[#f4e7c3]/70 text-sm">Quick Play</p>
            <p className="text-2xl md:text-4xl font-bold text-[#ffc93c]" data-testid="quick-countdown">
              {startsAt ? `Starting in ${Math.max(0, Math.ceil((startsAt - (Date.now() + getServerOffset())) / 1000))}` : 'Starting…'}
            </p>
            <p className="text-sm text-[#f4e7c3]/70">Bots take any empty seats.</p>
          </div>
          ) : (
          <div className="p-3 md:p-5 pixel-panel text-center">
            <p className="text-[#f4e7c3]/70 text-sm">Room code</p>
            {/* select-all: one tap selects the whole code, for when copying is blocked. */}
            <p className="text-3xl md:text-5xl font-bold text-[#f4e7c3] tracking-[0.3em] pl-[0.3em] select-all" style={{ WebkitTouchCallout: 'default' }} data-testid="room-code">{roomCode}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 md:gap-2">
              <button type="button" onClick={() => void copyCode()} className={chip} data-testid="copy-code">
                {copied === 'code' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'code' ? 'Copied!' : 'Copy code'}
              </button>
              <button type="button" onClick={() => void copyLink()} className={chip} data-testid="copy-link">
                {copied === 'link' ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                {copied === 'link' ? 'Copied!' : 'Copy invite link'}
              </button>
              {canShare && (
                <button type="button" onClick={() => void shareInvite()} className={chip} data-testid="share-invite">
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
              )}
            </div>
            {copied === 'failed' && (
              <p className="mt-1 text-sm text-[#ffb36b]">Couldn't copy. Tap and hold the code to copy it.</p>
            )}
          </div>
          )}

          <div className="p-3 md:p-5 pixel-panel">
            <div className="flex items-center justify-between mb-2 md:mb-3">
              <h3 className="pixel-font text-sm md:text-lg text-[#f4e7c3]">Players {players.length}/{MAX_PLAYERS}</h3>
              {!quickRoom && (
                <span className={`text-sm ${players.length >= MIN_PLAYERS ? 'text-[#6ab04c]' : 'text-[#ffc93c]'}`}>
                  {players.length >= MIN_PLAYERS ? 'Bots fill empty seats' : `Need ${MIN_PLAYERS - players.length} more`}
                </span>
              )}
            </div>
            <div className="space-y-1.5 md:space-y-2" data-testid="roster">
              {players.map((p) => {
                const ch = characters.find((c) => charNum(c) === Number(p.character_id));
                return (
                  <div key={p.user_id} className="flex items-center justify-between p-1.5 md:p-2.5 bg-[#4d2813] pixel-border">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 border-2 border-[#261309] ${p.is_ready ? 'bg-[#6ab04c]' : 'bg-[#ffc93c]'}`} />
                      <span className="text-[#f4e7c3] font-semibold">{ch?.name ?? p.player_name}</span>
                      {p.user_id === userId && <span className="text-[#ffc93c] text-sm">(you)</span>}
                      {!p.connected && <span className="text-[#e8503a] text-sm">reconnecting…</span>}
                    </div>
                    {!quickRoom && (
                      <span className={`text-sm ${p.is_ready ? 'text-[#6ab04c]' : 'text-[#ffc93c]'}`}>{p.is_ready ? 'Ready' : 'Not ready'}</span>
                    )}
                  </div>
                );
              })}
              {quickRoom && Array.from({ length: Math.max(0, MAX_PLAYERS - players.length) }, (_, i) => (
                <div key={`bot-${i}`} className="flex items-center gap-2 p-1.5 md:p-2.5 bg-[#3a2110] pixel-border text-[#f4e7c3]/50">
                  <Bot className="w-4 h-4" /> <span>Bot (unless someone joins)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: character + actions */}
        <div className="space-y-3 md:space-y-4">
          <div className="p-3 md:p-5 pixel-panel">
            <h3 className="pixel-font text-sm md:text-lg text-[#f4e7c3] mb-2 md:mb-3">Your dino</h3>
            <div className="grid grid-cols-4 gap-1.5 md:gap-3">
              {characters.map((c) => {
                const cn = charNum(c);
                const mine = cn === myCharNum;
                const taken = takenByOthers.has(cn);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={taken || mine}
                    onClick={() => pickCharacter(c)}
                    className={`flex flex-col items-center gap-1 p-1.5 md:p-2 pixel-border transition-all ${
                      mine ? 'bg-[#6ab04c] text-[#0e2a08]' : taken ? 'bg-[#3a2110] text-[#f4e7c3]/30' : 'bg-[#4d2813] text-[#f4e7c3] hover:brightness-110'
                    }`}
                  >
                    <DinoSprite spriteId={c.spriteId} className={`w-10 h-10 md:w-14 md:h-14 ${taken ? 'opacity-30' : ''}`} scale={1.8} />
                    <span className="font-bold text-xs md:text-sm uppercase">{c.name}</span>
                    <span className="text-[10px] md:text-xs leading-tight opacity-80">{taken && !mine ? 'Taken' : c.powerUp.name}</span>
                  </button>
                );
              })}
            </div>
            {charNotice && <p className="text-[#ffb36b] text-sm mt-2 text-center">{charNotice}</p>}
            <div className="mt-2 flex justify-center short:hidden"><ComingSoon /></div>
          </div>

          {!quickRoom && !isReady && (
            <Button onClick={() => setPlayerReady(true, roomCode, userId)} size="xl" className="w-full" data-testid="lobby-ready">
              <Check className="w-5 h-5" /> Ready
            </Button>
          )}
          {!quickRoom && isReady && !canStart && (
            <div className="p-3 bg-[#6ab04c]/20 border-2 border-[#6ab04c] text-center text-[#b6e3a1] font-semibold">
              You're ready. Waiting for {players.length < MIN_PLAYERS ? 'another player' : 'everyone to ready up'}…
            </div>
          )}
          {!quickRoom && isHost && canStart && (
            <Button onClick={startGame} size="xl" className="w-full animate-pulse" data-testid="lobby-start">
              <Play className="w-5 h-5" /> Start match
            </Button>
          )}
          {!quickRoom && !isHost && canStart && (
            <div className="p-3 bg-[#6ab04c]/20 border-2 border-[#6ab04c] text-center text-[#b6e3a1] font-semibold">
              Everyone's ready. Waiting for the host to start…
            </div>
          )}

          <Button variant="outline" onClick={leave} className="w-full">Leave room</Button>
        </div>
      </div>
    </div>
  );
}
