# Plan issue-2024: Re-resolve ref drag constraints at drag start so scrolled containers don't offset the drag

> **Executor instructions**: Follow this plan step by step. Build the failing
> Cypress test FIRST. The reporter's sandbox is Cloudflare-blocked; the repro
> below is reconstructed from the issue text (which is specific:
> `Reorder.Item` + `dragConstraints` + scrollable `Reorder.Group`). Honor
> STOP conditions. Update this issue's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2024 --jq .state` → `open`.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/drag/`
>    On changes to `VisualElementDragControls.ts`, re-verify excerpts. If the
>    drag engine moved to motion-dom (plans 019/020 landed), STOP and
>    re-localize.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: soft: plans/issues/issue-2342.md (overlapping fix surface
  in `resolveRefConstraints`; whichever lands second re-runs the other's
  spec)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2024

## Why this matters

With ref `dragConstraints` on a `Reorder.Item` inside a scrollable
`Reorder.Group`: scroll the group, then drag an item — the item jumps by
roughly the scrolled distance (reporter's GIF; "the item should not move when
dragged"). Root cause is measurement staleness: both the item's cached
projection layout and the resolved constraints are computed at mount (scroll
= 0) and are never refreshed when a *nested* container scrolls. Commit
`cfccb0300` (2026-05-12) fixed the analogous bug for ROOT scroll (#2829), but
(a) it only refreshes root scroll and (b) it only runs when constraints are
actually re-resolved — and they are cached. This bites every scrollable-list
+ ref-constraints combination, not just Reorder.

## Current state

`packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`:

- `resolveConstraints()` (lines 340–364), called from `onStart` (line 136) on
  every drag start — but ref constraints are CACHED:

  ```ts
  if (dragConstraints && isRefObject(dragConstraints)) {
      if (!this.constraints) {
          this.constraints = this.resolveRefConstraints()
      }
  }
  ```

- The layout side is also cached: lines 343–347 only measure when
  `!projection.layout`. The layout is otherwise from mount
  (`addListeners()` lines 723–728) or from the last projection `"measure"`
  event — nested-container scrolling fires neither.
- `resolveRefConstraints()` (lines 395–456) measures the constraints element
  LIVE via `measurePageBox` (correct: `getBoundingClientRect` + refreshed
  root scroll — `packages/motion-dom/src/projection/utils/measure.ts:17-32`
  plus the root-scroll refresh at lines 423–426), then compares against the
  STALE `projection.layout.layoutBox` in `calcViewportConstraints`
  (`utils/constraints.ts:103-120`: translate range = constraintsBox −
  layoutBox). Scrolling a nested container shifts the item's true page box by
  −scrollTop while the cached layoutBox keeps the old value → the resolved
  min/max are offset by scrollTop → instant jump on drag start.
- Why object constraints (e.g. `{ top: 0, bottom: 0 }`) are NOT affected:
  they get rebased to component-relative space via `rebaseAxisConstraints`
  (lines 374–392), which subtracts the same stale `layout.min`, cancelling
  the staleness. The repro must use a REF.
- `Reorder.Group` does not set `layoutScroll`
  (verified: `grep -rn layoutScroll packages/framer-motion/src/components/Reorder/` → no hits), so projection's `removeElementScroll`
  (`create-projection-node.ts:1045-1076`) doesn't change this picture.
- Related but distinct: the issue's last comment ("weird offset when drag
  scrolling even without dragConstraints") is the autoscroll-during-drag
  family fixed by `5d53f132f` (#1691) — mention in the closing comment, do
  not chase here.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress React 18/19 | CLAUDE.md recipe, `--spec cypress/integration/drag-ref-constraints-nested-scroll.ts` | pass after fix |
| Jest drag | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` | all pass |

## Scope

**In scope**:
- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
- `dev/react/src/tests/drag-ref-constraints-nested-scroll.tsx` (create)
- `packages/framer-motion/cypress/integration/drag-ref-constraints-nested-scroll.ts` (create)

**Out of scope**:
- Adding `layoutScroll` to `Reorder.Group` (changes layout-animation
  semantics for all Reorder users; separate decision).
- `PanSession` scroll tracking, autoscroll behavior.
- Projection engine changes.

## Git workflow

- Branch: `fix/issue-2024-ref-constraints-nested-scroll`
- PR via `gh pr create`; body edits via `gh api -X PATCH .../pulls/<n>`.

## Steps

### Step 1: Failing Cypress test

Keep the page generic (plain motion.div proves the root cause; a Reorder
case is added as a second assertion-target on the same page):

`dev/react/src/tests/drag-ref-constraints-nested-scroll.tsx` — export `App`:

- A scroll container: `ref={scrollerRef}`, 300×300, `overflow-y: scroll`,
  at a known position.
- Inside it, 1200px-tall content; a `motion.div` (`data-testid="draggable"`,
  100×100, `drag`, `dragConstraints={scrollerRef}`, `dragElastic={0}`,
  `dragMomentum={false}`) positioned 400px from the content top.
- A `useLayoutEffect` (or button `#scroll`) sets
  `scrollerRef.current.scrollTop = 350` so the draggable is visible near the
  container top after scrolling.

Spec `packages/framer-motion/cypress/integration/drag-ref-constraints-nested-scroll.ts`
(model on `drag-ref-constraints-absolute-scrolled.ts`):

1. Visit, `.wait(300)`; assert the scroller's `scrollTop === 350`.
2. Record the draggable's `getBoundingClientRect()` via `.then()`.
3. `pointerdown` center → `pointermove` +10,+10 → `.wait(50)` →
   `pointermove` +20,+20 → `pointerup` (`force: true`).
4. `.wait(200)`, assert via `.then()`: the box moved by ≈ (+20, +20) from
   step 2's rect (±10) — i.e. it tracked the pointer instead of jumping.
   Before the fix the y-delta is contaminated by ~350 (clamped by the stale
   constraint); record the observed value.
5. Also assert constraint integrity: drag hard past the container's visible
   bottom edge and check the box clamps at the container's client bottom
   (±10), not 350px beyond/short.

**Verify**: spec FAILS at `42bfbe3ed` on assertion 4 and/or 5 (record which
and by how much — expect ≈ scrollTop). If it does not fail after 2–3 page
variants (try scrolling via the button after mount instead of
useLayoutEffect — scroll BEFORE first measure may be masked by `cfccb0300`'s
root-refresh path; the bug needs scroll AFTER the initial constraint
resolution), STOP and report per the no-repro rule.

### Step 2: Re-resolve ref constraints with fresh layout at drag start

In `resolveConstraints()` (lines 340–364):

1. Drop the ref-constraints cache so every drag start re-resolves:

   ```ts
   if (dragConstraints && isRefObject(dragConstraints)) {
       this.constraints = this.resolveRefConstraints()
   }
   ```

2. Feed it a FRESH element measurement. In `resolveRefConstraints()`, after
   the existing root-scroll refresh (lines 423–426), re-measure this
   element's layout before using it:

   ```ts
   projection.updateLayout()
   ```

   and keep using `projection.layout.layoutBox` afterwards.

   CAUTION — transform inclusion: `updateLayout()` uses `measure(false)`
   (`create-projection-node.ts:926`), so the measured box includes the
   current x/y transform, while `calcViewportConstraints` needs the
   transform-free box (at mount the transform is 0, which is why the old
   cache worked). Compensate by subtracting the current axis values, mirroring
   the shape proposed in `plans/issues/issue-2342.md` Step 3: copy the
   layoutBox and `layoutBox[axis].min/max -= value` for each axis where
   `getAxisMotionValue(axis).get()` is a nonzero number. For a rested
   Reorder.Item (dragSnapToOrigin) the values are 0 and this is a no-op.

3. Beware recursion: `updateLayout()` fires the projection `"measure"` event
   (`create-projection-node.ts:931`), whose listener `measureDragConstraints`
   (lines 701–714) calls `resolveRefConstraints()` again. Guard with a simple
   reentrancy flag (`private isMeasuringConstraints = false`) around the
   `updateLayout` call, or move the `updateLayout()` into `resolveConstraints`
   before the `resolveRefConstraints()` call and accept one duplicate
   resolution (measure listener runs synchronously — verify with a log,
   then delete the log). Pick whichever keeps the diff smallest; assert no
   infinite loop by running the spec.

**Verify**: `yarn build`; Step 1 spec passes on React 18.

### Step 3: Regression pass

**Verify**:
- New spec on React 19 → passes.
- Cypress on React 18: `drag.ts`, `drag-ref-constraints-absolute-scrolled.ts`
  (the #2829 regression test — MUST stay green; it shares this code path),
  `drag-ref-constraints-element-resize.ts`,
  `drag-ref-constraints-resize-handle.ts`, `drag-to-reorder.ts`,
  `drag-layout-reorder-strict.ts` → all pass (re-run once on flake;
  twice-failing = real, STOP).
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` → all pass.
- If `plans/issues/issue-2342.md` was already executed: run its spec
  (`drag-ref-constraints-lazy-layoutid.ts`) too.

## Test plan

- New Cypress spec: nested-container scroll then drag — pointer tracking
  (assertion 4) and constraint clamping (assertion 5); React 18 + 19.
- Optional second test in the same spec using `Reorder.Group`/`Reorder.Item`
  (`axis="y"`, group as constraints ref, scroll group, drag item, assert no
  jump) — matches the reporter's exact setup; model the page on
  `dev/react/src/tests/drag-to-reorder.tsx`.

## Done criteria

- [ ] New spec passes React 18 + 19; failed before the fix with ≈scrollTop offset
- [ ] `drag-ref-constraints-absolute-scrolled.ts` (#2829 gate) still passes
- [ ] Remaining listed Cypress specs + Jest drag suite pass
- [ ] Only in-scope files modified
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 1 cannot produce a failing test (see Step 1 escape — then comment on
  the issue with findings and mark NEEDS-REPRO; close only if the README row
  is `APPROVED`).
- The reentrancy interaction in Step 2.3 produces repeated resolutions per
  frame (log shows >2 calls per drag start) and no small guard fixes it.
- `drag-ref-constraints-absolute-scrolled.ts` breaks and can't be restored
  while keeping the new spec green — the two scroll spaces (root vs nested)
  are then entangled; report with both failure modes.
- Drag engine moved to motion-dom (plans 019/020).

## Maintenance notes

- Behavior change to document in the PR: ref constraints are now re-measured
  on EVERY drag start (previously: once, plus on projection measure/resize
  events). This adds one `getBoundingClientRect` + one element measure per
  drag start — negligible, and it makes `onMeasureDragConstraints` fire per
  drag start (check the docs wording; it arguably always should have).
- Closing comment for the issue should note the unrelated-looking last
  comment (offset while drag-scrolling without constraints) was fixed
  separately by `5d53f132f` (#1691).
- Plans 019–021 port this file to motion-dom; the re-resolve-on-start
  semantics are also what the vanilla `drag()` (plan 020) wants.
