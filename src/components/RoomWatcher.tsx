import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket, type LobbyPlayer } from '@/providers/SocketProvider';
import { useGameStore } from '@/store/gameStore';
import { gameMaps } from '@/data/maps';
import { saveMatchConfig } from '@/lib/matchConfig';

/**
 * Pulls everyone in a room into the match when the host starts it, from whatever
 * screen they're on: the waiting room, or still reading the last match's results.
 */
export function RoomWatcher() {
  const navigate = useNavigate();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    const onStarted = ({ serverTime, players, mapId }: { serverTime: number; players: LobbyPlayer[]; mapId: string }) => {
      const store = useGameStore.getState();
      if (!store.roomCode) return;
      store.resetMatch();
      store.setGameMode('multiplayer');
      store.setServerStartTime(serverTime);
      store.setRoomPlayers(players || []);
      store.setMap(gameMaps.find((m) => m.id === mapId) || gameMaps[0]);
      // A spectator has no seat to come back to after a refresh.
      if (!store.spectating) saveMatchConfig();
      try { localStorage.removeItem('chase-game-snapshot'); } catch { /* fresh match */ }
      navigate('/game');
    };
    socket.on('game-started', onStarted);
    return () => { socket.off('game-started', onStarted); };
  }, [socket, navigate]);

  return null;
}
