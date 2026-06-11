# Plan issue-2342: Stop layoutId mounts (lazy components) from corrupting ref drag constraints

> **Executor instructions**: Follow this plan step by step. The repro code is
> inlined below (fetched from the reporter's GitHub repo — the CodeSandbox is
> Cloudflare-blocked). Build the failing Cypress test FIRST; the root-cause
> section gives ranked hypotheses, not certainties — verify with
> instrumentation before fixing. Honor STOP conditions. Update this issue's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2342 --jq .state` → `open`.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/drag/ packages/motion-dom/src/projection/`
>    If `VisualElementDragControls.ts` or `create-projection-node.ts` changed,
>    re-verify excerpts. If `plans/issues/issue-2024.md` was already executed
>    (check its README row), run Step 1 against that fix first — it may
>    already pass (see "Relationship to issue-2024" below).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: soft: plans/issues/issue-2024.md (overlapping fix surface)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2342

## Why this matters

Reproduced setup (from https://github.com/AlexeyKhen/bug-framer-motion,
`src/App.tsx` + `src/LazyComponent.tsx`): a plain `motion.div` with `drag` +
ref `dragConstraints` works correctly — until a `React.lazy` component that
contains a `motion.div` with `layoutId` is mounted elsewhere on the page.
After that, the drag constraints are wrong (the box can be dragged past, or
stops short of, the constraint container). Two "Same" confirmations on the
issue. Anything that mounts a layout-projection participant (lazy routes,
modals with `layoutId`) silently breaks every ref-constrained draggable on
the page.

## Current state

Reporter's repro, condensed (use as the test page in Step 1):

```tsx
// container 800x700, position: relative, ref={boxRef}
//   motion.div 100x100, position: absolute, bottom: 100, right: 100,
//     drag dragElastic={0.1} dragMomentum={false} dragConstraints={boxRef}
// button toggles:
//   <Suspense fallback={null}><LazyComponent /></Suspense>
// LazyComponent renders <motion.div layoutId="123">motion.div</motion.div>
```

Key code paths (verified at `42bfbe3ed`):

- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
  - `addListeners()` line 718–721: registers `measureDragConstraints` on the
    projection node's `"measure"` event. Every time the node's layout is
    re-measured, ref constraints are re-resolved.
  - `measureDragConstraints` (lines 701–714):
    `this.constraints = this.resolveRefConstraints()`.
  - `resolveRefConstraints()` (lines 395–456): computes
    `calcViewportConstraints(projection.layout.layoutBox, constraintsBox)`.
  - `resolveConstraints()` (lines 340–364): at drag start, ref constraints
    are CACHED — `if (!this.constraints) { this.constraints = this.resolveRefConstraints() }` — so whatever the last "measure" event wrote
    sticks for the next drag.
- `packages/motion-dom/src/projection/node/create-projection-node.ts`
  - `updateLayout()` line 926: `this.layout = this.measure(false)` —
    `removeTransform = false`, i.e. the box INCLUDES any current x/y drag
    transform. Line 931: `this.notifyListeners("measure", this.layout.layoutBox)`.
  - Mounting a `layoutId` node triggers a root `didUpdate` cycle that
    re-measures layout-dirty nodes — including, after a parent re-render, the
    drag element's node.
- `calcViewportConstraints`
  (`packages/framer-motion/src/gestures/drag/utils/constraints.ts:103-120`)
  produces translate-space min/max as `constraintsBox - layoutBox`; it is
  only correct when `layoutBox` is transform-free (at mount the transform is
  0, which is why everything works before the lazy mount).

**Primary hypothesis (H1)**: after the user drags (x/y ≠ 0), the lazy mount
triggers a projection update; `updateLayout` measures the drag element WITH
its transform (`measure(false)`); the `"measure"` event re-resolves
constraints against that transform-inclusive box, shifting the allowed range
by exactly the current drag offset.

**Secondary hypothesis (H2)**: the re-render flips some node into the
projection update path where `resetTransform`/`shouldResetTransform`
interacts badly, corrupting `projection.layout` even when un-dragged.
Test both: the Cypress spec drags BEFORE mounting lazy (H1) and also checks
the never-dragged case (H2).

**Relationship to issue-2024**: that plan makes drag-start re-resolve ref
constraints from a fresh, transform-free measurement instead of trusting the
cache. If that lands first, H1's corruption would be repaired at the next
drag start and this repro may pass. Run Step 1 first in that case; if it
passes, this becomes VERIFY-FIXED: keep the test, comment, gated close.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress React 18/19 | CLAUDE.md recipe, `--spec cypress/integration/drag-ref-constraints-lazy-layoutid.ts` | all pass after fix |
| Jest drag | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` | all pass |

## Scope

**In scope**:
- `dev/react/src/tests/drag-ref-constraints-lazy-layoutid.tsx` (create; use
  a `lazy(() => Promise.resolve({ default: Lazy }))` or dynamic import of a
  sibling file — see `dev/react/src/tests/` for lazy patterns, e.g. grep
  `React.lazy`)
- `packages/framer-motion/cypress/integration/drag-ref-constraints-lazy-layoutid.ts` (create)
- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
- ONLY if the root cause demands it and minimally:
  `packages/motion-dom/src/projection/node/create-projection-node.ts`

**Out of scope**:
- Projection engine refactors (measurement semantics of `measure(false)` for
  layout animations) — a change there affects every layout animation; prefer
  fixing on the drag side (compensate for transform in
  `resolveRefConstraints`, e.g. subtract current x/y motion values from the
  measured layout box, or re-measure transform-free).
- The `Suspense`/lazy machinery itself — it is only the trigger.

## Git workflow

- Branch: `fix/issue-2342-lazy-layoutid-drag-constraints`
- PR via `gh pr create`; body edits via `gh api -X PATCH .../pulls/<n>`.

## Steps

### Step 1: Failing Cypress test

Build the page from the repro above with `data-testid="draggable"`, container
`id="constraints"`, and the toggle button `id="toggle-lazy"`. Spec:

1. Visit, `.wait(200)`.
2. **Case A (H1)**: drag the box from its start (bottom-right area) by
   (-150, -150) and release (`pointerdown`/two `pointermove`s/`pointerup`,
   `force: true`, `.wait(50)` between). `.wait(200)`.
3. Click `#toggle-lazy`, `.wait(400)` (lazy chunk + projection update).
4. Drag the box hard past the container's top-left (move to e.g. (-500,-500)
   relative) and release. `.wait(200)`. Assert with `.then()`: box
   `getBoundingClientRect().left/top` ≈ container `left/top` (±10,
   `dragElastic` settles back on release).
