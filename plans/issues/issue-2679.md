# Plan issue-2679: IntersectionObserver not re-firing after Reorder (Chrome) — COVERED by pr-3724 (verify-or-close)

## Status

- **Priority**: P2
- **Effort**: — (covered)
- **Category**: bug (pointer plan)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2679
- **Covered by**: `plans/issues/pr-3724.md` (open PR #3724 — verify-in-real-Chrome-or-close plan)

## Disposition

Issue #2679 (Chrome-only, intermittent: after dragging a Reorder.Item, an
IntersectionObserver on it never re-fires `isIntersecting: true`; reporter
believes it is a Chrome bug) has an open PR (#3724) that adds a forced-reflow
workaround — but the fix was never verified against the actual bug, and it
costs a synchronous layout in the projection hot path. `plans/issues/pr-3724.md`
is an evidence-first plan: reproduce in real Chrome, then either scope+merge
or close both PR and (with maintainer approval) comment/disposition this
issue. Execute that plan; do not duplicate work here.

## Done criteria

- [ ] pr-3724 executed; issue #2679 dispositioned per its outcome (closed on
      verified merge, or commented with the verification record on close)
- [ ] `plans/issues/README.md` row updated
