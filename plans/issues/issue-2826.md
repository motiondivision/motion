# Plan issue-2826: linear keyframes motion-value flicker — COVERED by pr-3727 (close path)

## Status

- **Priority**: P3
- **Effort**: — (covered)
- **Category**: bug / needs-repro (pointer plan)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2826
- **Covered by**: `plans/issues/pr-3727.md` (close recommendation, NEEDS-DECISION)

## Disposition

Issue #2826 (animate(motionValue, [0,1], linear keyframes) flickers at ~50%)
could not be reproduced on v12; the linked repro targets framer-motion 6.2.8.
PR #3727 attempted regression-test-only coverage, and its plan recommends
closing both the PR and this issue per the repo's no-repro policy — that plan's
Step 3 handles commenting on and closing this issue (gated on maintainer
approval). Execute `plans/issues/pr-3727.md`; do not duplicate work here.

If a v12 reproduction ever surfaces on the issue, this inverts into a real
fix task — report for re-planning instead of following the close path.

## Done criteria

- [ ] pr-3727 executed (issue #2826 commented + closed not_planned, or
      BLOCKED awaiting approval)
- [ ] `plans/issues/README.md` row updated
