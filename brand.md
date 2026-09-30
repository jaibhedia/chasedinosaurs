# Chase Dinosaurs — Brand & UI System

**Direction:** 16-bit Adventure — a cozy SNES-RPG pixel-art look, dark night base so chunky
panels and sun-yellow accents pop. Subtle CRT scanlines over everything. Sharp corners only.

## Palette

| Token | Hex | Role |
|---|---|---|
| Sky | `#5FCDE4` | secondary actions / info accents (`game` button) |
| Grass | `#6AB04C` | **primary** actions / success |
| Earth | `#C97B3C` | secondary buttons / wood panels |
| Cream | `#F4E7C3` | body text on dark, parchment panels |
| Sun | `#FFC93C` | **accent** — titles, timer, highlights |
| Danger | `#E8503A` | destructive / defeat |
| Ink | `#11111C` / `#181826` | outlines, deep background |

Tokens live in [src/index.css](src/index.css) `:root`. Nothing is rounded.

## Typography
- **Headings / labels:** `Press Start 2P` (`--font-heading`, class `.pixel-font` / `.font-heading`).
- **Body:** `VT323` (`--font-body`) — a readable pixel font. Both are bundled with
  `@fontsource` (imported in `src/main.tsx`), so they work offline and in the native apps.

## Pixel chrome (use these, don't hand-roll)
- `.pixel-panel` — dark stepped-border panel (chunky ink outline + inner highlight + hard drop
  shadow, no blur). `.pixel-panel-cream` for parchment. `.pixel-border` to wrap any element.
- `.adventure-bg` + `.pixel-grid` — the standard page background.
- `.title-pixel` (sun text + hard ink shadow), `.pixel-shadow` (hard offset text shadow).
- Buttons: the shadcn `Button` is pixel-styled. Variants → `default`=grass, `secondary`=earth,
  `neon`=sun, `game`=sky, `destructive`=danger, `outline`/`ghost`/`link`. They press down on
  `:active` and play the click SFX.
- In the game HUD: `.px-panel`, `.px-chip`, `.px-heading`, `.px-shadow`.
- Scanlines: a single `<div className="scanlines" />` is mounted in `src/App.tsx`. Respects
  `prefers-reduced-motion`.

## Do / Don't
- **Do** use solid palette fills, sharp corners, 8px-grid spacing, hard (offset) shadows.
- **Don't** use gradients, neon glows, `backdrop-blur`, or rounded corners — a global
  `border-radius: 0 !important` enforces the last one.
- Keep `image-rendering: pixelated` on all sprites/tiles.

## In-game arena
One arena for now, Summer Plains: the FreeEnviro grassland built procedurally in
[src/scene/gameScene.ts](src/scene/gameScene.ts) (`buildGrassland`) from a seeded RNG, so
every client in a room builds the same layout.
