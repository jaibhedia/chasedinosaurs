import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Game } from '@/components/Game';
import { useGameStore } from '@/store/gameStore';
import { restoreMatchConfig } from '@/lib/matchConfig';
import { usePageTitle } from '@/hooks/usePageTitle';

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
  usePageTitle('Playing');

  useEffect(() => {
    const s = useGameStore.getState();
    if (!s.selectedCharacter && !restoreMatchConfig()) {
      navigate('/', { replace: true });
      return;
    }
    const after = useGameStore.getState();
    if (!after.selectedMap || !after.gameMode) {
      navigate('/', { replace: true });
      return;
    }
    setReady(true);
  }, [navigate]);

  if (!ready) return null;

  return <Game key={location.key} onGameEnd={() => navigate('/results', { replace: true })} />;
}
