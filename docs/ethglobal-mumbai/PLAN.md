# Chase Dinosaurs · ETHGlobal Mumbai 2026 · Plan and build log

> 🚨 **Deadline: Sat 7 Nov 2026, 09:00 IST.** Late submissions are not accepted.
> 🧊 **Feature freeze: Sat 7 Nov, 05:00 IST.** After that, only the demo video, the form and the
> partner write-ups.
> 🎮 **Event build: target about 19:00 IST Fri 6 Nov** (2–3 h after P1).
> ⏱ Time left at last update: 2h 05m to freeze, 6h 05m to the deadline (2026-11-07 02:55 IST)
>
> Spec: [PRD.md](PRD.md) · AI disclosure: [AI_USAGE.md](AI_USAGE.md) · Rules:
> [rules.md](../../.claude/skills/ethglobal-mumbai/references/rules.md)

<!-- last-logged: 9059eca -->

## Eligibility gates

Check each one on the dashboard. Don't assume them.

- [ ] ETH stake placed (each team member stakes individually)
- [ ] Project created on the Hacker Dashboard, and teammates joined with the team token
- [ ] Continuity track selected: Ship a Feature
- [ ] Pre-existing work disclosed in the README section, and the baseline tag pushed (the tag is
  pushed ✅)
- [x] Repo is public, so judges can see the history
- [ ] Discord connected

## Build order

Small, independent changes come first so something ships early. Points come before the spectator
view, because the spectator shows the live board.

| # | PRD | Step | Estimate | Status |
|---|---|---|---|---|
| 1 | F5 | Stick-side preference in the store; MobileControls flips; toggle in the menu | 15 min | Shipped |
| 2 | F4 | Gamepad polling into the shared touch-input channel; Start/B for the menu | 25 min | Shipped |
| 3 | F2 | Server: steals and points in `Match`, a 1 s `match-scores` broadcast. Client: a live board in the HUD and points on the results screen | 45 min | Shipped |
| 4 | F3 | Server: a bests store (file in `DATA_DIR`) and `GET /leaderboard`. Client: a `/leaderboard` screen with 3 tabs | 35 min | Shipped |
| 5 | F1 | Server: admin sign-in, a live room list and spectate. Client: the `/admin` screen and spectator mode in the scene | 60 min | Shipped |
| 6 | F6 | A shared `readPad()` for the game and the check; a Controls panel (3 tabs, live highlight, stick-side preview); `/settings` from home; Controls in the in-game menu | 40 min | Shipped |
| 7 | F7 | World ID: server signing and verification, nullifier per player, verified-only board, the Verify panel | 60 min | Shipped |
| 8 | F8 | 0G Compute receipts: trace capture, `/ai/receipts`, the line under the roast | 30 min | Shipped |
| 9 | Arc | Organiser-funded USDC prize on Arc for the top verified human | 3 h | Not started: needs Arc Studio and a funded testnet wallet |
| 10 | F9 | Player names: one rule set on the server and in the browser, a name field (mode screen, Settings, a room), names on the roster, tags, live board and results | 40 min | Shipped |
| 11 | F10 | Controller in the menus: the D-pad or stick moves focus, A presses, B goes back; the in-game menu, How to Play and the pad check | 45 min | Shipped |

## Event go-live (today)

- [x] Merge PR #6 with a merge commit (20:36 IST, `5355089`).
- [x] Merge [PR #7](https://github.com/jaibhedia/chasedinosaurs/pull/7) (F7 World ID, F8 0G
  receipts, F9 names, F10 controller menus) with a merge commit (2026-11-07 01:43 IST,
  `3e045e6`). Vercel and Render picked it up within minutes.
- [ ] Merge PR #8 (the voice button over the points board) with a **merge commit**.
- [ ] Render env: `ADMIN_EMAILS` (comma-separated) and `ADMIN_PASSCODE`. Without the emails
  nobody can spectate.
- [ ] Leaderboard storage (free): at upstash.com create a Redis database, copy its REST URL and
  token into Render's Environment as `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, then
  open `<server>/health` and check `leaderboard.store` is `"upstash"`