5. Drag hard past bottom-right; assert `right/bottom` ≈ container
   `right/bottom` (±10).
6. **Case B (H2)**: `cy.reload()`, mount lazy WITHOUT dragging first, then
   repeat 4–5.

**Verify**: at `42bfbe3ed` at least Case A fails (record which assertions and
by how much — the offset should match the Step 2 drag delta if H1 is right;
this is your root-cause evidence). If NOTHING fails after 2–3 attempts
(including a `dragElastic={0}` variant), STOP: check issue-2024's fix status,
then report (possible Electron/timing difference — per CLAUDE.md, consider
`cypress run --browser chrome`).

### Step 2: Confirm the mechanism

With the failing test, add temporary logging in `resolveRefConstraints()`
(print `projection.layout.layoutBox.x/y` and the constraint result) and in
`measureDragConstraints`. Run the spec once. Expected for H1: a "measure"
re-resolution fires during the lazy mount with a layoutBox shifted by the
current drag offset. Remove logging afterwards.

### Step 3: Fix

Preferred shape (H1 confirmed): make constraint resolution transform-proof.
In `resolveRefConstraints()`, before `calcViewportConstraints`, compensate
the measured layout box for the element's current drag transform:

```ts
const layoutBox = { x: { ...projection.layout.layoutBox.x }, y: { ...projection.layout.layoutBox.y } }
eachAxis((axis) => {
    const value = this.getAxisMotionValue(axis).get()
    if (typeof value === "number" && value !== 0 && /* layout was measured with transform */) {
        layoutBox[axis].min -= value
        layoutBox[axis].max -= value
    }
})
```

CAUTION: only subtract when the box being used actually contains the
transform — `updateLayout` uses `measure(false)` (transform included) but the
initial mount measurement happens with transform 0. The reliable invariant:
`measure(false)` boxes always include the CURRENT x/y value at measure time;
the constraint math needs the transform-free box, so subtracting the value
read at the same moment is correct in both cases (it is 0 at mount).
If instrumentation contradicts this (e.g. scale/rotate involved, or the
"measure" payload is already transform-free in some paths), STOP and report
with the evidence rather than adding conditionals.

Alternative shape if subtraction proves brittle: in `measureDragConstraints`
re-measure transform-free explicitly
(`projection.measure(true /* removeTransform */)`) and pass that box into a
parameterized `resolveRefConstraints(layoutBox?)`. `removeTransform` uses
`latestValues`, so it handles x/y correctly
(`create-projection-node.ts:1113`).

**Verify**: `yarn build`; Step 1 spec passes (Cases A and B) on React 18.

### Step 4: Regression pass

**Verify**:
- New spec on React 19 → passes.
- Cypress: `drag.ts`, `drag-ref-constraints-element-resize.ts`,
  `drag-ref-constraints-absolute-scrolled.ts`, `layout.ts` on React 18 →
  pass (re-run once on flake; same spec failing twice = real, STOP).
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` → pass.

## Test plan

- New Cypress spec: Case A (drag → lazy mount → constraints intact), Case B
  (lazy mount only → constraints intact), both directions of travel, React
  18 + 19. This is the regression gate; no Jest test (projection measurement
  doesn't exist in JSDOM).

## Done criteria

- [ ] New spec passes React 18 + 19; Case A failed before the fix
- [ ] Existing drag + layout Cypress specs pass; Jest drag suite passes
- [ ] Temporary logging removed (`git diff` shows no console.log)
- [ ] Only in-scope files modified
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 1 can't fail (see Step 1) — possible already-fixed by issue-2024's
  fix; if so, switch to VERIFY-FIXED: keep the spec as a regression test PR,
  comment on the issue naming the fixing PR, close ONLY if the README row is
  `APPROVED`.
- Step 2 instrumentation contradicts both H1 and H2 (constraint corruption
  originates inside projection didUpdate, not in drag's measure listener) —
  report; that fix belongs in projection territory and likely collides with
  plans 019/020.
- Fix requires changing `measure(false)` semantics in
  `create-projection-node.ts` for all callers.

## Maintenance notes

- Whichever of this and issue-2024 lands second MUST re-run the other's
  Cypress spec — both reshape ref-constraint resolution.
- Plans 019–021 (drag → motion-dom port) inherit this logic; the
  transform-compensation belongs in the ported `resolveRefConstraints`.
