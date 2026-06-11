# Plan 021: Drag gesture quality improvements (inertia hard-stop, resize throttling, direction-lock fairness)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/generators/inertia.ts packages/motion-dom/src/gestures/drag`
> Plan 019 must be DONE first — the drag engine must live at
> `packages/motion-dom/src/gestures/drag/VisualElementDragControls.ts`. If it
> still lives in framer-motion, STOP (or execute 019 first if dispatched for both).

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (deliberate, scoped behavior changes)
- **Depends on**: plans/019-port-drag-pan-engine-to-motion-dom.md (hard — same file)
- **Category**: perf + tech-debt + bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11 (line numbers cite the pre-011 file `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`; after 011 the code is identical at the motion-dom path — re-locate by symbol)

## Why this matters

Three vetted findings in the drag engine, each small but user-visible:

1. **`dragElastic: false` is faked with a degenerate spring** — `bounceStiffness: 1000000, bounceDamping: 10000000` (engine lines 484–491), with a code comment admitting "we should look into adding a disable spring option to `inertia`". The fake spring still produces frames of spring evaluation at numeric extremes; a real hard-stop mode in the inertia generator is cheaper, exact, and removes a footgun for anyone composing `dragTransition`.
2. **Window-resize remeasurement does unthrottled synchronous layout thrash** — `addDomEvent(window, "resize", () => this.scalePositionWithinConstraints())` (lines 734–736) plus two ResizeObservers funneling into the same method (lines 699–714, 803–814). Each call stops animations, writes `style.transform = "none"`, forces reflow via `projection.updateLayout()`, and re-renders — per resize event, which fires continuously while a user drags a window edge or a container is animated.
3. **Direction lock is y-biased** — `getCurrentDirection` (lines 834–847) checks `|offset.y| > 10` before `|offset.x|`, so a fast first frame moving mostly-x-but-some-y can lock to `y`. Comparing magnitudes when either passes the threshold locks to the dominant axis.

Plus one cosmetic: `updateAxis(axis, _point, offset?)` (line 319) has a dead `_point` parameter.

## Current state

All excerpts verified at `42bfbe3ed`; post-019 the same code lives in `packages/motion-dom/src/gestures/drag/VisualElementDragControls.ts`.

**Engine — overdamp hack** (`startAnimation`, lines 483–502):

```ts
const bounceStiffness = dragElastic ? 200 : 1000000
const bounceDamping = dragElastic ? 40 : 10000000

const inertia: Transition = {
    type: "inertia",
    velocity: dragMomentum ? velocity[axis] : 0,
    bounceStiffness,
    bounceDamping,
    timeConstant: 750,
    restDelta: 1,
    restSpeed: 10,
    ...dragTransition,
    ...transition,
}
```

**Inertia generator** (`packages/motion-dom/src/animation/generators/inertia.ts`): destructures `bounceDamping = 10, bounceStiffness = 500, min, max` (lines 14–18); `isOutOfBounds(v)` at line 30; `boundaryNearest(v)` at lines 33–36; on boundary crossing it switches to a spring built from `bounceDamping`/`bounceStiffness` (lines ~77–104).

**Resize path** (engine):

```ts
// lines 734-736
const stopResizeListener = addDomEvent(window, "resize", () =>
    this.scalePositionWithinConstraints()
)
```

