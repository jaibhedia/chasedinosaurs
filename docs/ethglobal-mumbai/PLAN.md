# Chase Dinosaurs · ETHGlobal Mumbai 2026 · Plan and build log

> 🚨 **Deadline: Sat 7 Nov 2026, 09:00 IST.** Late submissions are not accepted.
> 🧊 **Feature freeze: Sat 7 Nov, 05:00 IST.** After that, only the demo video, the form and the
> partner write-ups.
> 🎮 **Event build: target about 19:00 IST Fri 6 Nov** (2–3 h after P1).
> ⏱ Time left at last update: 12h 30m to freeze, 16h 30m to the deadline (2026-11-06 16:30 IST)
>
> Spec: [PRD.md](PRD.md) · AI disclosure: [AI_USAGE.md](AI_USAGE.md) · Rules:
> [rules.md](../../.claude/skills/ethglobal-mumbai/references/rules.md)

<!-- last-logged: a9cc64c -->

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
| 1 | F5 | Stick-side preference in the store; MobileControls flips; toggle in the menu | 15 min | Planned |
| 2 | F4 | Gamepad polling into the shared touch-input channel; Start/B for the menu | 25 min | Planned |
| 3 | F2 | Server: steals and points in `Match`, a 1 s `match-scores` broadcast. Client: a live board in the HUD and points on the results screen | 45 min | Planned |
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

### F0 · Setup · Shipped · 2026-11-06 16:30 IST
- **Commits:** `1dcafa3..a9cc64c` (1), plus this docs commit
- **Files:** `.claude/skills/ethglobal-mumbai/` (new), `docs/ethglobal-mumbai/` (new), `README.md`
- **New vs reused:** New: the rules skill, the PRD, the plan, the AI log, and the baseline tag
  `pre-ethglobal-mumbai-2026`. The layout follows `docs/ethonline/`.
- **AI:** Claude Code (Opus 5.5) wrote the skill, the report script and these docs.
  **Human:** supplied the ETHGlobal rules and asked for this workflow (P0). Gave the feature list,
  with Karmanya's scoring rules (P1).
- **Verified:** `push-report.sh` runs on macOS bash 3.2 · CI on `1dcafa3` ✅

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
