# Plan issue-2444: DragControls + portal memory leak — request fresh evidence, gated close

> **Executor instructions**: NEEDS-REPRO plan. A prior audit (2026-06-11
> drag audit, recorded in `plans/README.md` "Findings considered and
> rejected") could not reproduce a retention bug in the current subscription
> code; the report is against framer-motion 10.10. No code changes are
> allowed without a failing repro (repo policy). Update this issue's row in
> `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2444 --jq .state` → `open`.
> 2. Confirm the unsubscribe path still matches "Current state" below:
>    `sed -n '30,50p' packages/framer-motion/src/gestures/drag/index.ts`

## Status

- **Priority**: P3
- **Effort**: S (verification + comment; M only if leak confirmed)
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (unverified)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2444

## Why this matters

Reporter (Dec 2023, framer-motion 10.10): attaching `useDragControls` to a
motion component rendered in a React portal leaves detached DOM nodes
retained after unmount, with retainers in drag controls / projection /
VisualElement / value code. Memory leaks matter, but this report is 2.5 years
and two major refactor waves old, names no specific retaining reference, and
its sandbox (`rgt8p2`) is Cloudflare-blocked to automation. The modern
cleanup path looks correct (below), and the prior drag audit explicitly
rejected this as not-reproduced.

## Current state (verified at `42bfbe3ed`)

- `packages/framer-motion/src/gestures/drag/index.ts:40-42` — `DragGesture`
  feature `unmount()` calls the unsubscribe returned by
  `removeGroupControls` (i.e. `dragControls.subscribe()`'s cleanup), removing
  the VisualElement from the `DragControls` component set. So a long-lived
  `useDragControls` in a parent does not retain unmounted children through
  the subscription.
- `VisualElementDragControls.addListeners()` returns a disposer that removes
  pointer/resize/measure/layout listeners
  (`packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:761-768`).
- `elementDragControls` (`VisualElementDragControls.ts:39-42`) is a `WeakMap`
  keyed by VisualElement — not a retainer by itself.
- Prior audit verdict (`plans/README.md`, drag audit section): "DragControls
  + portal memory leak (#2444): not reproduced — `subscribe()` returns an
  unsubscribe and `DragGesture.unmount` calls it. Needs a repro before any
  fix."

## Steps

### Step 1 (optional but recommended): One bounded manual verification

Time-box: one attempt, no iteration. Build a minimal page in
`dev/react/src/tests/` (do not commit): button toggling a portal
(`createPortal`) containing `<motion.div drag dragControls={controls} dragListener={false} />` where `controls = useDragControls()` lives in the
always-mounted parent. Run dev server, in Chrome DevTools take heap snapshots
after mount→unmount→GC, search for detached `HTMLDivElement` retained via
motion internals. Record the result (screenshot/notes) for the comment. If
you cannot run a browser in this environment, skip — the comment below works
without it.

### Step 2: Post the comment

```bash
gh api repos/motiondivision/motion/issues/2444/comments -f body='<comment>'
```

Content: the subscription/unmount cleanup this report pointed at has been
rewritten since v10 (drag feature unmount now unsubscribes from
`DragControls`; pan-session and listener teardown was hardened in 2026 —
commits `c092db9e1`, `7bc725838`); we could not reproduce retained detached
nodes with `useDragControls` + portal on current v12 (include Step 1 evidence
if gathered); the original sandbox can't be fetched by automation. Ask for a
fresh repro against latest v12 with the specific retainer path visible, and
note we'll reopen/investigate immediately with one.

### Step 3: Close (GATED)

**Gate**: row for issue-2444 in `plans/issues/README.md` is `APPROVED`.
If approved:
`gh api -X PATCH repos/motiondivision/motion/issues/2444 -f state=closed -f state_reason=not_planned`
Otherwise leave open; mark row `BLOCKED (awaiting close approval)`.

## Done criteria

- [ ] Comment posted
- [ ] Closed only if gate APPROVED
- [ ] No committed source changes (`git status` clean; temp dev page deleted)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 1 DOES show motion-internal retainers of the detached node on current
  main: stop and report the exact retainer chain — that converts this into a
  FIX plan (likely projection node or motion value subscription, per the
  reporter's file list).
- Reporter provides a fresh v12 repro before close: stop and report.
