# AI Tool Usage Disclosure · ETHGlobal Mumbai 2026

Written for the event's rule on **Use of AI Tools**. It requires saying where and how AI was
used, down to files and assets. For spec-driven work it also requires committing every spec,
prompt and planning artifact.

- **Tool:** Claude Code (Claude Opus 5.5) in VS Code, used as a pair programmer.
- **Commit-level attribution:** every AI-assisted commit ends with a `Co-Authored-By: Claude`
  trailer.
- **Planning artifacts (all committed):**
  - [PRD.md](PRD.md): the spec
  - [PLAN.md](PLAN.md): the plan and build log
  - the prompt log below
  - the instructions the agent followed:
    [`.claude/skills/ethglobal-mumbai/`](../../.claude/skills/ethglobal-mumbai/SKILL.md)

## How to verify what was built during the event

```bash
git log --oneline pre-ethglobal-mumbai-2026..main     # commit-by-commit progress
git diff --stat pre-ethglobal-mumbai-2026..main       # everything new
```

Tag `pre-ethglobal-mumbai-2026` points at `1dcafa3`, the last commit before the event.

## Division of work

**Human (Shantanu Swami, with Karmanya):**
- Shantanu chose the five features, their scope ("integrate, don't overhaul", in 2–3 hours for
  the event) and the admin identity plan (email now, wallet address later). Shantanu also
  supplied the ETHGlobal rules and set up this workflow.
- Karmanya specified the scoring: 1 point a second with the egg, 5 per steal, 30 for a win.
  Karmanya also wrote the leaderboard rules: a live per-match board, plus all-time boards ranked
  on best single matches, not sums.

**AI (Claude Code):** implementation under that direction: drafting code to the PRD's acceptance
criteria, refactors, tests, and these docs.

## Where AI was used, by file

One row per file added or changed since the baseline. A folder row (`path/`) covers everything
under it. `push-report.sh` lists the files that have no row.

AI role:

- **generated:** AI wrote it and a human reviewed it.
- **assisted:** a human wrote it and AI suggested or fixed parts.
- **none:** human only.

| File | Feature | AI role | Human role |
|---|---|---|---|
| `.claude/skills/ethglobal-mumbai/` | Setup | generated | Specified the workflow and supplied the rules (P0) |
| `docs/ethglobal-mumbai/` | Setup | generated | Directed the content (P0, P1) |
| `README.md` | Setup | generated | The Mumbai section, written to P0's disclosure requirement |
| `src/store/gameStore.ts` | F5, F2 | generated | Asked for the features (P1) |
| `src/components/MobileControls.tsx` | F5 | generated | Asked for the feature (P1) |
| `src/components/GameMenu.tsx` | F5 | generated | Asked for the feature (P1) |
| `src/lib/gamepadInput.ts` | F4 | generated | Asked for the feature (P1) |
| `src/hooks/useGamepadConnected.ts` | F4 | generated | Asked for the feature (P1) |
| `src/components/Game.tsx` | F4 | generated | Asked for the feature (P1) |
| `src/components/GameHUD.tsx` | F4, F2 | generated | Asked for the features (P1) |
| `src/lib/haptics.ts` | F4 | generated | Asked for the feature (P1) |
| `server/src/match.ts` | F2 | generated | Scoring rules by Karmanya (P1) |
| `server/src/match.test.ts` | F2 | generated | Scoring rules by Karmanya (P1) |
| `server/src/index.ts` | F2, F3 | generated | Asked for the features (P1) |
| `server/src/leaderboard.ts` | F3 | generated | Board rules by Karmanya: best single match, not sums (P1) |
| `server/src/leaderboard.test.ts` | F3 | generated | Board rules by Karmanya (P1) |
| `src/screens/Leaderboard.tsx` | F3 | generated | Three boards asked for by Karmanya (P1) |
| `src/App.tsx` | F3 | generated | Asked for the feature (P1) |
| `src/screens/Home.tsx` | F3 | generated | Asked for the feature (P1) |
| `render.yaml` | F3 | generated | Asked for the feature (P1) |
| `.gitignore` | F3 | generated | Asked for the feature (P1) |
| `src/lib/scoring.ts` | F2 | generated | Scoring rules by Karmanya (P1) |
| `src/components/LiveScoreboard.tsx` | F2 | generated | Live per-match board asked for by Karmanya (P1) |
| `src/scene/gameScene.ts` | F2 | generated | Asked to build on the existing system rather than overhaul it (P1) |
| `src/screens/Results.tsx` | F2 | generated | Asked for the feature (P1) |

## Pre-existing work (before the baseline)

The game was built before the event, with AI help on the code (see
[docs/ethonline/AI_USAGE.md](../ethonline/AI_USAGE.md)). No game art is AI-generated
([CREDITS.md](../../CREDITS.md)). Anything revived from before the baseline is marked "reused"
in the build log.

## Prompt log

The prompts that directed the build, word for word and oldest first, with times in IST.
Corrections and scope changes are kept. Approvals and small follow-ups are left out.

### P0 · 2026-11-06, about 15:55 IST · the rules and the build-log routine

> okay so cooking this for ethglobal mumbai 2026 make a prd .md and plan.md for all things you
> do after each feature push in github as per the guidelines here you go [ETHGlobal Mumbai
> dashboard pages: FAQ, Submission guidelines, Resources, saved as
> `.claude/skills/ethglobal-mumbai/references/rules.md`] firsly sabe this as a skill and then
> ill give you a feature lost

### P1 · 2026-11-06, about 16:10 IST · the feature list (with Karmanya's scoring rules)

> also check which interation would be best for the game https://ethglobal.com/events/mumbai/prizes
>
> and integrate me this feature 1) spectator mode with oly admin access so use email as of now
> later when web3 we would do address 2)"
>
> [pasted]
> [11/6, 3:56 PM] Karmanya (KARMA) CSD: - Hold the egg - 1 point per second as long as it is held.
>
> - Steal the Egg - 5 points per steal
>
> - win - 30 points (or something)
> [11/6, 3:59 PM] Karmanya (KARMA) CSD: - Also regarding the leaderboard, per match leaderboard
> realtime in match
>
> - all time leaderboard should have 3 sub leaderboard options Longest Egg holder , steals amount
> , wins. (Should be based on per match's score - like if I played 5 games and I had the highest
> egg holding time in match 1 and lower in the remaining matches ...the match 1  should be
> considered for all time
> And same way for other sub leaderboards ...and not a sum of all matches.
> [end paste]
>
> also increase the so this is the feature now match what we have the points system and based
> on that integrate" these not redo or do major overhaul now we need the game in like 2-3 hrs for
> event 3) also make the pc version support xbox controllr 4) make the control in phone
> interchangable to left or either right sides of the screen based on preerence thats it
