---
name: ethglobal-mumbai
description: ETHGlobal Mumbai 2026 rules and the post-push build-log routine for Chase Dinosaurs. Use it after every feature push, PR or merge to GitHub during the event to update docs/ethglobal-mumbai/PRD.md, PLAN.md and AI_USAGE.md (feature status, build log, per-file AI attribution, verbatim prompt log, time left). Also use it when the user shares or changes the hackathon feature list, before committing hackathon work (commit-size and attribution rules), and for any question about eligibility, the Continuity track, what counts as new work, AI-use disclosure, judging, partner prizes, the demo video, submission or the deadline, even if they don't name ETHGlobal.
---

# ETHGlobal Mumbai 2026: rules and build log

**Submissions close Saturday 7 Nov 2026, 09:00 IST.** Late entries are not accepted.

Chase Dinosaurs existed before the event (first commit 2026-06-20; it was entered at
ETHOnline 2026), so it competes in a **Continuity track**: "Ship a Feature", since the code
is proprietary. Only work after the baseline is judged, and the submission has to show what
is new and what was reused. Everything below serves that.

- **Baseline:** tag `pre-ethglobal-mumbai-2026` on `1dcafa3` (Merge PR #5, 2026-10-07), the
  last commit before the event.
- **Event docs** live in `docs/ethglobal-mumbai/`, laid out like `docs/ethonline/`:

| File | Holds | Changes |
|---|---|---|
| `PRD.md` | What and why: features with acceptance criteria, partner prizes, judging-criteria map, out of scope, pre-existing vs new | When the feature list changes, and the status after every push |
| `PLAN.md` | How and when: eligibility gates, build order, time left, build log (one entry per push), submission checklist, judging prep | Every push |
| `AI_USAGE.md` | AI disclosure: division of work, per-file attribution, verbatim prompt log | Every push |

The full rules from the ETHGlobal dashboard are in `references/rules.md`. Check it for anything
about eligibility, AI use, submission, judging, the video or partner prizes instead of
answering from memory.

## What went wrong at ETHOnline (why this routine exists)

- `docs/ethonline/AI_USAGE.md` attributed 8 files across 66 event commits, which left a gap
  when judges asked "how much of this is AI?" (see `LIVE-JUDGING.md`). Attribution written at
  each push, while the details are fresh, closes that gap.
- "Where are your prompts?" had no good answer. This time the prompts are logged verbatim and
  this skill is committed. The rules require that for spec-driven work, and a PRD-plus-prompts
  workflow counts.
- Partner write-ups (how you used their tools, feedback, comments) were written at the end
  from memory. Note integration details and SDK friction in the build log as they happen.

## First run

Do this when `docs/ethglobal-mumbai/` doesn't exist, usually right after the user shares the
feature list.

1. **Baseline tag.** If it's missing: `git tag -a pre-ethglobal-mumbai-2026 1dcafa3 -m "Last
   commit before ETHGlobal Mumbai 2026"`, then `git push origin pre-ethglobal-mumbai-2026`. If
   `main` has commits after `1dcafa3`, ask the user which of them came before the event.
2. **Commit this skill** on its own if it isn't tracked yet
   (`chore(ethglobal): rules and build-log skill for Mumbai 2026`). It's one of the planning
   artifacts judges should see.
3. **Docs.** Copy `assets/PRD.template.md`, `assets/PLAN.template.md` and
   `assets/AI_USAGE.template.md` into `docs/ethglobal-mumbai/` as `PRD.md`, `PLAN.md` and
   `AI_USAGE.md`, and fill them in:
   - PRD: one row per feature from the user's list, with acceptance criteria someone can
     check. Put anything unclear under open questions; don't guess.
   - PLAN: the build order with estimates, and the time left from `scripts/push-report.sh`.
   - AI_USAGE: paste the feature list verbatim as the next prompt (P1).
4. **README.** Add a short "ETHGlobal Mumbai 2026" section near the top. It needs one line per
   feature built at the event, links to the three docs, and the verify commands
   (`git log --oneline pre-ethglobal-mumbai-2026..main`,
   `git diff --stat pre-ethglobal-mumbai-2026..main`). Judges open the README first. For a
   Continuity entry, it's where the pre-existing vs new split is disclosed.
5. Commit the docs (`docs(ethglobal): PRD, plan and AI usage log for Mumbai 2026`) and push.

## Each feature

### Before coding

- The feature has a PRD row with acceptance criteria, and the user's request is in the prompt
  log, verbatim with the time in IST. Instructions that change direction mid-build count as
  prompts too.
- Its steps are in PLAN.md's build order.

### While coding

- **Small commits.** Commit each logical step on its own so the feature shows up as a series
  of commits. The rules say "large single commits or missing histories may be disqualified".
  More than ~400 changed lines in one commit (lockfiles aside) should be split, or the
  message should say why it can't be (a generated file, a moved folder).
- **Attribution.** AI-assisted commits end with the `Co-Authored-By` trailer. That's
  commit-level attribution; AI_USAGE.md is file-level.
- **Reused code.** If a feature revives code from before the baseline (for example
  `ChaseStake.sol`, the Privy flow or the subgraph from ETHOnline, removed on 2026-09-24),
  that is reused work. Say so in the commit message and the build log. Presenting it as new is
  what Continuity disclosure exists to catch.
- **Checks.** Before pushing, run what CI runs: `npm run build`, plus
  `npm --prefix server run typecheck && npm --prefix server test` when `server/` changed.
- **Git flow.** The repo merges PRs from a branch (`new`) with merge commits. Keep doing that
  unless the user says otherwise.
  - Leave merging to the user: a PR the author reviewed and merged is evidence of human review.
  - Don't squash-merge. It turns a feature's commits into one big commit, which is what the
    history rule penalises. Squash is enabled on the repo, so speak up if the user is about to
    use it.
  - Never force-push or rewrite pushed history.

### After the push

1. Run `bash .claude/skills/ethglobal-mumbai/scripts/push-report.sh`. It finds the last
   logged commit from the marker in PLAN.md and prints:
   - the new commits, each with its size and whether it carries AI attribution (big commits
     are flagged)
   - the files changed and the totals since the baseline
   - files that still need a row in AI_USAGE.md
   - CI for HEAD, and the time left
2. **PRD.md:** update the feature's status (Planned → Building → Shipped, or Cut with a
   reason) and fill "Shipped in" with the PR or commit range. If scope moved, add a line to its
   change log.