- [ ] Optional: stop the ~1-minute wake-up after 15 idle minutes, with the Starter plan
  ($7/month) or a free uptime check that loads `/health` every 10 minutes
- [ ] World ID (F7), after Upstash (otherwise a restart forgets who is verified): at
  developer.world.org create an app, enable World ID 4.0 and create the action
  `chase-leaderboard` in **production**. Copy the signing key when it's shown; it's shown once.
  Set `WORLD_APP_ID`, `WORLD_RP_ID` and `WORLD_RP_SIGNING_KEY` on Render. `/health` then shows
  `world.enabled: true`. The all-time board is empty until someone verifies, so verify once with
  World App on a phone straight away
- [ ] 0G (F8): at pc.0g.ai connect a wallet, deposit 0G and create an `sk-` key (shown once). Set
  `AI_BASE_URL` to `https://router-api.0g.ai/v1`, `AI_API_KEY` and `AI_MODEL` (`0gm-1.0-35b-a3b`,
  or `gpt-4.1-nano` if the bots stay quiet). Play a match, then copy a request id from
  `<server>/ai/receipts` into the 0G submission. If the list stays empty, the calls are failing or
  slower than the bots' 1.1 s budget; try the other model
- [ ] On the live site, check that:
  - points tick, and a steal adds 5
  - `/leaderboard` updates after an online match
  - `/admin` sign-in and Watch work
- [ ] Try an Xbox pad on a PC, and the stick-side toggle on a phone
- [ ] Settings → Controls: press a pad's buttons and see each row light up; flip the stick side
  on a phone
- [ ] Names (F9): pick one on `/play`, join a room from a second device, and see both names on
  the roster, over the dinos and, after the match, on `/leaderboard`
- [ ] Controller menus (F10), with a real pad and no mouse: Home → Play → Quick Play; in a match,
  Start → the menu → Resume

## How we commit

- One logical step per commit, so each feature shows up as several commits. A commit with more
  than ~400 changed lines (lockfiles aside) gets split, or its message explains why.
- AI-assisted commits carry a `Co-Authored-By` trailer.
- Before pushing, run what CI runs: `npm run build`, plus
  `npm --prefix server run typecheck && npm --prefix server test` when `server/` changes.
- PRs come from `new` and the author merges them with a merge commit. No squash merges and no
  force-pushes.

## Build log

One entry per push, oldest first, written by the post-push routine.

### F0 · Setup · Shipped · 2026-11-06 16:14 IST
- **Commits:** `1dcafa3..ad4fb5b` (2): the skill, then the docs · PR #6
- **Files:** `.claude/skills/ethglobal-mumbai/` (new), `docs/ethglobal-mumbai/` (new), `README.md`
- **New vs reused:** New: the rules skill, the PRD, the plan, the AI log, and the baseline tag
  `pre-ethglobal-mumbai-2026`. The layout follows `docs/ethonline/`.
- **AI:** Claude Code (Opus 5.5) wrote the skill, the report script and these docs.
  **Human:** supplied the ETHGlobal rules and asked for this workflow (P0). Gave the feature list,
  with Karmanya's scoring rules (P1).
- **Verified:** `push-report.sh` runs on macOS bash 3.2 · CI on `1dcafa3` ✅

### F5 · Stick on either side · Shipped · 2026-11-06 16:16 IST
- **Commits:** `4631219` (1) · PR #6
- **Files:** `src/store/gameStore.ts`, `src/components/MobileControls.tsx`, `src/components/GameMenu.tsx` · +43/−5
- **New vs reused:**
  - New: a `stickSide` preference (stored as `chase-stick-side`) and a "Stick: left/right"
    toggle in the in-game menu (touch devices only). MobileControls places the stick and the
    power button from it.
  - Reused: the existing controls and menu, and the store's localStorage pattern from
    difficulty.
- **AI:** Claude Code (Opus 5.5) wrote all three changes. **Human:** asked for the feature (P1).
- **Verified:** `npm run build` ✅. Not yet tried on a phone.

