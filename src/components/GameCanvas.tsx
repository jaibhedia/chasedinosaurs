import { useEffect, useLayoutEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { initializeGame } from '@/scene/gameEngine';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const teardownRef = useRef<(() => void) | undefined>(undefined);
  const { selectedMap, gameMode, serverStartTime } = useGameStore();

  /**
   * Destroy the Phaser game synchronously on unmount. A plain useEffect cleanup runs
   * after React has removed the container and the browser has painted, so a Phaser frame
   * could run in between against a detached, 0×0 parent: its resize-to-parent mode then
   * rebuilt the render targets at zero size and WebGL threw "Framebuffer Incomplete
   * Attachment". Layout-effect cleanups run in the commit, before any frame.
   */
  useLayoutEffect(() => () => {
    teardownRef.current?.();
    teardownRef.current = undefined;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !selectedMap) return;
    if (gameMode === 'multiplayer' && !serverStartTime) return;

    let cleanupFn: (() => void) | undefined;
    let disposed = false;
    let initTimer: number | null = null;
    let rafId: number | null = null;

    const runInit = async () => {
      if (disposed) return;
      try {
        const engineCleanup =
          gameMode === 'multiplayer'
            ? await initializeGame(container, serverStartTime!)
            : await initializeGame(container);
        // Either unmount path may run it first; the second call is a no-op.
        let done = false;
        const cleanup = () => { if (!done) { done = true; engineCleanup?.(); } };
        if (disposed) {
          cleanup?.();
          return;
        }
        cleanupFn = cleanup;
        teardownRef.current = cleanup;
      } catch (err) {
        console.error('Failed to initialize Phaser game engine', err);
      }
    };

    const startWhenSized = (attempt = 0) => {
      if (disposed) return;
      if ((container.clientWidth > 0 && container.clientHeight > 0) || attempt >= 8) {
        runInit();
        return;
      }
      rafId = window.requestAnimationFrame(() => startWhenSized(attempt + 1));
    };

    initTimer = window.setTimeout(() => startWhenSized(), 120);

    return () => {
      disposed = true;
      if (initTimer !== null) window.clearTimeout(initTimer);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      cleanupFn?.();
    };
  }, [selectedMap, gameMode, serverStartTime]);

  return (
    <div className="w-full h-full relative" id="game-canvas-container">
      <div
        ref={containerRef}
        className="w-full h-full bg-gradient-to-br from-slate-950 to-violet-950 touch-none absolute inset-0 z-0"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
