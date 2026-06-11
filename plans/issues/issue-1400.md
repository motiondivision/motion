# Plan issue-1400: Resolve "[FEATURE] Multi-axis support in Reorder.Group" via plan 018

> **Executor instructions**: This is a pointer plan — the implementation work
> is owned by `plans/018-reorder-multidimensional.md`. Do NOT implement
> anything from this file. Follow the steps below only when their gates are
> met. When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/1400 --jq '.state'` → `open`.
> If closed, mark this plan DONE (already resolved) and stop.

## Status

- **Priority**: P2
- **Effort**: S (the work here is a comment + close; the feature itself is plan 018, Effort L)
- **Risk**: LOW
- **Depends on**: plans/018-reorder-multidimensional.md (must be DONE and released)
- **Category**: direction
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1400

## Classification: COVERED (by plans/018-reorder-multidimensional.md)

## Issue context

Open since 2021-12-23; 25 comments; the most-demanded Reorder feature. Asks
for `axis="xy"`-style grid reordering on `Reorder.Group`. History the executor
should know:

- A community PR (#1685 by cjoecker) implemented it and was merged, then the
  implementation was removed; the maintainer's revival attempt (PR #1862)
  concluded it was "quite buggy and feels off" and closed it.
- The docs line that confuses users ("To make draggable on both axes, set
  `<Reorder.Item drag />`", `packages/framer-motion/src/components/Reorder/Group.tsx:30-31`)
  is updated by plan 018 Step 5.
- Latest comments (2025) ask whether a new PR should be submitted — plan 018
  is the answer: positional collision detection via `axis="both"`, designed
  to avoid the velocity-gating and grid-arithmetic failures of #1685.

## Steps

### Step 1 (gate: plan 018 row in `plans/README.md` is DONE and the feature is in a published release)

Comment on the issue (use `gh api`, not `gh issue` — Projects Classic
deprecation breaks some `gh issue` subcommands on this repo):

```bash
gh api repos/motiondivision/motion/issues/1400/comments -f body='Multi-axis reordering shipped in <version>: set `axis="both"` on `Reorder.Group`. Items can now be reordered in two dimensions (wrapped flex / grid layouts), using positional collision detection rather than the per-axis velocity approach from the earlier PR #1685. Docs: <link>. Please open a new issue for any bugs you hit with it.'
```

Fill `<version>` from the release changelog and `<link>` from motion.dev docs.

### Step 2 (gate: this plan's row in `plans/issues/README.md` is set to APPROVED/APPROVED-CLOSE by the maintainer)

Close as completed:

```bash
gh api -X PATCH repos/motiondivision/motion/issues/1400 -f state=closed -f state_reason=completed
```

Note: plan 018's maintenance notes flag that the maintainer may consider
auto-axis detection part of the ask; if the maintainer prefers to keep #1400
open until auto-detection ships, leave it open and link the follow-up plan
instead.

## STOP conditions

- Plan 018 is BLOCKED/REJECTED → report; this issue then needs a fresh plan.
- The issue was closed by someone else in the meantime.

## Done criteria

- [ ] Comment posted referencing the released version
- [ ] Issue closed as completed (only after APPROVED row) — or explicitly left
      open per maintainer note
- [ ] `plans/issues/README.md` row updated
