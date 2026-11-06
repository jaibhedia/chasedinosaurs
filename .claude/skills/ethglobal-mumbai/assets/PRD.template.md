# Chase Dinosaurs · ETHGlobal Mumbai 2026 · PRD

> A living document, updated after every feature push. Last update: <YYYY-MM-DD HH:MM IST> at `<sha>`.
> Plan and build log: [PLAN.md](PLAN.md) · AI disclosure: [AI_USAGE.md](AI_USAGE.md)

## 1. Summary

<Two or three sentences: what we're adding to Chase Dinosaurs at Mumbai, who it's for, and why
it needs Ethereum.>

## 2. Track and what counts as new

- **Track:** Continuity · Ship a Feature. Chase Dinosaurs is a proprietary game, in development
  since 2026-06-20.
- **Baseline:** tag `pre-ethglobal-mumbai-2026` → `1dcafa3` (2026-10-07). Only work after it is
  judged.
- **Team:** <names and GitHub handles>
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

- **Players:** <who they are, and what they get>
- **Problem:** <what's missing or broken today>
- **Why onchain:** <what Ethereum makes possible that a game server can't>

## 4. Features

Status: Planned → Building → Shipped, or Cut (with the reason in §9).

| ID | Feature | User value | Acceptance criteria | Criteria served | Partner | Demo beat | Status | Shipped in |
|---|---|---|---|---|---|---|---|---|
| F1 | <name> | <why a player cares> | <conditions someone can check> | <Tech / Orig / Pract / UX / WOW> | <partner or —> | <how it shows in the 4-minute demo> | Planned | — |

## 5. Partner prizes

Up to 3, and a partner's multiple tracks count as one. The submission text is all partners
judge, so draft it as features land.

| Partner | Track(s) | How we use it | Feedback for them (draft) | Status |
|---|---|---|---|---|
| <partner> | <track> | <integration> | <friction, docs gaps, what worked> | Planned |

## 6. Judging-criteria map

| Criterion | What earns it here |
|---|---|
| Technicality | <…> |
| Originality | <…> |
| Practicality | <…> |
| Usability (UI/UX/DX) | <…> |
| WOW factor | <…> |

## 7. Out of scope

- <what we're deliberately not building, and why>

## 8. Open questions and risks

- <question or risk> · <owner> · <decide by>

## 9. Change log

- <YYYY-MM-DD HH:MM IST> · <what changed in scope, and why>
