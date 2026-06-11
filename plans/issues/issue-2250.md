# Plan issue-2250: Close Next 13 app-router page-transition flash issue per maintainer's own verdict

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2250 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE (no action) and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support/close
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2250

## Verdict: INVALID/SUPPORT — close as not planned

Filed July 2023 against framer-motion 10.13 / Next 13: `AnimatePresence mode="wait"`
keyed on `usePathname()` flashes `opacity: 1` before animating, plus scrollbar
layout shift. The maintainer already issued the verdict on the thread
(mattgperry, 2026-02-01):

> "Im closing this out as after investigating page transitions a number of times
> in Next.js I don't think they're possible with the app router. Perhaps with the
> ViewTransition component from React (and therefore perhaps the AnimateView
> component coming to Motion soon-ish)"

The issue is nonetheless still open — the close evidently never went through
(`gh issue close` is known-flaky on this repo). Root cause is the Next.js app
router unmounting/remounting pages outside Motion's control; the scrollbar
shift is a browser/CSS concern (`scrollbar-gutter`), not Motion. Nothing to fix
in this repo.

## Steps

### Step 1: Approval gate

Open `plans/issues/README.md` and find the row for issue-2250. If the row is
not marked APPROVED, set this plan's status to BLOCKED in
`plans/issues/README.md` and stop.

### Step 2: Close

No new comment is required — the maintainer's 2026-02-01 comment already
explains the rationale. Close:

```
gh api -X PATCH repos/motiondivision/motion/issues/2250 -f state=closed -f state_reason=not_planned
```

(Use this API form directly; `gh issue close` may fail on this repo.)

**Verify**: `gh api repos/motiondivision/motion/issues/2250 --jq .state` → `"closed"`.

## Done criteria

- [ ] Issue 2250 state is `closed`, reason `not_planned`
- [ ] No source files modified (`git status` clean apart from plans/issues/README.md)
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- New comments on the issue since 2026-06-11 that change the picture (e.g. a
  reproduction against current `motion@12` showing a Motion-side bug) — report
  back instead of closing.