### F4 · Xbox controller on PC · Shipped · 2026-11-06 16:16 IST
- **Commits:** `ec97817` (1) · PR #6
- **Files:** `src/lib/gamepadInput.ts` (new), `src/hooks/useGamepadConnected.ts` (new),
  `src/components/Game.tsx`, `src/components/GameHUD.tsx`, `src/lib/haptics.ts` · +119/−1
- **New vs reused:**
  - New: per-frame gamepad polling, controller rumble on the moments phones vibrate, and a
    HUD hint when a pad is connected.
  - Reused: the scene's `touchInput` channel (analog throttle, hold-to-fire), so the 3.8k-line
    scene didn't change.
- **AI:** Claude Code (Opus 5.5) wrote all of it. **Human:** asked for the feature (P1).
- **Challenge:** the pad and the touch stick share one input channel. An idle pad writes
  nothing, so it can't zero out a touch stick, and it sends one zero when released, so the dino
  doesn't drift.
- **Verified:** `npm run build` ✅. Not yet tested with a physical pad. Browsers only expose a
  pad after its first button press.
- **Next / known issues:** screens outside a match (home, results) don't respond to the pad yet.

### F2 · Points and live match leaderboard · Shipped · 2026-11-06 16:22 IST
- **Commits:** `5ae683a` (server), `ee51eb0` (client) · PR #6
- **Files:**
  - Server: `server/src/match.ts`, `server/src/match.test.ts`, `server/src/index.ts`
  - Client: `src/lib/scoring.ts` (new), `src/components/LiveScoreboard.tsx` (new),
    `src/scene/gameScene.ts`, `src/store/gameStore.ts`, `src/components/GameHUD.tsx`,
    `src/screens/Results.tsx`
  - Size: +230/−25
- **New vs reused:**
  - New: steal counting, and the points formula on the server and the client. A
    `match-scores` broadcast goes out once a second and right after each steal. Also the live
    board in the HUD, and results ranked by points with held time and steals.
  - Reused: the server's authoritative egg claims (which already reported the previous
    holder, so a steal needed no new tracking) and the scene's held-time counter.
- **AI:** Claude Code (Opus 5.5) wrote the code and the test. **Human:** Karmanya set the
  scoring rules (P1), and Shantanu asked for them to be built on the existing system rather
  than as an overhaul.
- **Challenge:** every screen has to show the same points online. The server is the source of
  truth: it sends its tally every second and right after each steal. Between tallies, each
  client keeps the holder's seconds ticking, so the board doesn't stutter.
- **Verified:**
  - Server tests 8/8, including a new one on the points maths: 2.5 s held plus a steal is 7
    live, and a 110 s holder who stole once and won ends on 145.
  - Typecheck and `npm run build` ✅. Not yet played end to end.
- **Next / known issues:** the +30 win bonus appears on the results, not on the live board,
  since nobody has won until the buzzer.

### F3 · All-time leaderboard · Shipped · 2026-11-06 16:26 IST
- **Commits:** `6f37c94` (server), `17be8bb` (client) · PR #6
- **Files:**
  - Server: `server/src/leaderboard.ts` (new), `server/src/leaderboard.test.ts` (new),
    `server/src/index.ts`, `render.yaml`, `.gitignore`
  - Client: `src/screens/Leaderboard.tsx` (new), `src/App.tsx`, `src/screens/Home.tsx`
  - Size: +298/−1
- **New vs reused:**
  - New: a store of per-player bests, saved to `DATA_DIR/leaderboard.json`, and
    `GET /leaderboard?board=hold|steals|wins&me=`. Also a `/leaderboard` screen with three
    tabs, linked from home, that refreshes itself every 20 s.
  - Reused: F2's per-match stats, which the server already finalises at the buzzer.
- **AI:** Claude Code (Opus 5.5) wrote it. **Human:** Karmanya defined the three boards and the
  best-single-match rule rather than sums (P1).
- **Challenge:** a public board without exposing user ids, which double as reconnect keys. The
  client sends its own id as `me`, and the server marks only that row and returns its rank.
