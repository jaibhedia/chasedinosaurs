# Chase Dinosaurs · ETHGlobal Mumbai 2026 · PRD

> A living document, updated after every feature push. Last update: 2026-11-06 16:30 IST at `a9cc64c`.
> Plan and build log: [PLAN.md](PLAN.md) · AI disclosure: [AI_USAGE.md](AI_USAGE.md)

## 1. Summary

Chase Dinosaurs is getting a competitive layer for the event floor. Players score points for
holding and stealing the egg and for winning, and a live leaderboard shows every match as it
happens. An all-time board keeps each player's best single match. An admin-only spectator view
lets organisers put any live match on a big screen. Xbox controllers work on PC, and phone
players can put the stick on either side. Wallet identity replaces email for admins when the
Web3 layer lands.

## 2. Track and what counts as new

- **Track:** Continuity · Ship a Feature. Chase Dinosaurs is a proprietary game, in development
  since 2026-06-20.
- **Baseline:** tag `pre-ethglobal-mumbai-2026` → `1dcafa3` (2026-10-07). Only work after it is
  judged.
- **Team:** Shantanu Swami (Abstract Studio). Karmanya wrote the points and leaderboard rules
  (prompt P1). <confirm the roster on the Hacker Dashboard>
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
| F1 | Admin-only spectator mode | Organisers put any live match on a big screen | Sign-in at `/admin` needs an allowlisted email (`ADMIN_EMAILS`) and the passcode (`ADMIN_PASSCODE`), and everyone else is refused. Admins see the live rooms and can watch one, even mid-match. The spectator takes no seat, has no dino, and can't claim the egg or steer bots. The camera follows the egg or a chosen player, and the live board shows. | Tech, UX, WOW | — | A match on the projector, camera tracking the egg | Planned | — |
| F2 | Points and live match leaderboard | Every second with the egg counts, not just the last one | Holding the egg scores 1 point a second. A steal (taking it from another player, not the first pickup) scores 5, and the winner gets 30. The in-match board updates within 1 s for every player, solo and online, bots included. Online numbers come from the server. The results screen shows points with the breakdown. | Tech, Pract, UX | — | The board reshuffling live after a steal | Planned | — |
| F3 | All-time leaderboard | A reason to come back and beat a best | Three tabs: Longest egg hold and Most steals (each player's best single match, not a sum) and Wins. Online, server-verified matches only, with humans only. It survives a server restart. | Pract, WOW | — | Three tabs, your name highlighted | Planned | — |
| F4 | Xbox controller on PC | Play at the booth from a couch | The left stick or D-pad moves (analog). A, RB or RT fires the power, Start opens the menu and B closes it. Works with any standard-mapping pad in Chrome, Edge or Firefox, plugged in at any time. | UX | — | Playing with a pad | Planned | — |
| F5 | Stick on either side (phones) | Left-handed players aren't stuck | The stick goes left or right and the power button takes the other side. The choice is set in the in-game menu and remembered on the device. | UX | — | Flip it mid-match | Planned | — |

## 5. Partner prizes

Not chosen yet. The candidates from the [prizes page](https://ethglobal.com/events/mumbai/prizes)
that fit this game and accept Continuity projects are below. Pick at most 3.

| Partner | Track(s) | How we'd use it | Feedback for them (draft) | Status |
|---|---|---|---|---|
| 0G | Keep Building on 0G ($3k) | Bot banter and the post-match roast run on 0G Compute (OpenAI-compatible), and the request ids are logged. The game started as 0G agent brains (2026-06-20). | — | Proposed |
| Arkiv | Continuity prize ($3k / $1k) | The all-time leaderboard (F3) as Arkiv entities: queryable bests, with an expiry per season | — | Proposed. Needs an open-source licence on the repo. |
| World | [Cont] Best Use of IDKit ($2.5k) | Only World ID–verified humans get on the all-time board (Selfie Check) | — | Proposed |

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
- Partner integrations in this build (recommended in §5, not built yet).
- Solo matches on the all-time board, because the server can't verify them.

## 8. Open questions and risks

- The prompt says "also increase the …" and is cut off. What should increase? · Shantanu · before freeze
- The Wins tab counts total wins. A single match can only give 0 or 1, so "best single match"
  can't apply there. · Karmanya · confirm
- The leaderboard file lives on the server's disk. Render's free plan wipes it on a restart or
  redeploy. Attach a disk (paid) or move it to Arkiv or a database. · Shantanu · before the event
- Email-only admin isn't proof of identity, so a passcode is also required. · Shantanu · set
  `ADMIN_PASSCODE`

## 9. Change log

- 2026-11-06 16:30 IST · PRD created from the feature list (P1).
