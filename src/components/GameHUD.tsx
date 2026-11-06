import { motion } from 'framer-motion';
import { Menu, Egg, Eye } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { Minimap } from '@/components/Minimap';
import { LiveScoreboard } from '@/components/LiveScoreboard';
import { useIsTouchDevice } from '@/hooks/useIsTouchDevice';
import { useGamepadConnected } from '@/hooks/useGamepadConnected';

function formatMatchTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// Readable label + color per bot tactic, for the bots HUD panel.
const MODE_LABEL: Record<string, string> = {
  hunt: 'HUNTING', intercept: 'CUTTING OFF', guard: 'GUARDING', flee: 'FLEEING', roam: 'ROAMING',
};
const MODE_COLOR: Record<string, string> = {
  hunt: '#f87171', intercept: '#fb923c', guard: '#5fcde4', flee: '#facc15', roam: '#9fb0d8',
};

/** Admin spectator header: which room, and who the camera follows (the egg by default). */
function SpectatorFollow() {
  const roomCode = useGameStore((s) => s.roomCode);
  const rows = useGameStore((s) => s.scoreboard);
  const follow = useGameStore((s) => s.spectateFollow);
  const setFollow = useGameStore((s) => s.setSpectateFollow);
  const chip = (id: string | null, label: string) => (
    <button
      key={id ?? 'egg'}
      type="button"
      onClick={() => setFollow(id)}
      className={`px-chip px-2 py-1 transition-all ${follow === id ? 'brightness-125' : 'opacity-60 hover:opacity-90'}`}
      aria-pressed={follow === id}
    >
      <span className="px-heading text-[8px] uppercase text-[#f4e7c3]">{label}</span>
    </button>
  );
  return (
    <div className="pointer-events-auto flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 px-chip hud-lite px-2 py-1 sm:gap-2 sm:px-3 sm:py-2">
        <Eye className="h-3 w-3 shrink-0 text-[#5fcde4] sm:h-4 sm:w-4" aria-hidden />
        <span className="px-heading text-[8px] uppercase text-[#f4e7c3] sm:text-[9px]">Watching {roomCode}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {chip(null, 'Egg')}
        {rows.map((r) => chip(r.id, r.name))}
      </div>
    </div>
  );
}

