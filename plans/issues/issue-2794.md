# Plan issue-2794: child stopPropagation traps drag gesture — COVERED by pr-3731

## Status

- **Priority**: P1
- **Effort**: — (covered)
- **Category**: bug (pointer plan)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2794
- **Covered by**: `plans/issues/pr-3731.md` (open PR #3731, Jest regression test fails-first verified)

## Disposition

Issue #2794 (child calling `event.stopPropagation()` in `onPointerUp` leaves
the dragged element following the cursor — window-level bubble-phase
`pointerup` never fires) is fixed by open PR #3731, which moves PanSession and
press end-listeners to the capture phase and fixes a latent capture-listener
removal leak. Execute `plans/issues/pr-3731.md` — note its merge step
surfaces a deliberate behavior change (capture-phase `pointermove` can no
longer be paused by descendants stopping propagation) for maintainer sign-off.
The issue auto-closes on merge.

## Executor steps

1. Check `plans/issues/README.md`: if pr-3731 is DONE, verify issue #2794
   closed; if still open, close it referencing the merged PR.
2. If pr-3731 was rejected/closed unmerged, set this row BLOCKED and report.

## Done criteria

- [ ] pr-3731 resolved AND issue #2794 closed (or row BLOCKED with reason)
- [ ] `plans/issues/README.md` row updated
