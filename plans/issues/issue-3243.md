# Plan issue-3243: AnimatePresence stuck exit on mid-exit unmount — COVERED by pr-3707

## Status

- **Priority**: P1
- **Effort**: — (covered)
- **Category**: bug (pointer plan)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/3243
- **Covered by**: `plans/issues/pr-3707.md` (open PR #3707 — the most merge-ready open PR)

## Disposition

Issue #3243 (child triggers exit, its only motion component unmounts on the
next render, `PresenceChild` never fires `onExitComplete`, wrapper stuck in
DOM; working CodeSandbox repro) is fully fixed by open PR #3707, which carries
a regression test reproducing the reporter's exact scenario. Execute
`plans/issues/pr-3707.md`; do not duplicate work here. The issue auto-closes
on merge.

## Executor steps

1. Check `plans/issues/README.md`: if pr-3707 is DONE, verify issue #3243
   closed; if still open, close it referencing the merged PR.
2. If pr-3707 was rejected/closed unmerged, set this row BLOCKED and report —
   the issue has a real repro and would need a fresh fix plan.

## Done criteria

- [ ] pr-3707 resolved AND issue #3243 closed (or row BLOCKED with reason)
- [ ] `plans/issues/README.md` row updated