- **Verified:** server tests 10/10, including 2 new ones: best single match rather than the
  sum, plus a tie-break, and no bot entries. Typecheck and `npm run build` ✅.
- **Next / known issues:**
  - Wins is a total count, since one match can only give 0 or 1 (asked in PRD §8).
  - Render's free disk resets on deploy (PRD §8).
  - Solo matches don't count.

### F1 · Admin-only spectator mode · Shipped · 2026-11-06 16:35 IST
- **Commits:** `98352cf` (server), `532d8f1` (scene), `a360b12` (admin screen and HUD) · PR #6
- **Files:**
  - Server: `server/src/index.ts`, `render.yaml`
  - Scene and store: `src/scene/gameScene.ts`, `src/store/gameStore.ts`
  - Admin UI: `src/screens/Admin.tsx` (new), `src/lib/adminSession.ts` (new), `src/App.tsx`,
    `src/screens/PlayScreen.tsx`, `src/components/RoomWatcher.tsx`,
    `src/providers/SocketProvider.tsx`, `src/components/Game.tsx`,
    `src/components/GameHUD.tsx`, `src/components/GameMenu.tsx`
  - Size: +493/−34
- **New vs reused:**
  - New:
    - admin sign-in: an `ADMIN_EMAILS` allowlist plus `ADMIN_PASSCODE`, compared in constant
      time and rate limited
    - `admin-rooms` and `spectate`, and the `/admin` screen
    - the scene's spectator mode, with a follow camera and HUD follow buttons
    - re-spectating after a reconnect
  - Reused:
    - Socket.IO room broadcasts: a spectator is a socket in the room that isn't on the roster
    - the existing `isRoomMember` guard, which now also locks spectators out of gameplay
      events
    - `RoomWatcher`'s pull into each new match, and the scene's multiplayer path
- **AI:** Claude Code (Opus 5.5) wrote it, including the passcode: an email alone isn't proof
  of identity, so the passcode is checked whenever it's set. **Human:** Shantanu asked for an
  admin-only spectator mode, identified by email now and by wallet address later (P1).
- **Challenge:** the scene is built around "my dino", and a spectator has none to play. The
  spectator keeps a hidden local dino, and every path that would act on it is gated:
  movement, input packets, egg claims, powers, bot steering (including both takeover paths),
  the minimap, the board and the results. A mid-match join re-syncs the egg and scores once
  the scene has loaded. Voice is off for spectators, because the server's `voice-join`
  doesn't check room membership.
- **Verified:**
  - Smoke test against a local server, 14/14 checks:
    - a wrong passcode and an unknown email are refused
    - spectating is refused before sign-in
    - the spectator gets game-started, the egg handoff and live scores
    - its own egg claim and input are ignored, and it never appears in the scores
    - a mid-match re-sync returns the egg and the scores
    - `/leaderboard` leaks no user ids
  - `npm run build` ✅. Not yet watched in a browser.
- **Next / known issues:**
  - Refreshing mid-watch goes home, since the sign-in lives in memory.
  - Watch from a different browser profile from any player's, because a profile shares one
    user id.
  - Before this event, the server's `voice-join` already let anyone with a room code join
    that room's voice. Not fixed here.

