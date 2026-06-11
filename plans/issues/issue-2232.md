# Plan issue-2232: Resolve "[BUG] Reorder is not compatible with LazyMotion" via plan 016

> **Executor instructions**: Pointer plan — the work is owned by
> `plans/016-reorder-lazymotion-warning.md`. Do NOT implement anything from
> this file. Follow the steps only when their gates are met. When done,
> update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2232 --jq '.state'` → `open`.
> If closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/016-reorder-lazymotion-warning.md (DONE + released)
- **Category**: docs / dx
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2232

## Classification: COVERED (by plans/016-reorder-lazymotion-warning.md)

## Issue context

Filed 2023-07-15, 0 comments. Reporter's two asks:

1. "Reorder should be compatible with LazyMotion (being uninteractive until
   features load)" — i.e. Reorder should render `m` components. This is the
   **deferred breaking fix** in plan 016's maintenance notes (Reorder renders
   the full `motion` proxy via `packages/framer-motion/src/components/Reorder/Group.tsx:7,87`
   and `Item.tsx:8,75`, so importing Reorder pulls the whole feature bundle).
   Plan 016 does NOT do this; it requires a major-version decision.
2. "Alternatively, the Docs should mention this behavior" — plan 016 Step 3
   adds the limitation note to the JSDoc of both `Props` interfaces, and its
   Step 2 makes the dev-mode `LazyMotion strict` warning name Reorder and
   state the truth ("Reorder preloads the full feature bundle").

So plan 016 satisfies the documented-limitation half; the compatibility half
is explicitly deferred and should be acknowledged, not silently dropped.

## Steps

### Step 1 (gate: plan 016 row in `plans/README.md` is DONE and released)

Comment via `gh api repos/motiondivision/motion/issues/2232/comments -f body='...'`:
the limitation is now documented on the `Reorder.Group`/`Reorder.Item` props
and the `LazyMotion strict` warning now names Reorder and explains why
tree-shaking can't apply (released in `<version>`). True `m`-based Reorder
(inert until features load) is a breaking change tracked for a future major.

### Step 2 (gate: this plan's row in `plans/issues/README.md` set to APPROVED-CLOSE)

The default recommendation is to **keep this issue open** as the tracking
issue for the deferred `m`-based Reorder (plan 016 maintenance notes:
"Issues #2232/#2094 should stay open pointing at that"). Only if the
maintainer marks the row APPROVED-CLOSE:

```bash
gh api -X PATCH repos/motiondivision/motion/issues/2232 -f state=closed -f state_reason=completed
```

## STOP conditions

- Plan 016 is BLOCKED/REJECTED → report back; this issue needs re-planning.

## Done criteria

- [ ] Comment posted after 016 lands
- [ ] Issue closed ONLY if row says APPROVED-CLOSE; otherwise left open with
      the comment marking it as the tracker for `m`-based Reorder
- [ ] `plans/issues/README.md` row updated