`scalePositionWithinConstraints` (lines 589–659) is the stop-animations → strip transform → `updateScroll`/`updateLayout` → recompute constraints → re-set values → synchronous `this.visualElement.render()` sequence. The sync render at the end is load-bearing (comment at lines 653–657: prevents a flash at the element's untransformed position) — throttling must keep strip-measure-restore within one frame, not split it.

**Direction lock**:

```ts
// lines 834-847
function getCurrentDirection(
    offset: Point,
    lockThreshold = 10
): DragDirection | null {
    let direction: DragDirection | null = null
    if (Math.abs(offset.y) > lockThreshold) {
        direction = "y"
    } else if (Math.abs(offset.x) > lockThreshold) {
        direction = "x"
    }
    return direction
}
```

**Frame loop**: `frame.read(fn)` / `frame.update(fn)` schedule for the next frame and dedupe the same callback reference within a frame (this dedupe is the throttling mechanism — see `packages/motion-dom/src/frameloop/batcher.ts`). `cancelFrame(fn)` cancels.

Conventions: small-bundle bias; `interface`; named exports; tests-first (write the failing test before the fix — per CLAUDE.md).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Build | `yarn build` | exit 0 |
| Inertia unit tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="inertia"` | all pass |
| Drag unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="drag"` | all pass |
| Lint | `yarn lint` | exit 0 |
| Cypress (React 18/19) | the per-version Vite + `cypress run` block from plan 019's Commands section, with the spec list below | all pass |

Cypress regression specs for this plan: `drag.ts`, `drag-momentum.ts`, `drag-ref-constraints-element-resize.ts`, `drag-ref-constraints-resize-handle.ts`, `drag-tabs.ts`, `drag-to-reorder.ts` — on React 18 AND React 19.

## Scope

**In scope:**

- `packages/motion-dom/src/animation/generators/inertia.ts` (add `bounce` option)
- `packages/motion-dom/src/animation/generators/__tests__/inertia.test.ts` (find the existing inertia test file via `ls packages/motion-dom/src/animation/generators/__tests__/`; if it lives elsewhere, follow the existing location)
- `packages/motion-dom/src/animation/types.ts` (or wherever `InertiaOptions` is declared — `grep -rn "interface InertiaOptions" packages/motion-dom/src`)
- `packages/motion-dom/src/gestures/drag/VisualElementDragControls.ts` (post-019 location)
- New/updated unit tests beside the engine and existing drag tests in `packages/framer-motion/src/gestures/drag/__tests__/`
- `plans/README.md` (status row)

**Out of scope (do NOT touch):**

- `PanSession.ts` — velocity estimation is recently hardened (hold-then-flick guard); leave it.
- Public default values: `dragElastic` default (0.35), `timeConstant`, `restDelta` etc. — no tuning.
- `drag()` vanilla API (plan 020) — independent; these fixes flow into it automatically via the shared engine.
- The spring generator itself.
- Feature requests from the issue tracker (e.g. #2677 `dragSnapToCursor` prop) — real but separate.

## Git workflow

- Branch: `advisor/021-drag-qol` off `main` (post-019).
- One commit per step; imperative repo-style messages.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `bounce: false` hard-stop to the inertia generator (test first)

Write the failing test first in the inertia generator's existing test file: with `{ keyframes: [0], velocity: 1000, min: -100, max: 100, bounce: false }`, sampling the generator past the boundary-crossing time must yield exactly `100` (clamped, `done: true` shortly after), with no overshoot in any sample. Also assert the existing default (`bounce` unset) still springs past the boundary (overshoot exists), so the default path is pinned.

Then implement in `inertia.ts`: accept `bounce = true` in the destructure; in the boundary-crossing branch (where the spring currently takes over), when `bounce === false`, set the state to `boundaryNearest(value)`-clamped output and finish — no spring construction. Keep the generated code small (this ships to users).

Add `bounce?: boolean` to `InertiaOptions` with a one-line TSDoc ("When false, the animation stops dead at min/max instead of springing.").

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="inertia"` → all pass, including the new cases (which failed before the implementation).

### Step 2: Use `bounce` in the drag engine

In `startAnimation` (engine), replace the overdamp hack:

```ts
const inertia: Transition = {
    type: "inertia",
    velocity: dragMomentum ? velocity[axis] : 0,
    bounce: dragElastic ? true : false,
    bounceStiffness: 200,
    bounceDamping: 40,
    timeConstant: 750,
    restDelta: 1,
    restSpeed: 10,
    ...dragTransition,
    ...transition,
}
```

Note the ordering keeps user `dragTransition` able to override `bounce` and both spring params, preserving today's extension point. The visible change: `dragElastic: false` (or `0`) now stops dead at constraints instead of micro-springing — this is the intended fix, and matches the code comment's stated desire.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="drag"` → all pass; then Cypress `drag.ts` + `drag-momentum.ts` on React 18 → pass.

### Step 3: Frame-throttle the resize remeasurement

In the engine, make the resize handler schedule instead of invoke:

```ts
private scheduleScaleCheck = () => this.scalePositionWithinConstraints()
```

…and wire both `addDomEvent(window, "resize", ...)` and the `startResizeObservers` callback to `frame.read(this.scheduleScaleCheck)` — wait: `frame.read(fn)` without `keepAlive` schedules `fn` once for the next frame and the batcher dedupes the same function reference scheduled multiple times within one frame. Confirm dedupe semantics by reading `packages/motion-dom/src/frameloop/batcher.ts` (`schedule` with an already-queued callback); if it does NOT dedupe, guard with a boolean flag instead (`if (this.scaleCheckScheduled) return`, cleared inside the callback). The entire `scalePositionWithinConstraints` body stays synchronous within the frame callback so the strip-transform → measure → restore → render sequence still happens in one frame (no flash).

Also `cancelFrame(this.scheduleScaleCheck)` in the cleanup returned by `addListeners` so a teardown mid-burst can't fire on a dead element.

**Verify**: Cypress `drag-ref-constraints-element-resize.ts` + `drag-ref-constraints-resize-handle.ts` on React 18 AND 19 → pass. These specs exercise exactly this path; if either fails, the throttle changed observable timing — STOP and report rather than adding waits to the specs.

### Step 4: Direction-lock fairness (test first)

Write the failing test first. `getCurrentDirection` is module-private; test it through the public behavior in `packages/framer-motion/src/gestures/drag/__tests__/index.test.tsx` (model on the existing `dragDirectionLock` tests there — find them with `grep -n "directionLock\|onDirectionLock" packages/framer-motion/src/gestures/drag/__tests__/index.test.tsx`): a pointer move of `{ x: 30, y: 12 }` in the first frame must lock `"x"` (today it locks `"y"` because y passes the threshold first in the if/else).

Then change `getCurrentDirection` to dominant-axis selection:

```ts
function getCurrentDirection(
    offset: Point,
    lockThreshold = 10
): DragDirection | null {
    if (Math.abs(offset.x) <= lockThreshold && Math.abs(offset.y) <= lockThreshold) {
        return null
    }
    return Math.abs(offset.y) >= Math.abs(offset.x) ? "y" : "x"
}
```

Ties keep the historical y preference (`>=`). Pure vertical/horizontal gestures are unaffected.

**Verify**: the new test passes; full drag jest suite passes; Cypress `drag-tabs.ts` + `drag-to-reorder.ts` (direction-locked real-world flows) on React 18 → pass.

### Step 5: Remove the dead parameter

`updateAxis(axis, _point, offset?)` → `updateAxis(axis, offset?)`; update its two call sites (`this.updateAxis("x", info.point, offset)` / `("y", ...)` in `onMove`).

**Verify**: `yarn build` → exit 0; `yarn lint` → exit 0.

### Step 6: Full gate

Full drag/pan/inertia jest suites, `yarn build`, `yarn lint`, and the complete Cypress spec list (Commands section) on React 18 AND React 19.

**Verify**: all green.

## Test plan

- New (failing-first): inertia `bounce: false` clamp tests + default-overshoot pin (Step 1); direction-lock dominant-axis test (Step 4).
- Regression: existing drag/pan jest suites unchanged; 6 Cypress specs × 2 React versions.
- Note: the resize-throttle change (Step 3) has no new test — JSDOM cannot exercise real resize/reflow, and the two existing resize Cypress specs are the behavioral gate. State this in the PR description.

## Done criteria

ALL must hold:

- [ ] `yarn build` and `yarn lint` exit 0
- [ ] motion-dom jest suite passes incl. new inertia `bounce` tests
- [ ] framer-motion drag jest suite passes incl. new direction-lock test
- [ ] `grep -n "1000000" packages/motion-dom/src/gestures/drag/VisualElementDragControls.ts` returns no matches (overdamp hack gone)
- [ ] Listed Cypress specs pass on React 18 AND React 19
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 019 isn't done (engine not in motion-dom).
- The inertia generator's boundary-crossing branch doesn't match the description (drift) — re-read before patching.
- Any Cypress resize spec fails after Step 3 — do not add `cy.wait` padding; the throttle may interact with `projection.root.updateBlockedByResize` (see `create-projection-node.ts` mount resize listener) and that interaction needs a deliberate decision.
- The direction-lock change breaks `drag-tabs.ts` or `drag-to-reorder.ts` — these encode product-level expectations; report which gesture sequence regressed.
- `bounce: false` causes a visible end-of-drag snap in `drag-momentum.ts` — would mean the clamp fires while still inside bounds; the generator change is wrong, not the spec.

## Maintenance notes

- `bounce` is a new public `InertiaOptions` field — document it in the PR for the docs site (motion.dev docs live outside this repo).
- Plan 020's vanilla `drag()` inherits all three fixes automatically (shared engine) — if 020 landed first, re-run its HTML drag specs as an extra gate.
- Future `dragElastic`-derived spring tuning (the code comment's "affect bounceStiffness/bounceDamping using the value of dragElastic" idea) is deliberately not done — separate, product-level decision.
- Reviewers: scrutinize the `...dragTransition` override ordering in Step 2 (user overrides must still win) and the one-frame atomicity of `scalePositionWithinConstraints` after Step 3.
