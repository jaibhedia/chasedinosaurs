# AI Tool Usage Disclosure · ETHGlobal Mumbai 2026

Written for the event's rule on **Use of AI Tools**. It requires saying where and how AI was
used, down to files and assets. For spec-driven work it also requires committing every spec,
prompt and planning artifact.

- **Tool:** Claude Code (Claude Opus 5.5) in VS Code, used as a pair programmer. <add any other
  AI tool used during the event>
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

**Human (<name>):** <only what is true and was observed. For example: chose the features and
their order (prompt P1), the scope calls, review and merge of every PR, device testing, any art
or audio made during the event>

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
| `docs/ethglobal-mumbai/` | Setup | generated | Directed the content (P0, P1), reviewed |
| `README.md` | Setup | generated | Reviewed the Mumbai section |

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
