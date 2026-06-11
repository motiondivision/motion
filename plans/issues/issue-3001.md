# Plan issue-3001: scroll() rangeStart/rangeEnd support — COVERED by pr-3713

## Status

- **Priority**: P2
- **Effort**: — (covered)
- **Category**: feature (pointer plan)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/3001
- **Covered by**: `plans/issues/pr-3713.md` (open DRAFT PR #3713, re-attempt of closed #3646)

## Disposition

Issue #3001 (feature: `scroll()` should support native WAAPI
`rangeStart`/`rangeEnd` + `fill: auto` so animations go inactive outside the
range, instead of `offset` clamping to 0/1) is implemented by draft PR #3713.
That plan is gated on a maintainer decision — PR #3646 (first attempt) was
closed without comment, and only the maintainer knows if that was deliberate.
Execute `plans/issues/pr-3713.md`; do not duplicate work here.

## Executor steps

1. Check `plans/issues/README.md`: if pr-3713 is DONE, verify issue #3001
   closed (its plan's Step 4 covers closing); if pr-3713 was REJECTED, comment
   on #3001 that the API was declined and close it not_planned (gated on the
   README row being marked APPROVED for that close).

## Done criteria

- [ ] pr-3713 resolved AND issue #3001 dispositioned accordingly
- [ ] `plans/issues/README.md` row updated
