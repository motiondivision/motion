# Plan issue-2094: Resolve "[BUG] Inactionable warning when using LazyMotion + Reorder" via plan 016

> **Executor instructions**: Pointer plan — the work is owned by
> `plans/016-reorder-lazymotion-warning.md`. Do NOT implement anything from
> this file. Follow the steps only when their gates are met. When done,
> update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2094 --jq '.state'` → `open`.
> If closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/016-reorder-lazymotion-warning.md (DONE + released)
- **Category**: dx
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2094

## Classification: COVERED (by plans/016-reorder-lazymotion-warning.md), with one residual ask

## Issue context

Filed 2023-04-19; 2 comments ("any updates?" class). Reporter uses
`<LazyMotion strict>` app-wide plus Reorder on one page and gets the generic
"render an `m` component instead" warning for `ReorderGroup` and
`ReorderItem` — advice they cannot follow, since Reorder internally renders
the `motion` proxy and passes `ignoreStrict`
(`packages/framer-motion/src/components/Reorder/Group.tsx:169`,
`Item.tsx:129`; warning site `packages/framer-motion/src/motion/index.tsx:191-201`).

Plan 016 fixes the *inactionable text*: the `ignoreStrict` branch gets a
Reorder-specific message that states the truth and a viable alternative
("build reorder interactions from `m` components and drag gestures").

**Residual ask NOT covered by 016**: a `noWarn` prop / way to fully suppress
the warning. 016 keeps the warning (dev-only, still fires per Reorder
component per render — `warning()` in `packages/motion-utils/src/errors.ts`
does not dedupe). If the maintainer wants suppression or dedup, that is a
small follow-up plan against `motion-utils` `warning()` or a Reorder prop —
do not improvise it here.

## Steps

### Step 1 (gate: plan 016 row in `plans/README.md` is DONE and released)

Comment via `gh api repos/motiondivision/motion/issues/2094/comments -f body='...'`:
summarize that since `<version>` the warning is Reorder-specific and explains
the actual limitation; note the warning is dev-only and stripped from
production builds; ask whether actionable text resolves the report or
whether they still need a suppression option.

### Step 2 (gate: this plan's row in `plans/issues/README.md` set to APPROVED-CLOSE)

Plan 016's maintenance notes recommend #2094 stays open pointing at the
deferred `m`-based Reorder. If the maintainer instead marks APPROVED-CLOSE
(e.g. treating actionable text as resolution, with #2232 as the open tracker):

```bash
gh api -X PATCH repos/motiondivision/motion/issues/2094 -f state=closed -f state_reason=completed
```

## STOP conditions

- Plan 016 is BLOCKED/REJECTED → report back; this issue needs re-planning.
- Reporter replies that suppression is still required → report to maintainer;
  a new small plan is needed (warning dedup/opt-out), not an ad-hoc fix.

## Done criteria

- [ ] Comment posted after 016 lands
- [ ] Issue closed ONLY on APPROVED-CLOSE; otherwise left open
- [ ] `plans/issues/README.md` row updated
