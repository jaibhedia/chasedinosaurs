#!/usr/bin/env bash
# Facts for the post-push doc update in SKILL.md. It shows the commits since the last
# build-log entry (with size and AI attribution), the files changed, the event totals, files
# with no row in AI_USAGE.md, CI for HEAD, and the time left. Read-only.
#
# Usage: push-report.sh [since-ref]
#   since-ref defaults to the <!-- last-logged: sha --> marker in PLAN.md, then the baseline.
set -u

BASELINE_TAG="pre-ethglobal-mumbai-2026"
BASELINE_SHA="1dcafa3"
FREEZE=1794007800     # Sat 7 Nov 2026 05:00 IST, feature freeze
DEADLINE=1794022200   # Sat 7 Nov 2026 09:00 IST, submissions close
BIG=400               # changed lines in one commit (lockfiles aside) worth flagging
DOCS="docs/ethglobal-mumbai"
NOLOCK=(':(exclude)*package-lock.json')

cd "$(git rev-parse --show-toplevel)" || exit 1

base="$BASELINE_TAG"
git rev-parse -q --verify "refs/tags/$BASELINE_TAG" >/dev/null || base="$BASELINE_SHA"

since="${1:-}"
if [ -z "$since" ] && [ -f "$DOCS/PLAN.md" ]; then
  since=$(sed -n 's/.*<!-- last-logged: \([0-9a-f]\{7,40\}\) -->.*/\1/p' "$DOCS/PLAN.md" | tail -n 1)
fi
since="${since:-$base}"
git rev-parse -q --verify "$since^{commit}" >/dev/null || { echo "Unknown commit: $since" >&2; exit 1; }

# True when AI_USAGE.md names the file, or one of its folders as `dir/`, in backticks.
covered() {
  local p="$1"
  grep -qF "\`$p\`" "$DOCS/AI_USAGE.md" && return 0
  while [ "$p" != "${p%/*}" ]; do
    p="${p%/*}"
    grep -qF "\`$p/\`" "$DOCS/AI_USAGE.md" && return 0
  done
  return 1
}

now=$(date +%s)
left() {
  local s=$(( $1 - now ))
  if [ "$s" -le 0 ]; then echo "passed"; else printf '%dh %02dm' $((s / 3600)) $((s % 3600 / 60)); fi
}

echo "== $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD), new since $(git rev-parse --short "$since")"
if upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null); then
  read -r behind ahead <<<"$(git rev-list --left-right --count "$upstream...HEAD")"
  if [ "$ahead" -gt 0 ]; then echo "   ⚠ $ahead commit(s) not pushed to $upstream"; else echo "   in sync with $upstream"; fi
  [ "$behind" -gt 0 ] && echo "   ⚠ $upstream has $behind commit(s) not pulled"
else
  echo "   ⚠ no upstream: this branch hasn't been pushed"
fi

echo
echo "== Commits, oldest first (AI = authored by Claude or has a Co-Authored-By: Claude trailer)"
shas=$(git rev-list --reverse --no-merges "$since..HEAD")
[ -z "$shas" ] && echo "   none"
for sha in $shas; do
  read -r ins del <<<"$(git show --numstat --format= "$sha" -- . "${NOLOCK[@]}" | awk '$1 != "-" { i += $1; d += $2 } END { print i + 0, d + 0 }')"
  nfiles=$(git show --name-only --format= "$sha" | grep -c .)
  others=$(git show --name-only --format= "$sha" | grep -v "^$DOCS/" | grep -c .)
  ai="  "
  grep -qi claude <<<"$(git log -1 --format='%an %(trailers:key=Co-authored-by,valueonly)' "$sha")" && ai="AI"
  note=""
  [ $((ins + del)) -gt "$BIG" ] && note="  ⚠ big"
  [ "$others" -eq 0 ] && note="$note  · log update"
  printf '   %s  %s  %s  +%s/-%s in %s files  %s%s\n' \
    "$(git rev-parse --short "$sha")" \
    "$(TZ=Asia/Kolkata git log -1 --date=format-local:'%d %b %H:%M' --format=%ad "$sha")" \
    "$ai" "$ins" "$del" "$nfiles" "$(git log -1 --format=%s "$sha")" "$note"
done

echo
echo "== Files changed since $(git rev-parse --short "$since") (A added, M modified, D deleted, R renamed; lockfiles left out)"
changes=$(git diff --name-status "$since..HEAD" -- . "${NOLOCK[@]}")
if [ -z "$changes" ]; then
  echo "   none"
else
  printf '%s\n' "$changes" | head -n 60 | sed 's/^/   /'
  n=$(printf '%s\n' "$changes" | grep -c .)
  [ "$n" -gt 60 ] && echo "   … and $((n - 60)) more"
  git diff --shortstat "$since..HEAD" -- . "${NOLOCK[@]}" | sed 's/^ */   /'
fi

echo
echo "== Event totals since $base"
echo "   $(git rev-list --count --no-merges "$base..HEAD") commits,$(git diff --shortstat "$base..HEAD" -- . "${NOLOCK[@]}")"

echo
echo "== Files changed since $base with no row in AI_USAGE.md"
if [ -f "$DOCS/AI_USAGE.md" ]; then
  missing=0
  while IFS= read -r f; do
    covered "$f" || { echo "   $f"; missing=$((missing + 1)); }
  done < <(git diff --name-only --diff-filter=d "$base..HEAD" -- . "${NOLOCK[@]}")
  [ "$missing" -eq 0 ] && echo "   none, every changed file is attributed"
else
  echo "   $DOCS/AI_USAGE.md doesn't exist yet (run the first-run setup)"
fi

echo
echo "== CI for $(git rev-parse --short HEAD)"
if command -v gh >/dev/null 2>&1; then
  runs=$(gh run list --commit "$(git rev-parse HEAD)" --json workflowName,status,conclusion \
    --jq '.[] | "   \(.workflowName): \(.status) \(.conclusion)"' 2>/dev/null)
  echo "${runs:-   no runs found (not pushed yet, or still queued)}"
else
  echo "   gh isn't installed"
fi

echo
echo "== Time, now $(TZ=Asia/Kolkata date '+%a %d %b %H:%M') IST"
echo "   to feature freeze (Sat 05:00 IST): $(left "$FREEZE")"
echo "   to deadline       (Sat 09:00 IST): $(left "$DEADLINE")"
