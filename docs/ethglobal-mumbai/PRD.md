# Chase Dinosaurs · ETHGlobal Mumbai 2026 · PRD

> A living document, updated after every feature push. Last update: 2026-11-07 02:55 IST at `9059eca` (PR #7 merged; the overlap fix in PR #8).
> Plan and build log: [PLAN.md](PLAN.md) · AI disclosure: [AI_USAGE.md](AI_USAGE.md)

## 1. Summary

Chase Dinosaurs is getting a competitive layer for the event floor. Players score points for
holding and stealing the egg and for winning, and a live leaderboard shows every match as it
happens. An all-time board keeps each player's best single match. An admin-only spectator view
lets organisers put any live match on a big screen. Xbox controllers work on PC, and phone
players can put the stick on either side. A Settings screen shows the controls for keyboard and
mouse, controller and phone, and lights up whatever you press, so a player can check a pad
before a match. Only verified humans (World ID) rank on the all-time board, one row per person,
and the bots' AI runs on 0G Compute with a receipt for every line. Players go by a name they pick
instead of their dino's, and a controller works in every menu, not just in a match. Wallet
identity replaces email for admins when the Web3 layer lands.

## 2. Track and what counts as new

- **Track:** Continuity · Ship a Feature. Chase Dinosaurs is a proprietary game, in development
  since 2026-06-20.
- **Baseline:** tag `pre-ethglobal-mumbai-2026` → `1dcafa3` (2026-10-07). Only work after it is
  judged.
- **Team:** Shantanu Swami (Abstract Studio). Karmanya wrote the points and leaderboard rules
  (prompt P1) and asked for the controls screen (P2). <confirm the roster on the Hacker Dashboard>
- **Built before the event (not judged):**
  - **The game:** a Phaser + React chase game. Solo play is against three bots on three
    difficulties. Online, up to four players connect through a Socket.IO server that decides egg
    ownership and runs the clock. Also bot handover, proximity voice, four dinos with powers, and
    LLM bot banter.
  - **Platforms:** the PWA, Capacitor shells for Android and iOS, and CI.
  - **Art:** original pixel art plus itch.io packs ([CREDITS.md](../../CREDITS.md)).
  - **The old Web3 layer:** the ETHOnline 2026 work (Arc USDC escrow, Privy, World ID, subgraph,
    0G agents) was removed on 2026-09-24. Anything revived from it counts as reused.
- **New at Mumbai:** the features in §4 marked Shipped.

## 3. Problem and users

- **Players:** people playing at the event booth on their phones or on a PC with a controller,
  and online players afterwards.
- **Problem:** the game picked a winner, but nothing more. There was no score to chase, no
  record of who played best, no way to show a match to a crowd, and no controller support. The
  stick was locked to the right side.
- **Why onchain (next):** scores and identities that players own, and admins identified by
  wallet instead of email. See §5.

## 4. Features

Status: Planned → Building → Shipped, or Cut (with the reason in §9).

| ID | Feature | User value | Acceptance criteria | Criteria served | Partner | Demo beat | Status | Shipped in |
|---|---|---|---|---|---|---|---|---|
| F1 | Admin-only spectator mode | Organisers put any live match on a big screen | Sign-in at `/admin` needs an allowlisted email (`ADMIN_EMAILS`) and the passcode (`ADMIN_PASSCODE`), and everyone else is refused. Admins see the live rooms and can watch one, even mid-match. The spectator takes no seat, has no dino, and can't claim the egg or steer bots. The camera follows the egg or a chosen player, and the live board shows. | Tech, UX, WOW | — | A match on the projector, camera tracking the egg | Shipped | `98352cf`, `532d8f1`, `a360b12` |
| F2 | Points and live match leaderboard | Every second with the egg counts, not just the last one | Holding the egg scores 1 point a second. A steal (taking it from another player, not the first pickup) scores 5, and the winner gets 30. The in-match board updates within 1 s for every player, solo and online, bots included. Online numbers come from the server. The results screen shows points with the breakdown. | Tech, Pract, UX | — | The board reshuffling live after a steal | Shipped | `5ae683a`, `ee51eb0`, fix `9059eca` |
| F3 | All-time leaderboard | A reason to come back and beat a best | Three tabs: Longest egg hold and Most steals (each player's best single match, not a sum) and Wins. Online, server-verified matches only, with humans only. It survives deploys, restarts and idle sleeps (saved to Upstash Redis). | Pract, WOW | — | Three tabs, your name highlighted | Shipped | `6f37c94`, `17be8bb`, `ee10c4a` |
| F4 | Xbox controller on PC | Play at the booth from a couch | The left stick or D-pad moves (analog). A, RB or RT fires the power, Start opens the menu and B closes it. Works with any standard-mapping pad in Chrome, Edge or Firefox, plugged in at any time. | UX | — | Playing with a pad | Shipped | `ec97817` |
| F5 | Stick on either side (phones) | Left-handed players aren't stuck | The stick goes left or right and the power button takes the other side. The choice is set in the in-game menu and remembered on the device. | UX | — | Flip it mid-match | Shipped | `4631219` |
| F6 | Controls in Settings | Players can see the controls for their device, and check a pad works, before or during a match | Home has a Settings button, and the in-game menu has Controls. Both show three tabs (Keyboard & mouse, Controller, Phone) that match the real bindings, and open on the tab for the device in use. A held key or pad button lights up its row, and the Controller tab names the connected pad and moves a dot with the stick. The Phone tab sets the stick side (F5) with a preview. | UX, Pract | — | Plug in a pad, press A: the Power row lights up | Shipped | `343f614`, `315ab00`, `3b3d2ea`, `beb935f` |
| F7 | Verified humans on the all-time board | A board people can trust: one person, one row | With the `WORLD_*` settings, only players verified with World ID rank on the all-time boards. The credential is Selfie Check; Proof of Human is also accepted. A Verify panel on `/leaderboard` opens World's widget. The server signs each request, sends the proof to World's `/api/v4/verify` and stores the nullifier. A second profile from the same World ID is refused ("One person, one row"), and cancelling keeps you playing unranked. Without the settings the board is unchanged. | Tech, Pract | World | Verify on a phone, then the board shows you | Shipped (needs settings) | `cfd68cc`, `2e74e23`, `6df6d83` · [PR #7](https://github.com/jaibhedia/chasedinosaurs/pull/7) |
| F8 | 0G Compute receipts for the bots' AI | The bots' banter runs on decentralized compute, and each line can be traced | With `AI_BASE_URL` on 0G Compute, every bot line and roast keeps a receipt: from the Router's `x_0g_trace` (request id, provider address), or from the `ZG-Res-Key` header of a provider reached directly. `/ai/receipts` lists them, and the results screen shows "Written on 0G Compute · request …" under the roast. Other providers are unaffected. | Tech, WOW | 0G | The receipt under the roast, then `/ai/receipts` | Shipped (needs settings) | `3967eaa`, `4a78f68`, `9635ddf` · [PR #7](https://github.com/jaibhedia/chasedinosaurs/pull/7); `64033d5` · [PR #8](https://github.com/jaibhedia/chasedinosaurs/pull/8) |
| F9 | Player names | The boards show people, not four dino names | Players pick a name on the mode screen, in Settings or in a room's lobby: 2 to 16 letters in any script, digits, spaces and `. _ -`. A new player starts as "Dino 1234". It's saved on the device and sent with every room join, and a rename in a room reaches everyone before the match. The roster, other players' name tags, the live board, the results and the all-time board show it; bots keep their dino's name. The server applies the same rules and adds " 2" to a name someone in the room already has. | UX, Pract | — | Type a name, join a room: it's on the roster and over your dino | Shipped | `3d9f7f8`, `989cb07`, `4c02af1` · [PR #7](https://github.com/jaibhedia/chasedinosaurs/pull/7) |
| F10 | Controller navigation in menus | A pad works from the home screen to the results, not just in a match | On every screen the D-pad or left stick moves focus to the nearest button that way (hold to repeat), A presses it and B presses the screen's Back. Focus starts on the main action (Play, Quick Play, the open Controls tab) and shows as an outline while the pad is in use; a click, tap or key hides it. In a match Start opens the menu and the pad then drives it while the dino stands still. How to Play and the in-game menu keep focus inside them, and on the controller check B only lights its row. | UX | — | Home → Play → Quick Play with the pad only | Shipped | `76e478b`, `de5bae2` · [PR #7](https://github.com/jaibhedia/chasedinosaurs/pull/7) |

## 5. Partner prizes

**Entered: World and 0G**, two of the three allowed. Arc fit too but wasn't built before the
freeze, so the third slot stays empty. Checked against the
[prizes page](https://ethglobal.com/events/mumbai/prizes) on 2026-11-06 at 19:50 IST (P3) and ranked
by fit, hard requirements and the time left. Feedback for each partner goes in the build log's
Partner notes while integrating.

| # | Partner | Track | How we'd use it | The requirement that decides it | Status |
|---|---|---|---|---|---|
| 1 | World · **built (F7)** | [Cont] Best Use of IDKit ($2.5k: up to 2 teams × $1,250) | One human, one row on the all-time board. Today a second browser profile is a second player, so two tabs in a private room can farm wins. Verified players rank; everyone else still plays. Selfie Check is the proportionate credential for a free board; Proof of Human only if cash is attached. | IDKit with server-side verification, a success and an alternative path in the demo, and a short debrief. No licence requirement. | **Entered** (F7) |
| 2 | 0G · **built (F8)** | Keep Building on 0G ($3k) | The bots' banter already calls any OpenAI-compatible endpoint; point it at 0G Compute and log the request ids. The game started on 0G agent brains (2026-06-20). | A 0G Compute request id, Storage root hash or Chain contract from this hackathon, a dated changelog from a prior state, and a video under 3 min. Paid at 0G's discretion. | **Entered** (F8) |
| 3 | Arc · not started | Arc Studio Continuity Track: Bring Your Project to Arc ($3k) | An organiser-funded USDC prize for the top verified human, paid on Arc from the admin screen. Players never pay in, which keeps it clear of real-money gaming. The ETHOnline build had an Arc USDC escrow (removed 2026-09-24). | Built in Arc Studio: a shareable Studio project, shown in the demo (Studio can start from a GitHub repo). A working frontend and backend, and an architecture diagram. | Not entered: not built before the freeze |
| — | Arkiv | Build on Arkiv, existing projects ($3k / $1k, plus $500 with Swarm) | The all-time board as Arkiv entities, which would also stop the Render resets (§8) | "A public repo with an open-source license." The repo is proprietary by the 2026-09-24 decision (ROADMAP §12). | Not entered: needs an open-source licence |

Ruled out: Hedera (for projects already on Hedera), Whitechain (a USDT payment flow), Uniswap and ENS
(open source, and no swap or naming use), Chainlink (CCIP state changes), 1inch (Aqua/SwapVM
swaps), Ethereum Foundation (Anon-RPC reads; the game makes none) and Definitive (DeFi).

## 6. Judging-criteria map

| Criterion | What earns it here |
|---|---|
| Technicality | Server-authoritative scoring. Spectators join socket rooms without taking a seat, and a mid-match join syncs. A bests-not-sums all-time board. |
| Originality | A chase game scored on time with the egg and steals, with a live board for spectators |
| Practicality | Used on the event floor today: phones, a PC with a pad, and a big screen |
| Usability (UI/UX/DX) | Controller support, a choice of stick side, and a live board that's readable at a glance |
| WOW factor | A live match on the projector with the board reshuffling on every steal |

## 7. Out of scope

- Wallet or address identity. Admins use email now, and an address comes with the Web3 layer.
- Arc's USDC prize for the top verified human (§5): not built, so not entered.
- Solo matches on the all-time board, because the server can't verify them.
- Rebinding keys or buttons. The Controls screen shows the bindings; it doesn't change them.

## 8. Open questions and risks

- ~~The prompt says "also increase the …" and is cut off.~~ Answered by pasting Karmanya's full
  message (P2), which adds one request: the controls in Settings, now F6.
- ~~The Wins tab counts total wins.~~ Decided (P3): total online wins, with ties broken by the best
  single-match points, so the per-match rule still settles ties. A single match gives 0 or 1, so a
  best-match wins board would put every winner at 1. Karmanya can still overrule it; it's a
  one-line change.
- ~~The leaderboard file is wiped by Render's free plan.~~ Fixed in `ee10c4a` (P4): with
  `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set, the board lives in a free Upstash
  Redis database and survives deploys, restarts and idle sleeps. Still open: the free server sleeps
  after 15 idle minutes, and the next player waits about a minute. The Starter plan ($7/month)
  or a free uptime check on `/health` keeps it awake. · Shantanu · set the two vars on Render
- Email-only admin isn't proof of identity, so a passcode is also required. · Shantanu · set
  `ADMIN_PASSCODE`
- World ID stops one person holding many rows, but wins farmed with unverified alt tabs can still
  feed one verified row. Next: count a match for the all-time board only when 2+ verified humans
  played. · Shantanu · after the event
- World (F7) and 0G (F8) need real credentials to demo: a World Developer Portal app, and a 0G
  Router key with a 0G deposit. · Shantanu · before the video

## 9. Change log

- 2026-11-06 16:14 IST · PRD created from the feature list (P1).
- 2026-11-06 18:10 IST · F6 (controls in Settings) added from Karmanya's full message (P2).
- 2026-11-06 19:55 IST · Partner picks re-ranked against the prize rules: Arc in, Arkiv out on its
  open-source requirement. Wins decided (P3).
- 2026-11-06 20:05 IST · F3 now keeps the board in Upstash Redis instead of a paid disk (P4).
- 2026-11-06 22:15 IST · F7 (World ID) and F8 (0G Compute receipts) added and built (P6). Arc not started.
- 2026-11-06 23:25 IST · F9 (player names) and F10 (controller navigation in menus) added and
  built as the last features (P8). PR #7 is the final PR.
- 2026-11-07 02:55 IST · PR #7 merged (01:43). Fix: on desktop the voice button covered F2's
  live board online (P11); PR #8.
- 2026-11-07 03:30 IST · §5: World (F7) and 0G (F8) entered; Arc not built, so not entered
  (P15).
- 2026-11-07 03:53 IST · F8 also keeps receipts from a 0G provider reached directly
  (`ZG-Res-Key`), because the team's 0G credentials are for one (P19).
- 2026-11-07 04:08 IST · F7 in staging asks for Proof of Human, so World's simulator can verify
  without an Orb; production still asks for Selfie Check (P21).
