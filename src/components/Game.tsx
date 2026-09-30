import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import GameCanvas from '@/components/GameCanvas';
import GameHUD from '@/components/GameHUD';
import MobileControls from '@/components/MobileControls';
import ConnectionStatus from '@/components/ConnectionStatus';
import VoiceChat from '@/components/VoiceChat';
import GameMenu from '@/components/GameMenu';
import NetStats from '@/components/NetStats';
import { CoachHints } from '@/components/CoachHints';

export interface GameProps {
  onGameEnd: () => void;
}

export function Game({ onGameEnd }: GameProps) {
  const { gamePhase, countdownTimer, players, userId } = useGameStore();
  const endedRef = useRef(false);

  const currentPlayer = players.find(
    (p) => p.userId === userId || (!p.isBot && players.length > 0)
  );
  const powerUpReady = currentPlayer?.powerUpReady ?? false;
  const powerUpActive = currentPlayer?.powerUpActive ?? false;
  const powerUpCooldown = currentPlayer?.powerUpCooldown ?? 0;
  const powerUpCooldownMax = currentPlayer?.powerUpCooldownMax ?? 15000;

  useEffect(() => {
    const isMobile = window.innerWidth <= 1024;
    if (isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      document.body.style.touchAction = 'none';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.touchAction = '';
    };
  }, []);

  // On match end, hold the "time's up" beat briefly so the final grab registers, then
  // hand off to the results screen.
  useEffect(() => {
    if (gamePhase !== 'ended' || endedRef.current) return;
    const t = setTimeout(() => { endedRef.current = true; onGameEnd(); }, 1500);
    return () => clearTimeout(t);
  }, [gamePhase, onGameEnd]);

  return (
    <main
      className="h-screen h-[100dvh] w-screen overflow-hidden relative touch-none"
      style={{ touchAction: 'none', background: '#14141f' }}
    >
      <NetStats />
      <GameHUD />
      <CoachHints />
      <ConnectionStatus />
      <VoiceChat />
      <GameMenu />
      <div className="absolute inset-0 w-full h-full">
        <GameCanvas />
      </div>
      <AnimatePresence>
        {gamePhase === 'countdown' && (
          <motion.div
            key={`countdown-${countdownTimer}`}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-[65] flex items-center justify-center pointer-events-none"
          >
            <div className="px-panel px-6 py-4 sm:px-10 sm:py-6">
              <p className="px-heading text-3xl sm:text-5xl md:text-6xl" style={{ color: '#ffc93c', textShadow: '4px 4px 0 #11111c' }}>
                {countdownTimer > 0 ? countdownTimer : 'GO!'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gamePhase === 'ended' && (
          <motion.div
            key="times-up"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[70] flex items-center justify-center bg-black/45 pointer-events-none"
          >
            <div className="px-panel px-6 py-4 sm:px-10 sm:py-6">
              <p className="px-heading text-2xl sm:text-4xl" style={{ color: '#ffc93c', textShadow: '4px 4px 0 #11111c' }}>
                TIME!
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MobileControls
        powerUpReady={powerUpReady}
        powerUpActive={powerUpActive}
        powerUpCooldown={powerUpCooldown}
        powerUpCooldownMax={powerUpCooldownMax}
      />
    </main>
  );
}

export default Game;
