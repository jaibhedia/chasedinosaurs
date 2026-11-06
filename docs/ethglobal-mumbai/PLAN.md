# Chase Dinosaurs · ETHGlobal Mumbai 2026 · Plan and build log

> 🚨 **Deadline: Sat 7 Nov 2026, 09:00 IST.** Late submissions are not accepted.
> 🧊 **Feature freeze: Sat 7 Nov, 05:00 IST.** After that, only the demo video, the form and the
> partner write-ups.
> 🎮 **Event build: target about 19:00 IST Fri 6 Nov** (2–3 h after P1).
> ⏱ Time left at last update: 12h 37m to freeze, 16h 37m to the deadline (2026-11-06 16:22 IST)
>
> Spec: [PRD.md](PRD.md) · AI disclosure: [AI_USAGE.md](AI_USAGE.md) · Rules:
> [rules.md](../../.claude/skills/ethglobal-mumbai/references/rules.md)

<!-- last-logged: ee51eb0 -->

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
| 4 | F3 | Server: a bests store (file in `DATA_DIR`) and `GET /leaderboard`. Client: a `/leaderboard` screen with 3 tabs | 35 min | Planned |
| 5 | F1 | Server: admin sign-in, a live room list and spectate. Client: the `/admin` screen and spectator mode in the scene | 60 min | Planned |

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
