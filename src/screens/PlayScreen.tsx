import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Game } from '@/components/Game';
import { useGameStore } from '@/store/gameStore';
import { restoreMatchConfig } from '@/lib/matchConfig';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSocket } from '@/providers/SocketProvider';

/**
 * Hosts the Phaser match. Menus set up the store and navigate here; on a refresh the
 * store is empty, so the last match config is restored from storage first.
 *
 * `location.key` keys the game, so "Restart" (a navigate to /game) mounts a fresh
 * scene instead of reusing the finished one.
 */
export default function PlayScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const { rejoinRoom } = useSocket();
  usePageTitle('Playing');

  useEffect(() => {
    const s = useGameStore.getState();
    const needsRestore = !s.selectedCharacter;
    if (needsRestore && !restoreMatchConfig()) {
      navigate('/', { replace: true });
      return;
    }
    // After a refresh the socket may already be connected (it connects app-wide, before
    // this lazy screen mounts), so its own on-connect rejoin ran without a room. Rejoin
    // now that the room and player id are back.
    if (needsRestore) rejoinRoom();
    const after = useGameStore.getState();
    if (!after.selectedMap || !after.gameMode) {
      navigate('/', { replace: true });
      return;
    }
    setReady(true);
  }, [navigate]);

  if (!ready) return null;

  // An admin spectator goes back to the room's page to wait for its next match.
  const onGameEnd = () => navigate(useGameStore.getState().spectating ? '/admin' : '/results', { replace: true });
  return <Game key={location.key} onGameEnd={onGameEnd} />;
}
