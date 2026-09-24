# Chase Dinosaurs: Roadmap v2 (after ETHOnline)

**Goal:** a free casual chase game that works well in the browser, installs as a PWA, and
then ships to the App Store and Google Play. Web3 is removed. The AI opponents stay.

**Order:** web first, then PWA, then native. Each step reuses the previous build: the
native apps wrap the same web bundle, so nothing gets written twice.

> Your feedback goes in [§13](#13-feedback-intake). I'll fold it into the phases before any
> code changes.

---

## 1. Where it stands (audit, Sep 24)

| Area | State | Evidence |
|---|---|---|
| Game build | ✅ Builds clean. 1.9 MB JS / **487 KB gzipped**, mostly Phaser | `cd game-app && npm run build` |
| Solo vs bots | ✅ Works. Without the server, bots fall back to scripted steering | `updateBots()` in `gameScene.ts` |
| Multiplayer | ⚠️ **Fragile by design**: the server only relays messages, and each client decides things for itself | see §4 |
| Two front-ends | ⚠️ Next.js shell (React 19) + Vite game (React 18). They hand off by a full page redirect with JSON in the URL hash | `app/game/page.tsx`, `game-app/src/App.tsx` |
| Duplicated code | ⚠️ `store/`, `data/` and `audioManager` exist twice and **have already drifted** (the two copies disagree on power-up names and durations) | `diff app/data/characters.ts game-app/src/data/characters.ts` |
| PWA | ⚠️ Manifest and a network-first service worker exist, but nothing is precached, so a fresh install can't play offline | `public/sw.js` |
| AI opponents | ✅ Work, with conditions: an LLM call every 5 s per match, needs the server and a funded key, and is branded "0G" in the HUD | `server/src/agents/agentBrain.ts` |
| Web3 | 🗑️ Privy, wagmi, viem, World ID, Arc escrow, subgraph, faucet. About 2,200 lines in files that exist only for Web3, plus pieces woven through `server/src/index.ts`, the lobby and the results page | §3 |
| Dead weight | 🗑️ `public/sprites/` (4.7 MB, not referenced anywhere), `@supabase/supabase-js` (not imported) | `grep -r "sprites/"` returns nothing |
| Docs | ⚠️ README lists 6 characters and power-ups that don't exist (the game has 4 dinos) | README "Power-Ups" table |

Mentor feedback from ETHOnline (Edgar, in `plan.md`) that is **still open**: difficulty
and practice round (#4), juice such as screen shake and particles (#6), and new arenas plus
a character redesign (#5). Already shipped: the two-slide intro (`ad20be9`), the egg reading
as the objective (`3b8e643`), and the bot difficulty ramp (`f633cc7`, capped at medium).

---

## 2. The five decisions this plan rests on

1. **Remove Web3 completely, but tag it first.** `git tag ethonline-final` before deleting
   anything, so the hackathon build can always be checked out again. No "maybe later"
   flags left in the code.
2. **Merge into one app, built on Vite.** Move the menus (landing, mode, character, map,
   lobby, results) into `game-app/` and drop the Next.js shell. Capacitor needs a static
   `dist/` with an `index.html`, Phaser already lives in Vite, and the redirect between the
   two apps reloads the page, restarts the audio, and looks like a website rather than an app.
3. **The server decides who holds the egg.** This is most likely why multiplayer "didn't
   work well" (see §4).
4. **Bots play well on their own, and the LLM does the talking.** Move the tactics
   (who hunts, who intercepts) into local code so solo play is instant, free and works
   offline. Keep the LLM for personality: taunts and reactions.
5. **Use Capacitor for iOS and Android.** It wraps the exact web build, and Phaser runs fine
   in the native WebViews. No rewrite.

---

## 3. Phase 0: Strip Web3 (1–2 days)

`git tag ethonline-final` → then delete:

| Remove | Where |
|---|---|
| Wallets / auth | `app/providers/WalletProvider.tsx`, `WalletBar`, `MultiplayerAuthGate`, `RankedStakePanel`, `useRankedStake`, `lib/arc/` |
| World ID | `WorldFaucetGate`, `server/src/world/`, `/world/*` routes, `WORLD-FEEDBACK.md` |
| Arc escrow + faucet | `packages/contracts-arc/`, `server/src/arc/`, `/arc/*` routes, settlement in `store-replay` |
| The Graph | `subgraph/`, `server/src/graph/`, `Leaderboard.tsx`, `/leaderboard`, `withOnChainRecords()`, the THREAT ASSESSMENT paragraph in the agent prompt |
| 0G leftovers | `@0glabs/0g-ts-sdk`, transcript recording, `ReplayInfo`/`replay-stored`, "0G" in the HUD pill and agent panel |
| Stubs | `/tournament`, `/asset-store` (cosmetics come back in Phase 6) |
| Deps | `@privy-io/*`, `wagmi`, `viem`, `@worldcoin/*`, `ethers`, `@supabase/supabase-js`, `@tanstack/react-query` |
| Assets | `public/sprites/` (unused, 4.7 MB) |
| Docs | Move `plan.md`, `AI_USAGE.md`, `submission/`, `SPEC.md` to `docs/ethonline/`. Rewrite the README around the game |
| License | The MIT carve-out for `packages/` disappears along with `packages/`. Decide what the new license is (open question in §12) |

**Done when:** `grep -riE "privy|wagmi|viem|arc|worldcoin|subgraph|usdc|0g"` over `app/`,
`game-app/src` and `server/src` returns nothing meaningful, and solo plus a 2-player room both
still play a full round.

---

## 4. Phase 1: Multiplayer that holds up (4–6 days) ⭐ the core fix

### What's wrong today (read from the code)

The server is a **pure relay**: `game-state-update`, `player-input`, `egg-state` and
`agent-state` are all `socket.to(room).emit(...)` with no judgement.

| Symptom players see | Cause |
|---|---|
| Two players both "have" the egg, or the egg jumps back | Each client checks contact **locally** and broadcasts that it took the egg. Two steals in the same instant are both accepted, and each client keeps whichever message arrived last |
| Bots freeze, stutter, or teleport | Bots run on one "agent authority" **client**, and everyone else renders from its uplink. A slow phone as authority means slow bots for everyone (`f5f9526` patched the dropout case) |
| Different winners on different screens | Each client runs its own clock and picks the winner in `endGame()` locally |
| Trivial to cheat | Positions are relayed after only a ±100,000 clamp |

### The fix, in order of value

| # | Task | Size | Done when |
|---|---|---|---|
| M1 | **Server-owned egg.** Clients send `egg-claim {targetId}`. The server checks distance against its last known positions plus the grace/cooldown timers, and broadcasts `egg-owner {id, seq}`. Clients ignore any `seq` older than the one they have | 1 day | Two phones tapping the holder at the same moment agree on one owner, every time |
| M2 | **Server-owned clock and result.** The server schedules the match end, decides the winner, and emits `match-result`. Clients stop calling `endGame()` on their own | ½ day | All screens show the same winner |
| M3 | **Quick Play.** One button puts you in a public room, and bots fill empty seats after ~8 s. Room codes stay for playing with friends | 1 day | Landing page → playing a match in under 10 s |
| M4 | **Mobile lifecycle.** Test backgrounding, screen lock, and switching Wi-Fi to 4G against the existing 30 s reconnect grace. Reconnect the socket on `visibilitychange` (and Capacitor `App.resume` later) | 1 day | Locking the phone for 10 s mid-match drops you back into the same match |
| M5 | **Bots on the server** (later, together with matchmaking). Move bot steering into a shared module that runs on the server, so no client is the authority. This needs the collision maps shared between client and server | 2–3 days | Kill the host's tab, and the bots keep playing smoothly for everyone else |
| M6 | **Hosting.** Render's free tier sleeps, and the first match after a sleep takes ~30 s to start. Use a paid instance, and host near the players (if most are in India, Mumbai/Singapore beats Oregon) | config | First-join latency under 1 s |

---

## 5. Phase 2: One app (3–4 days)

| Task | Done when |
|---|---|
| Port the Next pages into `game-app/` as screens (a small router or a state machine: `home → mode → character → map → lobby → game → results`) | `npm run dev` in one folder runs the whole game |
| Delete the duplicate `store/`, `data/`, `audioManager` and use one copy of each | One `characters.ts` in the repo |
| Remove the URL-hash handoff and the `localStorage` config passing | No full-page reload between menu and match, and the music keeps playing |
| Keep a static landing page only if SEO matters (Vite can prerender it, or use a single `index.html`) | Lighthouse SEO ≥ 90 on `/` |
| Split Phaser into its own chunk and load it when the menu opens, not at first paint | Menus become interactive in under 2 s on a mid-range Android |
| Put the socket URL in a runtime `config.json` rather than inlining it at build time (`77921a0` was this exact bug) | One build serves every environment |

A side benefit: the itch.io embed (`submission/LAUNCH-NOTES.md`, option B) comes free from this
work. It's the same bundle with `base: './'`.

---

## 6. Phase 3: The AI opponents

### How it works now

Every 5 s, one client sends a snapshot to `agent-tick`. The server makes **one** LLM call,
which returns a mode (`hunt | intercept | guard | roam | flee`), a persona and a taunt for each
bot. The client then steers every frame based on that intent. The provider layer
(`server/src/ai/provider.ts`) is already vendor-neutral: any OpenAI-compatible endpoint works,
configured by three env vars.

### What to change

| # | Task | Why |
|---|---|---|
| A1 | **Local role assignment.** The prompt already spells out the tactic: the closest bot hunts, the others intercept or guard the lanes, and they never all dogpile. Implement that rule directly in `updateBots()` so every bot has a role from the first frame | Solo play gets smart, instant and offline. Today the first 5 s of each round, and every offline match, runs on the dumb fallback |
| A2 | **Difficulty: Easy / Normal / Hard.** Map each level to bot speed, prediction lead, reaction delay, and how often bots use power-ups. `botRamp()` already exists and is capped at medium | Edgar #4. It also gives new players a first win |
| A3 | **LLM handles voice, not tactics.** Call it when something happens (egg stolen, near miss, last 10 s, match end) rather than every 5 s. Use a small, fast model. Keep persona-flavoured canned lines as the fallback so bots are never silent | Roughly 3× fewer calls per match. Taunts land when they're funny, not on a timer |
| A4 | **Named bot personalities.** For example "Rex (cocky)" or "Pip (sneaky)", each with a consistent colour, name tag and voice. The persona system is already there; give it a face | Players remember "that sneaky one" and want to beat it |
| A5 | **Post-match roast.** One LLM line on the results screen, based on the match events ("held the egg for 2 s total, bold strategy") | Cheap, shareable, and makes people want a rematch |
| A6 | **Cost guard.** Per-IP and per-day caps on AI calls, and hide the "AI offline" pill from players (log it instead) | A public launch shouldn't be able to drain the key |

**Done when:** with no server running at all, solo plays well on all three difficulties.
With the server running, the bots also talk.

---

## 7. Phase 4: Game feel and onboarding (3–5 days)

| Task | Notes |
|---|---|
| **Juice** (Edgar #6) | Screen shake and a short hit-stop on a steal, a particle burst when the egg is grabbed, a speed-line trail, a camera punch on power-up use |
| **Haptics** | `navigator.vibrate` on the web; Capacitor Haptics on native. Tap on steal, buzz while holding the egg |
| **SFX pass** | There are only 3 audio files today (theme, running, power-up). Add: steal, countdown beeps, last-10-s tension loop, win and lose stings. `theme.mp3` is 630 KB, so re-encode it to ~128 kbps |
| **First-run tutorial** | Replace the text slides with a 20-second guided round against one Easy bot: grab the egg, get tagged, steal it back |
| **Win condition check** ❓ | Today the **last holder at the buzzer wins**, so the first 50 s barely matter. Playtest the alternative: most total seconds held wins, with a bonus for holding at the buzzer. See §12 |
| **Arenas and characters** (Edgar #5) | This is art work, so schedule it after the above. One new arena is worth more than polishing a third one |
| **Fix the docs** | README power-up table, 45 s vs 60 s mentions, and the "30 seconds" copy in the launch kit |

---

## 8. Phase 5: PWA done properly (2 days)

| Task | Notes |
|---|---|
| **Precache the game** with `vite-plugin-pwa` (Workbox): the JS, sprites, tiles and audio | A fresh install can play solo in airplane mode |
| **Update prompt** | Show "New version, tap to reload" instead of silently serving the old build |
| **Install UX** | On Android, use the `beforeinstallprompt` button. On iOS there's no prompt, so show a one-time "Share → Add to Home Screen" hint |
| **iOS limits** | iOS PWAs ignore `orientation: landscape` and `display: fullscreen`, so keep `RotateOverlay`. Audio needs a user tap first, and `AudioInitializer` already handles this, but re-test it after the merge |
| **Maskable icon** | It's currently the same file as the `any` icon. It needs padding inside the safe zone, or Android crops the dino |
| **Budget** | Lighthouse PWA pass. Under 1 MB gzipped to first playable, with Phaser loaded lazily |

**Ship the public web launch here.** Post on r/WebGames, r/playmygame and itch.io (the kit is
already written in `submission/LAUNCH-NOTES.md`). Collect feedback before spending money on
the stores.

---

## 9. Phase 6: Native apps (1–2 weeks, mostly waiting on review)

### Capacitor setup (2–3 days)

`npx cap init` → `webDir: "dist"` → add the `ios` and `android` platforms. Plugins:
**Haptics**, **Screen Orientation** (a real landscape lock), **Status Bar** (hidden), **Splash
Screen**, **App** (pause/resume → socket reconnect), **Keep Awake** during matches.

### Android

- **Fast path:** a TWA (Trusted Web Activity via Bubblewrap) puts the PWA on Play almost for
  free. Good for an early closed test.
- **Real path:** a Capacitor build. Play requires an **AAB**, not an APK. An APK is only for
  sideloading or testers.
- ⏱️ **Start the clock early.** New personal Play developer accounts must run a closed
  test with **12 testers for 14 consecutive days** before production (check the current
  rule when you register). Open the closed test as soon as Phase 1 is stable, not at the end.
- $25 one-time fee.

### iOS

- $99/year Apple Developer account, and TestFlight first.
- **Guideline 4.2 (minimum functionality):** thin web wrappers get rejected. Offline solo,
  native haptics and a real orientation lock make it clearly an app. Game Center
  leaderboards help further.
- **Guideline 1.2 (user-generated content):** player names and **voice chat with strangers**
  require filtering, report and block tools. The simplest fix is to allow voice only in
  private friend rooms, and use preset names or a profanity filter.
- Microphone permission string (`NSMicrophoneUsageDescription`) if voice ships.
- Keep it guest-first: no accounts means no Sign in with Apple requirement and no
  account-deletion flow.
- Privacy policy URL (`/privacy` exists; update it once Web3 is gone) and App Privacy labels.

---

## 10. Phase 7: Reasons to come back (after it's fun, not before)

XP and levels, unlockable skins (`app/data/cosmetics.ts` already sketches them), daily
challenges, and a leaderboard on a plain database (Supabase/Postgres) instead of the subgraph.
Monetisation, if any: cosmetic in-app purchases only, never pay-to-win. Leave all of this out
of v1.

Add analytics events now, though, because they decide everything above: `play_pressed →
match_started → match_finished → second_match`. That last number answers "is it fun?".

---

## 11. Schedule (one developer, roughly)

| Week | Ship | Proof |
|---|---|---|
| 1 | Phase 0 (strip Web3) + A1/A2 (local AI and difficulty) | Solo plays well offline |
| 2 | Phase 1 M1–M4 (egg, clock, Quick Play, reconnect) | 4 phones, 10 rounds, zero desyncs |
| 3 | Phase 2 (one app) + Phase 5 (PWA) | Installs, plays in airplane mode, public web launch |
| 4 | Phase 4 (feel, SFX, tutorial) + A3–A5 · **open the Play closed test** | Playtest feedback round |
| 5–6 | Capacitor, TestFlight, Play production | Store listings live |

Cut order under pressure: A4/A5 → new arenas → M5 → TWA.
Never cut: M1, M2, A1, and PWA precache.

---

## 12. Open questions for you

1. **Voice chat:** keep it (friends-only on mobile), or cut it from v1?
2. **Win rule:** last holder wins (current), or most time held? I'd playtest both.
3. **Landscape only, or add portrait?** Most casual mobile play is one-handed portrait.
   That means re-laying out the camera and HUD, but it widens the audience.
4. **License:** stay proprietary, or open-source the engine?
5. **Where are the players?** This decides the server region.
6. **Keep a Next.js landing page for SEO,** or go all-Vite?

---

## 13. Feedback intake

_Paste feedback here, or in chat. Each item gets mapped to a phase above._

| # | Feedback | From | → Phase / task |
|---|---|---|---|
| | | | |
