import { useMemo } from 'react';
import { useGameStore, type GameObject } from '@/store/gameStore';

/**
 * The obstacle layer, drawn once to an image. It used to be ~4,400 SVG rects re-rendered
 * with every blip update (12 times a second), which cost more than the game itself on a
 * phone. Obstacles never move, so they're painted once per arena and size.
 */
function bakeObstacles(objects: GameObject[], mapW: number, mapH: number, W: number, H: number): string {
  const scale = 2; // crisp on high-DPI screens
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#1d3322';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(22,41,26,0.9)';
  const sx = (W * scale) / mapW;
  const sy = (H * scale) / mapH;
  for (const o of objects) {
    ctx.fillRect(o.x * sx, o.y * sy, Math.max(3, o.width * sx), Math.max(3, o.height * sy));
  }
  return canvas.toDataURL('image/png');
}

/**
 * Top-down minimap of the arena. Reads the throttled `minimap` slice from the store
 * (fed ~12Hz by the scene) so it re-renders independently of the rest of the HUD.
 * DOM/SVG — always on top of the canvas, no Phaser camera-zoom math.
 */
export function Minimap({ isMobile = false }: { isMobile?: boolean }) {
  const minimap = useGameStore((s) => s.minimap);
  const gameObjects = useGameStore((s) => s.gameObjects);

  // Compact on touch so it tucks into the top-right and never collides with the joystick
  // (bottom-right) or the power-up button (bottom-left).
  const W = isMobile ? 96 : 196;
  const H = !minimap.w || !minimap.h
    ? 0
    : isMobile
      ? Math.max(54, Math.round(W * (minimap.h / minimap.w)))
      : Math.round(Math.min(150, Math.max(96, W * (minimap.h / minimap.w))));
  const backdrop = useMemo(
    () => (H > 0 ? bakeObstacles(gameObjects, minimap.w, minimap.h, W, H) : ''),
    [gameObjects, minimap.w, minimap.h, W, H],
  );
  if (!minimap.w || !minimap.h || minimap.dots.length === 0) return null;

  const sx = W / minimap.w;
  const sy = H / minimap.h;

  // Desktop: full size, bottom-right. Touch: compact, top-right just left of the menu
  // button, clear of the joystick (bottom-right) and the power button (bottom-left).
  const wrapCls = isMobile
    ? 'pointer-events-none fixed top-3 z-[54] px-panel p-1'
    : 'pointer-events-none fixed bottom-6 right-6 z-[55] px-panel p-2';
  const wrapStyle = isMobile
    ? { right: 'calc(env(safe-area-inset-right, 0px) + 4.75rem)' }
    : undefined;

  return (
    <div className={wrapCls} style={wrapStyle}>
      {!isMobile && (
        <div className="mb-1 flex items-center gap-1.5">
          <span className="px-heading text-[8px] uppercase tracking-[0.2em] text-[#9fb0d8]">Map</span>
        </div>
      )}
      <svg
        width={W}
        height={H}
        className="block"
        style={{ imageRendering: 'pixelated', display: 'block' }}
      >
        {/* arena floor + obstacles, pre-rendered */}
        {backdrop && <image href={backdrop} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />}

        <rect x={0.5} y={0.5} width={W - 1} height={H - 1} fill="none" stroke="#3e5e3e" strokeWidth={1} />

        {minimap.dots.map((d, i) => {
          const cx = Math.max(4, Math.min(W - 4, d.x * sx));
          const cy = Math.max(4, Math.min(H - 4, d.y * sy));
          if (d.kind === 'egg') {
            // Egg = gold diamond so it stands out from the round player blips.
            const r = 4.5;
            return (
              <rect
                key={i}
                x={cx - r}
                y={cy - r}
                width={r * 2}
                height={r * 2}
                fill="#facc15"
                stroke="#7a5b16"
                strokeWidth={1}
                transform={`rotate(45 ${cx} ${cy})`}
              />
            );
          }
          const r = d.kind === 'self' ? 4 : 3.2;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill={d.color}
              stroke={d.kind === 'self' ? '#ffffff' : '#0b1120'}
              strokeWidth={d.kind === 'self' ? 1.6 : 1}
            />
          );
        })}
      </svg>
    </div>
  );
}
