# Plan issue-2807: variants with literal transform string block drag — COVERED by pr-3728

## Status

- **Priority**: P1
- **Effort**: — (covered)
- **Category**: bug (pointer plan)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2807
- **Covered by**: `plans/issues/pr-3728.md` (open PR #3728, unit + Cypress tests verified failing on main)

## Disposition

Issue #2807 (a variant returning a literal `transform` string disables drag
movement) is fixed by open PR #3728 (`build-styles.ts`: drag-driven `x`/`y`
now wins over a literal variant transform string). Execute
`plans/issues/pr-3728.md` — it also broadens the fix to `z`/`translateX/Y/Z`
per review feedback. The issue auto-closes on merge.

## Executor steps

1. Check `plans/issues/README.md`: if pr-3728 is DONE, verify issue #2807
   closed; if still open, close it referencing the merged PR.
2. If pr-3728 was rejected/closed unmerged, set this row BLOCKED and report.

## Done criteria

- [ ] pr-3728 resolved AND issue #2807 closed (or row BLOCKED with reason)
- [ ] `plans/issues/README.md` row updated
