# Chase Dinosaurs · ETHGlobal Mumbai 2026 · Plan and build log

> 🚨 **Deadline: Sat 7 Nov 2026, 09:00 IST.** Late submissions are not accepted.
> 🧊 **Feature freeze: Sat 7 Nov, 05:00 IST.** After that, only the demo video, the form and the
> partner write-ups.
> 🎮 **Event build: target about 19:00 IST Fri 6 Nov** (2–3 h after P1).
> ⏱ Time left at last update: 9h 26m to freeze, 13h 26m to the deadline (2026-11-06 19:33 IST)
>
> Spec: [PRD.md](PRD.md) · AI disclosure: [AI_USAGE.md](AI_USAGE.md) · Rules:
> [rules.md](../../.claude/skills/ethglobal-mumbai/references/rules.md)

<!-- last-logged: 3b3d2ea -->

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

## Event go-live (today)

- [ ] Merge PR #6 with a **merge commit**. Vercel deploys the web app and Render the server.
- [ ] Render env: `ADMIN_EMAILS` (comma-separated) and `ADMIN_PASSCODE`. Without the emails
  nobody can spectate.
- [ ] Optional: a persistent disk with `DATA_DIR` set to its mount path, so the all-time board
  survives restarts and deploys
- [ ] On the live site, check that:
  - points tick, and a steal adds 5
  - `/leaderboard` updates after an online match
  - `/admin` sign-in and Watch work
- [ ] Try an Xbox pad on a PC, and the stick-side toggle on a phone
- [ ] Settings → Controls: press a pad's buttons and see each row light up; flip the stick side
  on a phone

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
