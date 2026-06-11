# Plan issue-2674: accordion rapid-click exit glitch — COVERED by pr-3725 (close-or-merge decision)

## Status

- **Priority**: P3
- **Effort**: — (covered)
- **Category**: bug / needs-repro (pointer plan)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2674
- **Covered by**: `plans/issues/pr-3725.md` (draft test-only PR #3725, NEEDS-DECISION)

## Disposition

Issue #2674 (keyed motion.section accordion inside AnimatePresence glitches
under rapid clicking) could not be reproduced against the current codebase;
the reporter's CodeSandbox was unobtainable (Cloudflare-blocked) so the
scenario was reconstructed. Draft PR #3725 carries the reconstructed tests and
explicitly asks the maintainer to choose: land the coverage or close.
`plans/issues/pr-3725.md` handles both paths (APPROVED-CLOSE / APPROVED-MERGE),
including dispositioning this issue. Execute that plan; do not duplicate work
here.

If a fresh repro appears on the issue, report for re-planning instead.

## Done criteria

- [ ] pr-3725 executed; issue #2674 dispositioned per the chosen path
- [ ] `plans/issues/README.md` row updated
