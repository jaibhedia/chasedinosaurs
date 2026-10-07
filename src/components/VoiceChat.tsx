import { useEffect, useRef, useState } from 'react';
import { Flag, Headphones, Mic, MicOff, PhoneOff, Users, Volume2, VolumeX } from 'lucide-react';
import { useSocket } from '@/providers/SocketProvider';
import { useGameStore } from '@/store/gameStore';
import { ProximityVoice } from '@/lib/voiceChat';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice';

/**
 * Opt-in proximity voice chat control. Available only in multiplayer rooms.
 * Tapping "Voice" requests the mic and joins the room's WebRTC mesh; nearby
 * players come through loud and distant ones fade out (see ProximityVoice).
 */
export default function VoiceChat() {
  const touch = useIsTouchDevice();
  const { socket, connectionStatus } = useSocket();
  const gameMode = useGameStore((s) => s.gameMode);
  const roomCode = useGameStore((s) => s.roomCode);
  const userId = useGameStore((s) => s.userId);

  const voiceRef = useRef<ProximityVoice | null>(null);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [error, setError] = useState('');
  const [showPeers, setShowPeers] = useState(false);
  const [, setVersion] = useState(0);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const players = useGameStore((s) => s.players);
  const roomPlayers = useGameStore((s) => s.roomPlayers);

  // The server drops a player from voice after enough reports.
  useEffect(() => {
    if (!socket) return;
    const onBlocked = () => { voiceRef.current?.stop(); voiceRef.current = null; setActive(false); setError('Voice disabled'); };
    socket.on('voice-blocked', onBlocked);
    return () => { socket.off('voice-blocked', onBlocked); };
  }, [socket]);

  // Tear down on unmount.
  useEffect(() => () => { voiceRef.current?.stop(); voiceRef.current = null; }, []);

  // Voice needs an online room with a stable user id.
  if (gameMode !== 'multiplayer' || !roomCode || !userId) return null;

  const enable = async () => {
    if (!socket) return;
    setError('');
    const voice = new ProximityVoice({
      socket,
      roomCode,
      localUserId: userId,
      onPeersChanged: setPeerCount,
      positions: {
        getLocalPosition: () => {
          const p = useGameStore.getState().players.find((x) => x.userId === userId);
          return p ? { x: p.x, y: p.y } : null;
        },
        getPeerPosition: (peerId) => {
          const p = useGameStore.getState().players.find((x) => x.userId === peerId);
          return p ? { x: p.x, y: p.y } : null;
        },
      },
    });
    try {
      await voice.start();
      voiceRef.current = voice;
      setActive(true);
      setMuted(false);
    } catch (err: any) {
      console.warn('[voice] failed to start', err);
      setError(err?.name === 'NotAllowedError' ? 'Mic blocked' : 'Mic unavailable');
    }
  };

  const disable = () => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    setActive(false);
    setPeerCount(0);
  };

  const toggleMute = () => {
    const next = !muted;
    voiceRef.current?.setMuted(next);
    setMuted(next);
  };

  const nameOf = (peerId: string) => {
    const inGame = players.find((p) => p.userId === peerId);
    if (inGame) return inGame.character.name;
    const lobby = roomPlayers.find((p: { user_id: string; player_name?: string }) => p.user_id === peerId);
    return lobby?.player_name ?? 'Player';
  };

  const togglePeer = (peerId: string) => {
    const v = voiceRef.current;
    if (!v) return;
    v.setPeerMuted(peerId, !v.isPeerMuted(peerId));
    setVersion((n) => n + 1);
  };

  // Reporting also mutes them for you straight away.
  const report = (peerId: string) => {
    socket?.emit('report-player', { roomCode, userId: peerId, reason: 'voice' });
    voiceRef.current?.setPeerMuted(peerId, true);
    setReported((prev) => new Set(prev).add(peerId));
  };

  return (
    <div
      className={`pointer-events-auto fixed z-[58] flex flex-col items-end gap-1.5 sm:gap-2 ${touch ? '' : 'top-16 sm:top-20'}`}
      // On phones the minimap sits top right next to the menu button; start below both
      // with a clear gap (it used to butt up against the minimap on a 6" screen).
      style={{
        right: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
        ...(touch ? { top: 'calc(env(safe-area-inset-top, 0px) + 6.5rem)' } : {}),
      }}
    >
      {!active ? (
        <button
          onClick={enable}
          disabled={connectionStatus !== 'connected'}
          className="px-chip flex items-center gap-1.5 p-1.5 transition-all hover:brightness-110 disabled:opacity-50 sm:gap-2 sm:p-2.5"
          aria-label="Join proximity voice chat"
        >
          <Headphones className="h-4 w-4 text-[#5fcde4] sm:h-5 sm:w-5" />
          <span className="px-heading text-[8px] uppercase tracking-wider text-[#f4e7c3] sm:text-[9px]">Voice</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setShowPeers((v) => !v)}
            className="px-chip flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-2 hover:brightness-110"
            aria-label="Who's in voice"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-[#6ab04c] animate-pulse" />
            <Users className="h-3.5 w-3.5 text-[#f4e7c3]" />
            <span className="px-heading text-[8px] tabular-nums text-[#f4e7c3] sm:text-[9px]">{peerCount}</span>
          </button>
          <button
            onClick={toggleMute}
            className="px-chip p-1.5 transition-all hover:brightness-110 sm:p-2.5"
            aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? (
              <MicOff className="h-4 w-4 text-[#e8503a] sm:h-5 sm:w-5" />
            ) : (
              <Mic className="h-4 w-4 text-[#6ab04c] sm:h-5 sm:w-5" />
            )}
          </button>
          <button
            onClick={disable}
            className="px-chip p-1.5 transition-all hover:brightness-110 sm:p-2.5"
            aria-label="Leave voice chat"
          >
            <PhoneOff className="h-4 w-4 text-[#e8503a] sm:h-5 sm:w-5" />
          </button>
        </div>
      )}
      {active && showPeers && (
        <div className="px-panel p-2 flex flex-col gap-1.5 min-w-[180px]" data-testid="voice-peers">
          {(voiceRef.current?.peerIds() ?? []).length === 0 && (
            <span className="text-sm text-[#f4e7c3]/70">Nobody else in voice yet.</span>
          )}
          {(voiceRef.current?.peerIds() ?? []).map((id) => {
            const off = voiceRef.current?.isPeerMuted(id) ?? false;
            return (
              <div key={id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-[#f4e7c3] truncate">{nameOf(id)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => togglePeer(id)} className="px-chip p-1" aria-label={off ? 'Unmute player' : 'Mute player'}>
                    {off ? <VolumeX className="h-4 w-4 text-[#e8503a]" /> : <Volume2 className="h-4 w-4 text-[#6ab04c]" />}
                  </button>
                  <button
                    onClick={() => report(id)}
                    disabled={reported.has(id)}
                    className="px-chip p-1 disabled:opacity-50"
                    aria-label="Report player"
                    title={reported.has(id) ? 'Reported' : 'Report'}
                  >
                    <Flag className="h-4 w-4 text-[#ffc93c]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {error && (
        <span className="px-heading text-[8px] uppercase tracking-wider text-[#e8503a]">{error}</span>
      )}
    </div>
  );
}
