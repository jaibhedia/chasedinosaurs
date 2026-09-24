import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';
import { setGameSocket } from '@/lib/socketBridge';
import { resolveSocketUrl } from '@/config';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface LobbyPlayer {
  id: string;
  player_name: string;
  user_id: string;
  is_ready: boolean;
  character_id: number;
  connected: boolean;
  socket_id: string;
}

export interface RoomResponse {
  roomCode: string;
  players: LobbyPlayer[];
  room: { map_id: string };
}

interface SocketContextType {
  socket: Socket | null;
  connectionStatus: ConnectionStatus;
  /** Resolves true once connected, false if the server is unreachable within ~6s. */
  ensureConnected: () => Promise<boolean>;
  createRoom: (data: {
    userId: string;
    mapId: string;
    characterId: number;
    playerName?: string;
    isPublic?: boolean;
  }) => Promise<RoomResponse>;
  joinRoom: (data: {
    roomCode: string;
    userId: string;
    characterId: number;
    playerName?: string;
  }) => Promise<RoomResponse>;
  setPlayerReady: (isReady: boolean, roomCode?: string, userId?: string) => void;
  chooseCharacter: (characterId: number, playerName: string, roomCode: string, userId: string) => void;
  startGame: () => void;
  leaveRoom: () => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

/**
 * One socket for the whole app.
 *
 * The menus and the match used to be two separate apps with a full page load between
 * them, so the game opened a second connection and had to re-attach itself to the room
 * it had just left. Now the lobby and the match share this connection and the room
 * binding survives the transition untouched.
 *
 * On every (re)connect we re-attach to the current room, so a dropped connection or a
 * refresh mid-match restores the slot the server has been holding.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  // Re-render once the socket exists so consumers receive the live instance.
  const [, setReady] = useState(false);

  useEffect(() => {
    if (socketRef.current) return;
    const socket = io(resolveSocketUrl(), {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    setGameSocket(socket); // the Phaser scene lives outside React
    setReady(true);

    const rejoinIfNeeded = () => {
      const { gameMode, roomCode, userId } = useGameStore.getState();
      if (gameMode === 'multiplayer' && roomCode && userId) {
        socket.emit('rejoin-room', { roomCode, userId });
      }
    };

    socket.on('connect', () => {
      setConnectionStatus('connected');
      rejoinIfNeeded();
    });
    socket.io.on('reconnect_attempt', () => setConnectionStatus('reconnecting'));
    socket.io.on('reconnect', () => setConnectionStatus('connected'));
    socket.on('connect_error', () => setConnectionStatus('reconnecting'));
    socket.on('disconnect', (reason) => {
      setConnectionStatus(reason === 'io client disconnect' ? 'disconnected' : 'reconnecting');
      if (reason === 'io server disconnect') socket.connect();
    });

    socket.on('rejoin-failed', ({ reason }: { reason: string }) => {
      console.warn('[socket] rejoin failed:', reason);
    });
    // Keep the scene's roster and start time current after a reconnect.
    socket.on('room-rejoined', ({ players, serverStartTime }: { players: LobbyPlayer[]; serverStartTime: number | null }) => {
      const store = useGameStore.getState();
      if (Array.isArray(players)) store.setRoomPlayers(players);
      if (serverStartTime) store.setServerStartTime(serverStartTime);
    });
  }, []);

  const ensureConnected = (): Promise<boolean> =>
    new Promise((resolve) => {
      const s = socketRef.current;
      if (!s) return resolve(false);
      if (s.connected) return resolve(true);
      const onConnect = () => { clearTimeout(timer); resolve(true); };
      const timer = setTimeout(() => { s.off('connect', onConnect); resolve(false); }, 6000);
      s.once('connect', onConnect);
      s.connect();
    });

  /**
   * Emit and wait for one of the success events, or the server's `error` event.
   * Listeners are removed by reference so other components' listeners survive.
   */
  const request = (emit: string, payload: unknown, successEvents: string[], label: string): Promise<RoomResponse> =>
    new Promise((resolve, reject) => {
      const s = socketRef.current;
      if (!s) { reject(new Error('Not connected')); return; }
      const cleanup = () => {
        clearTimeout(timer);
        successEvents.forEach((ev) => s.off(ev, onSuccess));
        s.off('error', onError);
      };
      const onSuccess = (response: RoomResponse) => { cleanup(); resolve(response); };
      const onError = (error: { message?: string }) => { cleanup(); reject(new Error(error?.message || `${label} failed`)); };
      const timer = setTimeout(() => { cleanup(); reject(new Error(`${label} timed out — the server didn't answer.`)); }, 10000);
      successEvents.forEach((ev) => s.once(ev, onSuccess));
      s.once('error', onError);
      s.emit(emit, payload);
    });

  const createRoom: SocketContextType['createRoom'] = (data) =>
    request('create-room', data, ['room-created'], 'Create room');

  const joinRoom: SocketContextType['joinRoom'] = (data) =>
    request('join-room', data, ['room-joined'], 'Join room');

  const setPlayerReady = (isReady: boolean, roomCode?: string, userId?: string) => {
    // roomCode/userId let the server resolve us even if this socket lost its binding.
    socketRef.current?.emit('set-ready', { isReady, roomCode, userId });
  };

  const chooseCharacter = (characterId: number, playerName: string, roomCode: string, userId: string) => {
    socketRef.current?.emit('set-character', { characterId, playerName, roomCode, userId });
  };

  const startGame = () => socketRef.current?.emit('start-game');

  // Leaves the room without dropping the connection, so the player can join another.
  const leaveRoom = () => socketRef.current?.emit('leave-room');

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connectionStatus,
        ensureConnected,
        createRoom,
        joinRoom,
        setPlayerReady,
        chooseCharacter,
        startGame,
        leaveRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
}
