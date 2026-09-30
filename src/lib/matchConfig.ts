import { useGameStore } from '@/store/gameStore';

/**
 * The menu choices a match was started with, saved so a refresh on /game can resume
 * it instead of bouncing to the home screen. Single-player then restores its own
 * snapshot (see GameScene.tryRestoreSnapshot); multiplayer re-attaches to the room the
 * server is holding.
 */
const KEY = 'chase-game-config';

export function saveMatchConfig(): void {
  const s = useGameStore.getState();
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        gameMode: s.gameMode,
        selectedCharacter: s.selectedCharacter,
        selectedMap: s.selectedMap,
        serverStartTime: s.serverStartTime,
        roomPlayers: s.roomPlayers,
        roomCode: s.roomCode,
        multiplayerHiddenFill: s.multiplayerHiddenFill,
        savedAt: Date.now(),
      }),
    );
  } catch { /* storage blocked — a refresh just returns to the menu */ }
}

/** Restore the last match's config into the store. Returns false if there is none. */
export function restoreMatchConfig(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const cfg = JSON.parse(raw);
    // A config older than a match plus its reconnect grace is a dead match.
    if (!cfg?.selectedCharacter || Date.now() - (cfg.savedAt || 0) > 10 * 60 * 1000) return false;
    useGameStore.setState({
      gameMode: cfg.gameMode,
      selectedCharacter: cfg.selectedCharacter,
      selectedMap: cfg.selectedMap,
      serverStartTime: cfg.serverStartTime ?? null,
      roomPlayers: cfg.roomPlayers ?? [],
      roomCode: cfg.roomCode ?? null,
      multiplayerHiddenFill: cfg.multiplayerHiddenFill ?? false,
    });
    // The player id lives in localStorage; a hard refresh starts with it unset, and
    // without it the socket can't rejoin the room (see SocketProvider.rejoinRoom).
    useGameStore.getState().initUserId();
    return true;
  } catch {
    return false;
  }
}

export function clearMatchConfig(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem('chase-game-snapshot');
  } catch { /* nothing to clear */ }
}
