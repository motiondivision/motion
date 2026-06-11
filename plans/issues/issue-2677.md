# Plan issue-2677: dragSnapToCursor prop — COVERED by pr-3723

## Status

- **Priority**: P2
- **Effort**: — (covered)
- **Category**: feature (pointer plan)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2677
- **Covered by**: `plans/issues/pr-3723.md` (open PR #3723)

## Disposition

Issue #2677 (feature request: declarative `dragSnapToCursor` prop instead of
only `dragControls.start(e, { snapToCursor: true })`) is implemented by open
PR #3723. Its plan adds the missing pieces before merge: a 128-commit rebase,
a real Cypress E2E asserting the element re-centers under the cursor (the
current tests only spy on option plumbing), and a JSDoc fix for the
`dragListener={false}` interaction. Execute `plans/issues/pr-3723.md`; do not
duplicate work here. The issue auto-closes on merge.

## Executor steps

1. Check `plans/issues/README.md`: if pr-3723 is DONE, verify issue #2677
   closed; if still open, close it referencing the merged PR.
2. If pr-3723 was rejected/closed unmerged, set this row BLOCKED and report.

## Done criteria

- [ ] pr-3723 resolved AND issue #2677 closed (or row BLOCKED with reason)
- [ ] `plans/issues/README.md` row updated
