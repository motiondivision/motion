# Plan issue-2434: Triage layoutId-in-transform-parent as part of the #2465 coordinate-space class

> **Executor instructions**: This is a triage/consolidation plan, not a fix
> plan. Do not write fix code for this issue. Honor the approval gate before
> closing anything. When done, update the row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2434 --jq .state` → must be `open`.
> Also `gh api repos/motiondivision/motion/issues/2465 --jq .state` (the
> umbrella this consolidates into).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/issues/issue-2465.md (umbrella; this issue folds into it)
- **Category**: bug (triage)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2434

## Why this matters

Open since 2023 with zero comments; keeping it open as a standalone item
duplicates #2465 and burns triage time. The reproduction (fetched and read at
planning time — repo `Daydreamer-riri/drag-card-demo`, the CodeSandbox is just
a GitHub import of it) shows the bug is a compound of two known classes, not
a new defect.

## Current state — what the repro actually does

Source verified via
`gh api repos/Daydreamer-riri/drag-card-demo/contents/components/flow/{waterfall,content}.tsx`
and `content.module.css`:

- A full-screen draggable canvas: `<motion.div layoutRoot>` containing
  `<motion.div drag style={{ x, y }}>` (x/y are springs — tracked motion
  values), holding a grid of cards each with `layoutId={`card-${index}`}`.
- The expanded view (`content.tsx`) renders, inside `AnimatePresence`, a
  `motion.div` with the same `layoutId` and CSS class:
  ```css
  .container { position: fixed; translate: 0 !important; top: 0; left: 0; ... }
  ```
- Complaint: "When exiting, the element should return directly to its
  original position" — the exit shared-layout animation lands in the wrong
  place after the canvas has been dragged.

Three interacting causes, all known:

1. **Cross-space shared promote** — card lives in the page/drag space, the
   overlay is `position: fixed` (viewport space). This is exactly issue
   #2465 (see `checkIsScrollRoot` in
   `packages/motion-dom/src/projection/node/HTMLProjectionNode.ts:26-27` and
   the analysis in plans/issues/issue-2465.md).
2. **CSS containing-block quirk** — `position: fixed` inside a transformed
   ancestor is positioned relative to that ancestor, not the viewport
   (CSS spec, not a Motion bug). The author's `translate: 0 !important` is a
   hand-rolled workaround for precisely this, and
3. **untracked CSS `translate` property** — projection only sees transforms it
   tracks via motion values (`hasTransform(latestValues)`,
   `packages/motion-dom/src/projection/utils/has-transform.ts:16-27`); the
   CSS `translate` property is invisible to box correction, so the
   workaround in (2) corrupts the measurement math further.

## Steps

### Step 1: Confirm classification (no code)

Re-read the two source files via `gh api` (commands above) to confirm the
description still matches. No local repro build is required — the triage
rests on (1)–(3), all verified in code.

### Step 2: Draft consolidation comment

Draft (do not post yet) a comment for #2434 explaining:
- the exit animation crosses page-relative ↔ viewport-relative spaces and is
  tracked by #2465 (link plans/issues/issue-2465.md's fixture matrix once it
  exists);
- `position: fixed` inside a transformed/dragged ancestor is re-rooted by CSS
  itself — recommend portaling the overlay outside the dragged subtree
  (which also removes the need for `translate: 0 !important`);
- the CSS `translate` property is not visible to projection — use the `x`/`y`
  motion values instead.

### Step 3: Gate, then act

Post the comment and close ONLY when the `plans/issues/README.md` row for
this plan is set to `APPROVED-CLOSE` by the maintainer. Then:

```
gh api repos/motiondivision/motion/issues/2434/comments -f body='<comment>'
gh api -X PATCH repos/motiondivision/motion/issues/2434 -f state=closed -f state_reason=not_planned
```

(`gh issue close` may fail on this repo — Projects Classic GraphQL
deprecation; use the API form above.)

If the maintainer instead marks the row `APPROVED` (keep open), add the
comment without closing and link it from #2465.

## Done criteria

- [ ] Classification re-confirmed against the live repro repo
- [ ] Comment drafted and included in the report to the maintainer
- [ ] No source files modified (`git status` clean apart from plans/)
- [ ] Action taken matches the README gate state; row updated

## STOP conditions

- The repro repo has changed and no longer matches the description.
- Phase 1 of plans/issues/issue-2465.md found NO reproduction for the
  cross-space class — then #2434 needs its own repro investigation; report
  rather than closing.

## Maintenance notes

- If #2465's fix lands, ping this issue (if still open) to re-test the demo;
  the containing-block part will remain — that half is a documentation
  matter (candidate for the layout-animation troubleshooting docs).
