# Chase Dinosaurs

A fast 60-second chase game. There is one golden egg. Whoever holds it is the target and
everyone else hunts them. Whoever is holding it when the timer hits zero wins.

- **Solo** against three bots on Easy, Normal or Hard. Works offline.
- **Multiplayer** with up to four players over room codes or public rooms. Bots fill the
  empty seats. Proximity voice chat.
- Four dinos, each with a power that unlocks 15 seconds in: Super Speed, Earthquake,
  Invincibility Shield, Teleport.

Play: **https://chasedinosaurs.fun** · Roadmap: [`ROADMAP.md`](ROADMAP.md)

A product of **Abstract Studio**. Proprietary, see [License](#license).

---

## Layout

```
.
├── src/            web app: React + TypeScript + Phaser 3 (Vite)
│   ├── screens/    home, mode select, solo setup, lobby, play, results, legal
│   ├── scene/      the Phaser game (gameScene.ts) and its bootstrap
│   ├── components/ in-game HUD, touch controls, pause menu, voice chat
│   ├── providers/  the app-wide Socket.IO connection
│   └── store/      Zustand game state
├── public/         sprites, tiles, audio, icons
├── server/         multiplayer server: Express + Socket.IO (tsx)
├── docs/ethonline/ the ETHOnline 2026 hackathon plan and submission, kept for history
└── render.yaml     server deploy blueprint (Render)
```

The web app and the server are separate packages that talk only over Socket.IO.

## Run it locally

```bash
npm install                 # web app
npm --prefix server install # server

# terminal 1: multiplayer server on :3001
npm run server:dev

# terminal 2: web app on :5173
npm run dev
```

Open http://localhost:5173. Solo works without the server (the bots just don't talk);
multiplayer needs it.

To test two players, use two browser profiles (or one normal and one private window).
Two tabs in the same profile share a player id.

## Environment

**Web app** (`.env.local`, all optional, all public: `VITE_*` values ship in the bundle):

| Var | Default | |
|---|---|---|
| `VITE_SOCKET_URL` | `http://localhost:3001` on localhost, otherwise the production server | Multiplayer server. Any build can also be pointed elsewhere at runtime with `?server=<url>` (remembered on that device; `?server=` clears it). |
| `VITE_SHOW_NETSTATS` | `false` | Round-trip time and FPS overlay. `?netstats=1` also works. |

**Server** (`server/.env`, see [`server/.env.example`](server/.env.example)):

| Var | |
|---|---|
| `CORS_ORIGIN` | Comma-separated allowed origins. Required in production. |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Any OpenAI-compatible endpoint. Gives the bots their personality and taunts. Without it the bots still play, silently. **Secret; server only.** |

## Build and deploy

```bash
npm run build     # typecheck + production build into dist/
npm run preview   # serve dist/ locally
```

- **Web app → Vercel.** [`vercel.json`](vercel.json) builds with `npm run build`, serves
  `dist/`, and rewrites unknown paths to `index.html` so deep links like `/join/ABC123`
  work. Set `VITE_SOCKET_URL` in the project env if the server isn't at the default URL.
- **Server → Render.** [`render.yaml`](render.yaml) is a Blueprint (`rootDir: server`,
  health check `/health`, region Frankfurt). Set `CORS_ORIGIN` to the site URL and the
  `AI_*` vars.

## How a match works

- The arena is generated from a seeded RNG, so every client in a room builds the same map.
- Each client simulates its own dino and sends its position about 30 times a second; other
  players are dead-reckoned between packets.
- One client in each room steers the bots and broadcasts their positions. If it drops, the
  next client takes over within about a second.
- Every few seconds the bot-steering client sends a small snapshot to the server, which asks
  the LLM for each bot's tactic, persona and one-line taunt. Movement stays local and runs
  every frame.
- The round clock runs off the wall clock (the server's start time online), so it keeps
  real time at any frame rate.

## License

Copyright © 2026 Abstract Studio. All rights reserved. See [`LICENSE`](LICENSE).
Third-party art is credited in [`CREDITS.md`](CREDITS.md) and stays under its authors'
licenses.