export default function GameHUD() {
  const { players, userId, timeRemaining, setPaused, spectating, gameMode, roomCode } = useGameStore();
  // Single shared touch-device check — keeps the HUD in lockstep with MobileControls so
  // the desktop chrome and the touch controls can never render at the same time.
  const isMobile = useIsTouchDevice();
  const padConnected = useGamepadConnected();

  const agents = players.filter((p) => p.isBot);
  // Online, VoiceChat puts its control under the menu button on desktop (it shows under these
  // same conditions), so the points board starts below it instead of on top of it.
  const voiceShown = !spectating && gameMode === 'multiplayer' && !!roomCode && !!userId;

  const currentPlayer = players.find(
    (p) => p.userId === userId || (!p.isBot && players.length > 0)
  );
  const hasEgg = currentPlayer?.hasEgg ?? false;
  const eggHolder = players.find((p) => p.hasEgg);
  const eggOnGround = !eggHolder;

  return (
    <>
      <motion.div
        className="fixed top-3 left-0 right-0 z-[55] pointer-events-none"
        style={{
          // Pad by the notch/safe-area insets (landscape) so the left chips clear the
          // notch and the right menu clears the rounded corner. This also re-centers the
          // absolutely-positioned "Time left" panel within the *visible* area, since it
          // now centers on the padded content box rather than the full viewport.
          paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 0.75rem)',
          paddingRight: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)',
        }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="relative flex min-h-[44px] items-start justify-between">
          <div className="pointer-events-none flex max-w-[42%] flex-col gap-2 sm:max-w-none sm:flex-row sm:items-center">
            {spectating ? <SpectatorFollow /> : (
            <div
              className="pointer-events-none flex items-center gap-1.5 px-chip hud-lite px-2 py-1 sm:gap-2 sm:px-3 sm:py-2"
              style={hasEgg ? { background: '#ffc93c' } : undefined}
            >
              <Egg className="w-3 h-3 shrink-0 sm:w-4 sm:h-4" aria-hidden style={{ color: hasEgg ? '#2b2410' : '#f4e7c3' }} />
              <span className="px-heading text-[8px] uppercase sm:text-[9px]" style={{ color: hasEgg ? '#2b2410' : '#f4e7c3' }}>
                {hasEgg
                  ? 'You have it!'
                  : eggOnGround
                    ? 'Grab the egg'
                    : `Chase ${eggHolder?.character.name ?? 'them'}`}
              </span>
            </div>
            )}

            {/* Controls hint (desktop) — left header. */}
            {!isMobile && !spectating && (
              <div className="pointer-events-none flex items-center gap-3 px-chip hud-lite px-3 py-2">
                <p className="px-heading text-[9px] tracking-wider text-[#f4e7c3]">{padConnected ? 'CONTROLLER · A = POWER' : 'WASD/ARROWS'}</p>
              </div>
            )}

          </div>

          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
            <div className="flex flex-col items-center px-panel hud-lite px-3 py-1 sm:px-5 sm:py-1.5">
              <span className="px-heading text-[7px] uppercase tracking-[0.2em] text-[#9fb0d8] sm:text-[8px]">
                Time left
              </span>
              <span
                className={`px-heading text-base tabular-nums sm:text-xl ${timeRemaining > 0 && timeRemaining <= 10 ? 'animate-pulse' : ''}`}
                style={{ color: timeRemaining > 0 && timeRemaining <= 10 ? '#e8503a' : '#ffc93c', textShadow: '2px 2px 0 #11111c' }}
              >
                {formatMatchTime(timeRemaining)}
              </span>
            </div>
          </div>

          {/* Right side: only the bigger menu button. */}
          <div className="pointer-events-auto flex items-center">
            <button
              type="button"
              onClick={() => setPaused(true)}
              className="px-chip p-2.5 sm:p-3.5 transition-all hover:brightness-110"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6 sm:h-7 sm:w-7 text-[#f4e7c3]" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Bots panel: each bot's current tactic. The trash-talk shows as overhead
          bubbles in-world. */}
      {!isMobile && agents.length > 0 && (
        <div className="pointer-events-none fixed bottom-6 left-6 z-[55] w-[190px] px-panel hud-lite px-3 py-2">
          <div className="mb-1.5">
            <span className="px-heading text-[8px] uppercase tracking-[0.2em] text-[#9fb0d8]">Bots</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {agents.map((a) => {
              const mode = a.aiIntent?.mode;
              return (
                <div key={a.id} className="flex items-center justify-between gap-2">
                  <span className="px-heading truncate text-[9px] text-[#f4e7c3]">{a.character.name}</span>
                  <span
                    className="px-heading shrink-0 text-[8px] uppercase"
                    style={{ color: mode ? MODE_COLOR[mode] ?? '#9fb0d8' : '#9fb0d8' }}
                  >
                    {mode ? MODE_LABEL[mode] ?? mode : '…'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live points: under the menu button on desktop (under the voice control when there is
          one); compact under the egg chip on touch, where the compact minimap has the
          top-right corner. */}
      <div
        className="pointer-events-none fixed z-[55]"
        style={isMobile
          ? { top: 'calc(env(safe-area-inset-top, 0px) + 2.9rem)', left: 'calc(env(safe-area-inset-left, 0px) + 0.75rem)' }
          : { top: voiceShown ? '8.5rem' : '4.75rem', right: 'calc(env(safe-area-inset-right, 0px) + 0.75rem)' }}
      >
        <LiveScoreboard compact={isMobile} />
      </div>

      {/* Minimap: full size bottom-right on desktop; compact top-right on touch so it
          clears the joystick (bottom-right) and the power-up (bottom-left). The touch
          power-up button is owned solely by MobileControls — no duplicate here. */}
      <Minimap isMobile={isMobile} />
    </>
  );
}