3. **PLAN.md:**
   - Append a build log entry (format below).
   - Move `<!-- last-logged: … -->` to the new HEAD and update the time-left line.
   - If what's left in the build order won't fit before feature freeze, propose cuts to the
     user. Don't cut silently.
4. **AI_USAGE.md:**
   - Add or update a row for every file the report says is uncovered, and append any new
     prompts.
   - Write only human contributions you saw in this conversation or the user told you about:
     direction, decisions, corrections, review, testing, art, audio. If you don't know what
     they did, ask one short question. Judges can ask about any claim, and invented credit is
     worse than none.
5. **README:** if a feature shipped, add its line to the Mumbai section.
6. If the report flagged a big commit or missing attribution, say so in the build log entry.
   Don't rewrite pushed history to hide it.
7. Commit the doc changes on their own (`docs(ethglobal): log F<n> <feature>`) and push to the
   same branch, so they go into the same PR.
8. Tell the user in two or three lines: what shipped, anything flagged, time left, and what's
   next.

### Build log entry

Fixes and small pushes get a short entry: heading, commits, files, AI. Leave out lines that
don't apply instead of writing "N/A". Name the model actually used.

    ### F3 · Wallet sign-in · Shipped · 2026-11-06 18:40 IST
    - **Commits:** `1dcafa3..a1b2c3d` (4) · PR #6 · CI ✅
    - **Files:** `src/lib/wallet.ts` (new), `src/screens/Lobby.tsx`, `server/src/match.ts` · +312/−40
    - **New vs reused:** New: email sign-in and a wallet badge in the lobby. Reused: the pre-event lobby UI; viem (MIT).
    - **AI:** Claude Code (Opus 5.5) drafted `wallet.ts` and the lobby hook. **Human:** chose embedded wallets over a connect modal, reviewed the signing flow, tested on Android.
    - **Challenge:** <the hard part and how it was solved; this answers "what challenges did you solve?" in judging>
    - **Partner notes:** <how their tool is used, and friction worth putting in the feedback field>
    - **Verified:** `npm run build` ✅ · server tests ✅ · <manual check>
    - **Next / known issues:** <…>

## Submission

Feature freeze is **Sat 7 Nov, 05:00 IST**. That leaves four hours for the video, the form and
the partner write-ups; move it only if the user asks. PLAN.md has the full checklist. The
essentials:

- **Form:** title, description, how it's made, repo link, judging option.
- **Partner prizes:** up to 3, and a partner's multiple tracks count as one. For each, write
  how you integrated their tools, your feedback, and any comments. That text is all partners
  judge.
- **Video:** 2–4 minutes and at least 720p. Use a screen recording (not a phone camera) and
  your own voice (no AI voiceover). Don't speed it up or replace talking with music over
  captions. Keep the intro under 20 s and slides to 4 bullets.
- **Judging:** Technicality, Originality, Practicality, Usability (UI/UX/DX) and WOW factor.
  Finalists get 7 minutes, 4 for the demo and 3 for Q&A. Expect "what inspired it, what tools
  and why, what challenges and how". The build log's Challenge lines are the raw material.
- **Final pass:** the report shows no uncovered files, CI is green, the README section is
  current, and the repo is public.
