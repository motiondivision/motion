# Plan issue-3741: Turbopack OOM from motion/react duplicate re-export — COVERED by pr-3743

## Status

- **Priority**: P2
- **Effort**: — (covered)
- **Category**: bug (pointer plan)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/3741
- **Covered by**: `plans/issues/pr-3743.md` (open PR #3743)

## Disposition

Issue #3741 (motion@12.40.0 OOMs Next.js 16 Turbopack dev server on Windows;
swapping to framer-motion fixes it) is fully covered by open PR #3743, which
removes the duplicate-source re-export in `packages/motion/src/react.ts` — the
only structural difference between the two import paths. Execute
`plans/issues/pr-3743.md`; do not duplicate work here.

That plan already includes pinging the #3741 reporter for confirmation (its
Step 3) and gates the merge on reporter confirmation or maintainer approval.
The issue auto-closes when the PR merges ("Fixes #3741" in the PR body).

## Executor steps

1. Check `plans/issues/README.md`: if pr-3743 is DONE, verify issue #3741 is
   closed (`gh api repos/motiondivision/motion/issues/3741 --jq .state`); if
   still open, close it referencing the merged PR.
2. If pr-3743 was REJECTED or closed unmerged, this issue needs re-planning —
   set this row to BLOCKED and report.

## Done criteria

- [ ] pr-3743 resolved AND issue #3741 closed (or row BLOCKED with reason)
- [ ] `plans/issues/README.md` row updated
