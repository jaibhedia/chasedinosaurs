# Security

How the multiplayer server (`server/`) and the web app (`src/`) are hardened, and what is
still open.

## Secrets
- Real `.env` files are git-ignored; only `.env.example` placeholders are tracked.
- The only secret is the AI provider key (`AI_API_KEY`). It lives in the server's env and is
  never prefixed `VITE_`, so it cannot reach the web bundle. Anything `VITE_*` is public.

## Multiplayer server (`server/src/index.ts`)
- **Room-membership gating.** `isRoomMember()` / `canUseRoom()` gate every relay handler, so a
  client cannot emit into a room it never joined. `canUseRoom` also allows single-player
  `solo-*` ids, which have no fan-out.
- **Payload validation.** Room codes must match `^[A-Z0-9]{6}$`; names are clamped to 24
  chars; `characterId` to 1–4; positions and velocities are rebuilt from range-checked
  numbers. `userId` is required on create/join.
- **DoS caps.** `MAX_ROOMS = 1000`; per-socket sliding-window limits on `create-room`
  (10/min) and `join-room` (30/min); `maxHttpBufferSize` of 100 KB per frame.
- **HTTP.** `helmet()` headers, `x-powered-by` off, 120 req/min per IP.
- **CORS.** Reflects any origin in dev and warns loudly in production when `CORS_ORIGIN` is
  unset. **Set `CORS_ORIGIN` in production**, including `capacitor://localhost` and
  `https://localhost` once the native apps ship.

## Known limitations
- `userId` is a client-generated guest token with no authentication, so it is spoofable.
  That is acceptable for a free game with no accounts, rankings or purchases. It must be
  replaced with real auth before anything with value is attached to a player (paid
  cosmetics, ranked ladders).
- The server trusts client-reported positions (clamped, not simulated). A modified client
  can move faster than allowed. See ROADMAP.md, Phase 1, for making the server authoritative.
