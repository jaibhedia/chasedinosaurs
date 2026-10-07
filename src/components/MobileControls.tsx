import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { PowerUpHudCluster } from '@/components/PowerUpHudCluster';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice';
import { pressPower, releasePower, setStick } from '@/lib/touchInput';

interface MobileControlsProps {
  powerUpReady?: boolean;
  powerUpActive?: boolean;
  powerUpCooldown?: number;
  powerUpCooldownMax?: number;
}

// Sized 25% smaller than launch so the controls cover less of the game on a phone.
/** How far (px) the knob travels from the centre at full deflection. */
const MAX_DISTANCE = 36;
/** Knob size (px); placeKnob centres it on the pad. */
const KNOB = 48;
/** Touches this far outside the pad still grab it, so a thumb that lands a bit off counts. */
const GRAB_MARGIN = 28;

export default function MobileControls({
  powerUpReady = false,
  powerUpActive = false,
  powerUpCooldown = 0,
  powerUpCooldownMax,
}: MobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [isTouching, setIsTouching] = useState(false);
  const touchIdRef = useRef<number | null>(null);
  // Shared detection — identical to GameHUD, so controls + HUD never disagree.
  const showControls = useIsTouchDevice();
  const selectedCharacter = useGameStore((s) => s.selectedCharacter);
  const cooldownMax = powerUpCooldownMax ?? selectedCharacter?.powerUp?.cooldown ?? 15000;
  const activeDuration = selectedCharacter?.powerUp?.duration ?? 3000;

  useEffect(() => {
    // The knob is moved by writing its transform directly, not through React state, so
    // it tracks the thumb without a re-render per touchmove.
    const placeKnob = (x: number, y: number) => {
      if (knobRef.current) knobRef.current.style.transform = `translate(${x - KNOB / 2}px, ${y - KNOB / 2}px)`;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!joystickRef.current || touchIdRef.current === null) return;
      const touch = Array.from(e.touches).find((t) => t.identifier === touchIdRef.current);
      if (!touch) return;
      e.preventDefault();

      const rect = joystickRef.current.getBoundingClientRect();
      let x = touch.clientX - (rect.left + rect.width / 2);
      let y = touch.clientY - (rect.top + rect.height / 2);
      const distance = Math.hypot(x, y);
      if (distance > MAX_DISTANCE) {
        x = (x / distance) * MAX_DISTANCE;
        y = (y / distance) * MAX_DISTANCE;
      }
      placeKnob(x, y);
      setStick(x / MAX_DISTANCE, y / MAX_DISTANCE);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!joystickRef.current || touchIdRef.current !== null) return;
      const rect = joystickRef.current.getBoundingClientRect();
      const touch = Array.from(e.changedTouches).find(
        (t) =>
          t.clientX >= rect.left - GRAB_MARGIN &&
          t.clientX <= rect.right + GRAB_MARGIN &&
          t.clientY >= rect.top - GRAB_MARGIN &&
          t.clientY <= rect.bottom + GRAB_MARGIN,
      );
      if (!touch) return;
      e.preventDefault();
      touchIdRef.current = touch.identifier;
      setIsTouching(true);
      handleTouchMove(e);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchIdRef.current);
      if (!touch) return;
      e.preventDefault();
      touchIdRef.current = null;
      setIsTouching(false);
      placeKnob(0, 0);
      setStick(0, 0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
      setStick(0, 0);
    };
  }, []);

  if (!showControls) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      {/* Power-up button — bottom-left, thumb-reachable, clear of the home indicator. */}
      <div
        className="absolute pointer-events-auto flex items-center"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
          left: 'calc(env(safe-area-inset-left, 0px) + 0.75rem)',
        }}
      >
        <PowerUpHudCluster
          powerUpReady={powerUpReady}
          powerUpActive={powerUpActive}
          powerUpCooldown={powerUpCooldown}
          cooldownMax={cooldownMax}
          activeDuration={activeDuration}
          onPress={pressPower}
          onRelease={releasePower}
          size={60}
        />
      </div>

      {/* Twin-stick style joystick — pixel-themed (sharp corners per brand, no blur/gradient).
          Responsive: smaller on phones, larger on tablets/iPads. */}
      <div
        className="absolute pointer-events-auto flex flex-col items-center gap-1.5"
        style={{
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
          right: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
        }}
      >
        <div
          ref={joystickRef}
          className="relative w-24 h-24 sm:w-[108px] sm:h-[108px] md:w-[132px] md:h-[132px] overflow-hidden border-[3px] border-[#11111c] bg-[#1a160f] shadow-[0_4px_0_rgba(0,0,0,0.5),inset_0_0_22px_rgba(0,0,0,0.55)]"
        >
          {/* Recessed track frames */}
          <div className="absolute inset-1.5 border-2 border-[#4d2813]" />
          <div className="absolute inset-[18px] border border-[#4d2813]/60" />

          {/* Direction hints */}
          <div className="absolute inset-0 pointer-events-none text-[#f4e7c3]/80">
            <span className="absolute left-1/2 -translate-x-1/2 top-1 text-xs leading-none">▲</span>
            <span className="absolute left-1/2 -translate-x-1/2 bottom-1 text-xs leading-none">▼</span>
            <span className="absolute top-1/2 -translate-y-1/2 left-1.5 text-xs leading-none">◀</span>
            <span className="absolute top-1/2 -translate-y-1/2 right-1.5 text-xs leading-none">▶</span>
          </div>

          {/* Thumb knob — solid sun fill (no gradient), 64px so the centering offset holds. */}
          <div
            ref={knobRef}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `translate(${-KNOB / 2}px, ${-KNOB / 2}px)`, willChange: 'transform' }}
          >
            <motion.div
              className="w-12 h-12 border-[3px] border-[#11111c] flex items-center justify-center shadow-[0_3px_0_rgba(0,0,0,0.5)]"
              style={{ background: '#ffc93c' }}
              animate={{ scale: isTouching ? 1.06 : 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <div className="w-4 h-4 bg-[#11111c]/30 border border-[#11111c]/50" />
            </motion.div>
          </div>
        </div>
        <p className="px-heading text-[9px] tracking-widest uppercase text-[#f4e7c3] short:hidden">Move</p>
      </div>
    </div>
  );
}
