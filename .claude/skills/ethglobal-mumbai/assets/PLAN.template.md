# Chase Dinosaurs · ETHGlobal Mumbai 2026 · Plan and build log

> 🚨 **Deadline: Sat 7 Nov 2026, 09:00 IST.** Late submissions are not accepted.
> 🧊 **Feature freeze: Sat 7 Nov, 05:00 IST.** After that, only the demo video, the form and the
> partner write-ups.
> ⏱ Time left at last update: <Xh Ym> (<YYYY-MM-DD HH:MM IST>)
>
> Spec: [PRD.md](PRD.md) · AI disclosure: [AI_USAGE.md](AI_USAGE.md) · Rules:
> [rules.md](../../.claude/skills/ethglobal-mumbai/references/rules.md)

<!-- last-logged: 1dcafa3 -->

## Eligibility gates

Check each one on the dashboard. Don't assume them.

- [ ] ETH stake placed (each team member stakes individually)
- [ ] Project created on the Hacker Dashboard, and teammates joined with the team token
- [ ] Continuity track selected: Ship a Feature
- [ ] Pre-existing work disclosed in the README section, and the baseline tag pushed
- [ ] Repo is public, so judges can see the history
- [ ] Discord connected

## Build order

| # | PRD | Step | Estimate | Status |
|---|---|---|---|---|
| 1 | F1 | <step> | <h> | Planned |

## How we commit

- One logical step per commit, so each feature shows up as several commits. A commit with more
  than ~400 changed lines (lockfiles aside) gets split, or its message explains why.
- AI-assisted commits carry a `Co-Authored-By` trailer.
- Before pushing, run what CI runs: `npm run build`, plus
  `npm --prefix server run typecheck && npm --prefix server test` when `server/` changes.
- PRs come from a branch and the author merges them with a merge commit. No squash merges and
  no force-pushes.

## Build log

One entry per push, oldest first, written by the post-push routine.

## Submission checklist

- [ ] Feature freeze held, final push made, CI green, and the live build matches `main`
- [ ] Title, short description, description, how it's made, repo link
- [ ] Judging option: Finalist and Partner Prizes (the default, unless you can't attend the
  finalist session) or Partner Prizes only
- [ ] Partner prizes (up to 3). For each: how we integrated it, our feedback, and comments
  (drafts are in PRD §5)
- [ ] Demo video:
  - 2–4 minutes, at least 720p
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
