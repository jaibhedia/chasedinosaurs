# Chase Dinosaurs

A fast chase game (1-minute solo rounds, 2-minute online matches). There is one golden egg. Whoever holds it is the target and
everyone else hunts them. Whoever is holding it when the timer hits zero wins.

- **Solo** against three bots on Easy, Normal or Hard. Works offline.
- **Multiplayer** with up to four players over room codes or public rooms. Bots fill the
  empty seats. Proximity voice chat.
- Four dinos, each with a power that unlocks 15 seconds in: Super Speed, Quick Blast,
  Invincibility Shield, Teleport.

Play: **https://chasedinosaurs.fun** · Roadmap: [`ROADMAP.md`](ROADMAP.md)

A product of **[Abstract Studio](https://abstractstudio.in)**. Proprietary, see [License](#license).

## ETHGlobal Mumbai 2026

Entered in a Continuity track (Ship a Feature). Everything up to tag
`pre-ethglobal-mumbai-2026` (`1dcafa3`, 2026-10-07) existed before the event. Only the work
after it is new.

- Built at the event: see the Shipped rows in the PRD.
- Docs:
  - [PRD](docs/ethglobal-mumbai/PRD.md): what we're building, and what came before
  - [Plan and build log](docs/ethglobal-mumbai/PLAN.md): one entry per push
  - [AI usage](docs/ethglobal-mumbai/AI_USAGE.md): attribution by file, and every prompt

```bash
git log --oneline pre-ethglobal-mumbai-2026..main   # what was built at the event
git diff --stat pre-ethglobal-mumbai-2026..main
```

---

## Layout

```
.
├── src/            web app: React + TypeScript + Phaser 3 (Vite)
│   ├── screens/    home, mode select, solo setup, lobby, play, results, support, legal
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

## Installable (PWA)

The production build registers a service worker that precaches the whole game (code,
sprites, tiles, audio, fonts), so once it's loaded it installs to the home screen and plays
solo with no connection. New versions download in the background and offer an **Update**
button, never during a match. Android and desktop Chrome get an **Install app** button on
the home screen; iOS Safari gets a one-time "Share → Add to Home Screen" hint.

Installed, it opens fullscreen in landscape. If a phone opens it in a window anyway (a
plain home-screen shortcut, a browser without fullscreen apps, an install from an older
manifest), the first tap takes it fullscreen ([`src/lib/fullscreen.ts`](src/lib/fullscreen.ts)).
Long-press the icon for Solo, Quick Play and Friends shortcuts. iPhone Safari can't hide its
bars for a web page; installed to the Home Screen it opens without them.

Service workers only run in production builds; check with `npm run build && npm run preview`.

## Native apps (iOS and Android)

The same web build runs inside [Capacitor](https://capacitorjs.com) shells in `android/` and
`ios/`. Native extras: landscape lock, hidden status bar, real haptics, the Android back
button (opens the pause menu mid-match), and a reconnect check when the app resumes.

```bash
npm run android   # build, sync, open in Android Studio
npm run ios       # build, sync, open in Xcode (macOS)
npm run apk       # build a debug APK from the command line (needs the Android SDK)
```

- **APK without Android Studio:** every push builds a debug APK on GitHub Actions
  ([`.github/workflows/android.yml`](.github/workflows/android.yml)). Download it from the
  run's **Artifacts** and sideload it.
- **Server CORS:** add `https://localhost` (Android) and `capacitor://localhost` (iOS) to the
  server's `CORS_ORIGIN`.
- **Bundle id:** `fun.chasedinosaurs.app` in [`capacitor.config.ts`](capacitor.config.ts).
  It's permanent once published, so confirm it before the first store upload.
- **Icons and splash:** generated from `resources/` with
  `npx @capacitor/assets generate --assetPath resources`.

## How a match works

- The arena is generated from a seeded RNG, so every client in a room builds the same map.
- Each client simulates its own dino and sends its position about 30 times a second; other
  players are dead-reckoned between packets.
- The server decides who holds the egg: clients only *claim* it, and the server checks each
  claim against the positions it has seen and broadcasts the new owner with a sequence
  number, so every screen agrees. It also runs the clock and names the winner.
- One client in each room steers the bots and broadcasts their positions. If it drops, the
  next client takes over within about a second.
- Bot tactics are local (`src/scene/botTactics.ts`): the nearest chaser goes straight in,
  the next cuts off the escape, a third covers the lane. Easy / Normal / Hard tune speed,
  prediction, reaction time, teamwork and power use.
- Bots talk when something happens (a steal, a loss, closing in, ten seconds left). The
  server asks the LLM for one short line (`server/src/botVoice.ts`); with no key, or no
  answer within about a second, the bot uses a canned line for its persona. The results
  screen gets a one-line roast the same way.
- The round clock runs off the wall clock (the server's, online), so it keeps real time at
  any frame rate.

## License

Copyright © 2026 [Abstract Studio](https://abstractstudio.in). All rights reserved. See [`LICENSE`](LICENSE).
Third-party art is credited in [`CREDITS.md`](CREDITS.md) and stays under its authors'
licenses.