### F6 · Controls in Settings · Shipped · 2026-11-06 19:33 IST
- **Commits:** `d62ea0d` (spec), `343f614`, `315ab00`, `3b3d2ea` · PR #6
- **Files:** `src/components/ControlsPanel.tsx` (new), `src/screens/Settings.tsx` (new),
  `src/lib/gamepadInput.ts`, `src/App.tsx`, `src/screens/Home.tsx`,
  `src/components/GameMenu.tsx`, `src/components/MobileControls.tsx` · +476/−81 (most of the
  menu's diff is re-indentation)
- **New vs reused:**
  - New: a `/settings` screen (Settings button on home) and a Controls panel with three tabs:
    keyboard and mouse, controller, phone. It opens on the tab for the device in use, lights
    up held keys and pad buttons, names the pad and shows its stick. Also a Controls item in
    the in-game menu.
  - Reused: F4's pad reading (now `readPad()`, shared by the game and the check), F5's
    stick-side setting, and the leaderboard screen's layout and tabs.
- **AI:** Claude Code (Opus 5.5) wrote it and the browser checks. **Human:** Karmanya asked for
  a Settings option showing the controls for keyboard/mouse, controller and phone, and
  Shantanu passed it on (P2).
- **Challenge:** a check only helps if it reads the pad the way a match does. The pad logic
  (D-pad over stick, deadzone, A/RB/RT) moved into one `readPad()` that the game and the panel
  both call, so a row lights up only when a match would respond. Separately, on a 568 px wide
  phone the wider panel reached into the stick's touch area, and the stick took taps meant
  for Back. The stick now ignores touches that start on the menu.
- **Verified:**
  - `npm run build` ✅
  - Headless Chromium against the production build, with a simulated Xbox pad: 25/25 checks,
    three runs in a row. Home → Settings; each device's default tab; Space, arrows and W
    light their rows; a pad connecting opens Controller and is named; A, RT, the stick, the
    D-pad, Start and B light theirs, and the deadzone ignores drift; the stick side saves;
    the in-game Controls and Back work; Start closes the menu; no sideways scroll on 740, 667
    and 568 px wide phones.
  - A touch test on a 568×320 phone failed before the stick fix and passes after it.
  - Not yet tried with a physical pad or on a real phone.
- **Next / known issues:**
  - Bindings can't be changed (out of scope, PRD §7).
  - The pad still can't move through menus outside a match.

### F3 fix · The all-time board survives restarts · Shipped · 2026-11-06 20:03 IST
- **Commits:** `ee10c4a`, `4e3ef74` · PR #6
- **Files:** `server/src/leaderboard.ts`, `server/src/leaderboard.test.ts`, `server/src/index.ts`,
  `render.yaml`, `server/.env.example` · +220/−24
- **New vs reused:**
  - New: Upstash Redis storage over its REST API (no new dependency), loading that retries and
    merges, a flush on SIGTERM, and the store in `/health`.
  - Reused: F3's in-memory board, with the `DATA_DIR` file as the fallback.
- **AI:** Claude Code (Opus 5.5) picked Upstash and wrote it and the tests. **Human:** Shantanu
  asked for an alternative to `DATA_DIR` instead of a paid disk (P4).
- **Challenge:** a remote store can be unreachable for a moment at startup. If the server then
  saved its empty board, it would wipe the real one. Saves now wait until the stored board has been
  read, reads retry, and matches that finish meanwhile are merged in (the best of each best, with
  wins and matches added).
- **Verified:**
  - Server tests 11/11, including a new one against a stand-in Upstash: a failed read writes
    nothing, the retry merges both sides, and the token is sent. Typecheck and `npm run build` ✅.
  - The real server reports `store: upstash` on `/health`, and falls back to the file without the
    variables. A match recorded 0.3 s before SIGTERM reached the store through the `tsx` launcher.
  - Not yet run against a real Upstash database: creating a throwaway one was blocked by a
    permission check.
- **Next / known issues:** set the two variables on Render. The free server still sleeps after
  15 idle minutes (PRD §8).

### F6 fix · Controls panel layout · Shipped · 2026-11-06 20:30 IST
- **Commits:** `beb935f` (1) · PR #6
- **Files:** `src/components/ControlsPanel.tsx`, `src/components/GameMenu.tsx`
- **What changed:** tab labels fit on one line (Keyboard, Controller, Phone, with "Keyboard &
  mouse" kept as the accessible name). Rows are flat strips instead of framed boxes, labelled in
  the heading font. Inside the menu the panel has no frame of its own, and the menu widens to
  520 px.
- **AI:** Claude Code (Opus 5.5). **Human:** Shantanu found the layout faults on a 1440 px screen
  and sent a screenshot (P5).
- **Verified:** no tab label overflows at 1440 px, on `/settings` or on a 568 px phone. The
  25-check browser suite and the small-phone touch test pass. `npm run build` ✅.

### F7 · Verified humans on the all-time board (World ID) · Shipped · 2026-11-06 22:07 IST
- **Commits:** `cfd68cc` (server), `2e74e23` (client), `6df6d83` (config) · PR #7
- **Files:**
  - Server: `server/src/world.ts` (new), `server/src/world.test.ts` (new),
    `server/src/leaderboard.ts`, `server/src/leaderboard.test.ts`, `server/src/index.ts`,
    `server/package.json`
  - Client: `src/lib/world.ts` (new), `src/components/WorldVerify.tsx` (new),
    `src/screens/Leaderboard.tsx`, `package.json`
  - Config: `render.yaml`, `server/.env.example`
  - Size: +421/−12
- **New vs reused:**
  - New: IDKit 4 (World ID 4.0). The server signs each request with the RP key, checks that the
    proof is for our action, environment and credential, and sends it as-is to World's
    `/api/v4/verify/{rp_id}`. The nullifier is stored per player, so one World ID backs one
    player. The board is verified-only, and the Verify panel's widget loads only on tap.
  - Reused: F3's board and its Upstash/file storage, which now also keeps the verified flag. The
    ETHOnline World ID code was removed on 2026-09-24; none of it was revived.
- **AI:** Claude Code (Opus 5.5) chose Selfie Check as the credential and wrote the integration
  and tests. **Human:** Shantanu asked Claude to integrate the sponsors it judged best without
  breaking the game (P6), after Claude's prize ranking (P3).
- **Challenge:** a real trust moment that never blocks play. Verification gates only the all-time
  board. The nullifier, stored as a decimal as World advises, is what turns away a second profile
  from the same person.
- **Partner notes (World write-up):** the v4 result shapes, including where the nullifier sits,
  were clearest in the raw `integrate.md`. The widget's `onError` gets only an error code, so the
  reason for a rejection by our server is kept on our side. The `expo-crypto` peer is optional, so
  the web build needed nothing extra.
- **Verified:**
  - Server tests 18/18. World: signing with a random key; an accepted proof returns a decimal
    nullifier; proofs for another action, environment or credential never reach World; a
    rejected proof, or one verified for another environment, is refused; one nullifier backs one
    player; the verified-only board.
  - Browser, with the local server: World off, the board is unchanged and shows no panel. World on
    (a dummy app), the panel shows, tapping loads the widget chunk and World's dialog opens. It
    reports "Verification unavailable" because the dummy app isn't registered.
  - Entry bundle +3 KB; the widget is a separate 409 KB chunk.
  - Not yet verified with a real World App.
- **Next / known issues:** needs a Developer Portal app and the production action (go-live list).
  Wins farmed with unverified alt tabs can still feed one verified row (PRD §8).

### F8 · 0G Compute receipts for the bots' AI · Shipped · 2026-11-06 22:12 IST
- **Commits:** `3967eaa` (server), `4a78f68` (results screen), `9635ddf` (config) · PR #7
- **Files:** `server/src/ai/receipts.ts` (new), `server/src/botVoice.test.ts` (new),
  `server/src/ai/provider.ts`, `server/src/botVoice.ts`, `server/src/index.ts`,
  `src/screens/Results.tsx`, `render.yaml`, `server/.env.example` · +135/−20
- **New vs reused:**
  - New: receipts from the Router's `x_0g_trace` (request id, provider address) for every bot line
    and roast, `GET /ai/receipts`, and the receipt under the roast on the results screen.
  - Reused: the bots' OpenAI-compatible voice from before the event, which already supported the
    0G Compute Router (`OG_ROUTER_*`). The game started on 0G agent brains (2026-06-20).
- **AI:** Claude Code (Opus 5.5) wrote it and the tests. **Human:** as F7 (P6).
- **Challenge:** making 0G visible without slowing the bots. Lines have a 1.1 s budget before the
  game falls back to canned lines, so `verify_tee` (synchronous TEE verification) stays off. The
  request id and provider address come on every Router response anyway.
- **Partner notes (0G write-up):** `x_0g_trace` on every response made receipts a few lines of
  code, and the OpenAI SDK keeps unknown fields, so no SDK change was needed. The docs give no
  latency figure for `verify_tee`, which is what decided against it for live chat.
- **Verified:**
  - Server tests 18/18, including a roast against a stand-in Router whose receipt survives the
    OpenAI client.
  - A full solo match in the browser against a stand-in Router: the results screen shows "Written
    on 0G Compute · request b413d8b6", and `/ai/receipts` listed 3 receipts (lines and the roast).
  - Not yet run against the real Router (it needs an `sk-` key and a 0G deposit).
- **Next:** point `AI_*` at `router-api.0g.ai`, play one match, and copy a request id from
  `/ai/receipts` into the 0G submission.

### Process · F7 and F8 wait in PR #7 · 2026-11-06 22:55 IST
- **Commits:** this docs commit · [PR #7](https://github.com/jaibhedia/chasedinosaurs/pull/7)
- PR #6 was merged with a merge commit (`5355089`) at 20:36 IST, before F7 and F8 were pushed.
  Their seven commits reached `new` after the merge, so they wait in PR #7, and nothing in them is
  live until it's merged.
- **Live check (22:30 IST):** Render's `/health` shows the bots on Groq (`llama-3.1-8b-instant`)
  and `leaderboard.store: "file"`, so Upstash isn't set yet. CORS answers only
  `chasedinosaurs.fun` and `www.chasedinosaurs.fun`.
- **0G model:** the Router's public `/v1/models` lists `temperature` and `max_tokens`, the two
  parameters the bots send, for 0G's own `0gm-1.0-35b-a3b`. `glm-5.2`, the earlier example, lists
  neither, so the go-live list now suggests `0gm-1.0-35b-a3b`, with `gpt-4.1-nano` as a fallback.
  The Router's latency against the bots' 1.1 s budget is still untested.

### F9 · Player names · Shipped · 2026-11-06 23:25 IST
- **Commits:** `3d9f7f8` (server), `989cb07` (picking a name), `4c02af1` (showing it) · PR #7
- **Files:**
  - Server: `server/src/names.ts` (new), `server/src/names.test.ts` (new), `server/src/index.ts`
  - Client: `src/lib/playerName.ts` (new), `src/components/NameField.tsx` (new),
    `src/store/gameStore.ts`, `src/screens/ModeSelect.tsx`, `src/screens/Settings.tsx`,
    `src/screens/Lobby.tsx`, `src/scene/gameScene.ts`, `src/screens/Results.tsx`
  - Size: +248/−23
- **New vs reused:**
  - New: a name each player picks, saved on the device, with one rule set on both sides; " 2"
    for a name already in the room; renaming inside a room before the match.
  - Reused: the room roster's `player_name` field, which until now held the dino's name, and the
    existing name tags, live board and results screen.
- **AI:** Claude Code (Opus 5.5) wrote it and the tests. **Human:** Shantanu asked for a naming
  system as one of the last two features, for a final PR (P8).
- **Challenge:** the room already had a name field that every screen ignored, because it always
  held the dino's name. Making it the player's name meant routing one value through the lobby,
  the scene, the results and the board. It also closed a gap: `set-character` stored whatever
  name it was sent, unchecked and of any length.
- **Verified:**
  - Server tests 21/21, including the name rules (Devanagari, full-width letters, emoji, length)
    and the " 2" for a clash.
  - Browser, two players: both names on the roster with their dinos; "shantanu" typed in the room
    becomes "shantanu 2"; the live board in the match names the other player. A solo match ends
    on results listing "Shantanu" (you) and the bots by their dinos. On a 740×360 phone the field
    fits on the mode screen and in Settings.
- **Known issues:** names aren't reserved across the all-time board, so two people can both be
  "Rex" there (World ID is what keeps it one row per person). There's no word filter.

### F10 · Controller navigation in menus · Shipped · 2026-11-06 23:25 IST
- **Commits:** `76e478b` (navigation), `de5bae2` (where each screen starts, what B presses) · PR #7
- **Files:**
  - `src/lib/padNav.ts` (new), `src/components/PadMenuNav.tsx` (new), `src/lib/gamepadInput.ts`,
    `src/App.tsx`, `src/index.css`
  - Marks: `src/components/GameMenu.tsx`, `src/components/ControlsPanel.tsx`,
    `src/components/HowToPlay.tsx`, and the screens Home, ModeSelect, Settings, Lobby, Results,
    SoloSetup, Support, Leaderboard and Admin
  - Size: +259/−15
- **New vs reused:**
  - New: focus that moves to the nearest button in the direction pressed (hold to repeat), A to
    press, B to go back, an outline while the pad is in use, and the pad driving the in-game menu.
  - Reused: F4's pad reading (`readPad`, with a menu reading on top) and its Start/B menu toggle.
- **AI:** Claude Code (Opus 5.5) wrote it and the browser checks. **Human:** Shantanu reported the
  menus still couldn't be used with a controller and asked for it last (P8).
- **Challenge:** the same buttons mean different things in different places. A fires the power in
  a match but presses buttons in a menu, so the A that picked Resume also fired, and the D-pad
  steered the dino behind an open menu. The pad now stops steering while the menu is open and
  fires only on a fresh press with the menu shut. On the controller check, B has to light its row
  rather than leave the page. "The nearest button down" also needed edge-to-edge distance:
  centre to centre sent Down from Play to a small footer link.
- **Verified:** 28 browser checks with a simulated Xbox pad, all passing. Home → Play → Quick Play
  and back with the pad only; How to Play keeps focus and B skips it; the name field is reachable;
  B on the controller check stays put while A lights Power; in a solo match Start opens the menu
  on Resume, Down and A open Controls, B closes the menu, A on Resume closes it, and with the menu
  shut the pad leaves the page alone. F6's 25 checks and the phone touch test still pass.
- **Known issues:** tried with a simulated pad, not yet a physical one. A text field needs a
  keyboard; A only focuses it.

### F2 fix · The voice button no longer covers the points board · Shipped · 2026-11-07 02:55 IST
- **Commits:** `9059eca` (1) · PR #8
- **Files:** `src/components/GameHUD.tsx` · +8/−4
- **AI:** Claude Code (Opus 5.5) found the cause and fixed it. **Human:** Shantanu spotted it on
  the live site and sent a screenshot (P11).
- **Challenge:** two components pinned to the same corner. Online on desktop, VoiceChat's control
  sat 5rem from the top and F2's board 4.75rem, both 0.75rem from the right edge. The board now
  starts at 8.5rem when the voice control shows (same conditions as VoiceChat); solo and
  spectating keep 4.75rem.
- **Verified:** measured in live two-player matches at 1280×720 and 1440×900. The voice button
  spans 80–126 px from the top and the board starts at 136 px, with the menu button clear. Solo
  has no voice button and the board stays under the menu. No page errors.

## Submission checklist

- [ ] Feature freeze held, final push made, CI green, and the live build matches `main`
- [ ] Title, short description, description, how it's made, repo link
- [ ] Judging option: Finalist and Partner Prizes (the default, unless you can't attend the
  finalist session) or Partner Prizes only
- [ ] Partner prizes (up to 3). For each: how we integrated it, our feedback, and comments
  (drafts are in PRD §5)
- [ ] Demo video:
  - 2–4 minutes, at least 720p. Keep it under 3:00 if 0G is picked (their limit).
  - a screen recording in your own voice (no AI voiceover)
  - no speed-up, and no music over captions in place of talking
  - intro under 20 s, at most 4 bullets per slide
- [ ] AI_USAGE.md has a row for every file changed since the baseline (`push-report.sh` lists
  any that don't), and the prompt log is complete
- [ ] The README's "ETHGlobal Mumbai 2026" section is current

## Judging prep (7 minutes: 4 for the demo, 3 for Q&A)

- **What inspired it?** <…>
- **What tools did you use, and why?** <…>
- **What challenges did you solve, and how?** <take these from the build log's Challenge lines>
- **What did you build at the event, and what came before?**
  `git log --oneline pre-ethglobal-mumbai-2026..main`, plus PRD §2
- **How much is AI? What did you do?** The division of work in AI_USAGE.md
