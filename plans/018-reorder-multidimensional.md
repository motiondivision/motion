# Plan 018: Multidimensional reorder via positional collision detection (`axis="both"`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/components/Reorder/ packages/framer-motion/src/context/ReorderContext.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plans 015–017 intentionally touch
> these files — their changes are described in "Depends on" below and are
> expected drift; anything else is not.)

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/015-reorder-conditional-hook-fix.md (same file, land first), plans/017-reorder-autoscroll-state-scoping.md (changes `resetAutoScrollState` signature used here). Plan 016 touches JSDoc only — trivial merge either way.
- **Category**: direction
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

Grid reordering is the most-requested Reorder feature (issue #1400, open since 2021, 25 comments). A previous implementation was merged (PR #1685) and then removed: the maintainer's revival attempt (PR #1862) concluded it was "quite buggy and feels off" and closed it, stating a revival "would have to actually feel good and work well." That implementation failed for identifiable reasons, all avoided by this design:

1. **It gated swaps on velocity sign per axis** — hovering over an obvious target slot did nothing while the pointer was momentarily still or moving obliquely.
2. **It inferred grid structure from `itemsPerAxis` modular arithmetic** — assumed uniform item sizes and perfect rows; collapsed with wrapped flex layouts, uneven last rows, or mixed sizes.
3. **It moved items by index arithmetic (`index ± itemsPerAxis`)** rather than geometry, and only one adjacent slot per drag event.

This plan replaces direction-guessing with *positional* collision detection (the approach used by dnd-kit and similar libraries): the registered layout `Box` of every item is already available — `registerItem` receives the full `Box` and currently throws the cross axis away — so the target slot is simply "the item whose box contains the dragged item's projected center." Velocity is removed from the reorder decision entirely. The same geometric core also fixes the 1D path's velocity quirks (finding #4 of the 2026-06-11 Reorder audit) and enables multi-position jumps in a single drag event.

## Current state

All in `packages/framer-motion/src/components/Reorder/` unless noted.

- `types.ts` — context and item-data types (entire file, 23 lines):

```ts
import { Axis, Box } from "motion-utils"
import { RefObject } from "react"
import { HTMLElements } from "../../render/html/supported-elements"

export interface ReorderContextProps<T> {
    axis: "x" | "y"
    registerItem: (item: T, layout: Box) => void
    updateOrder: (item: T, offset: number, velocity: number) => void
    groupRef: RefObject<Element | null>
}

export interface ItemData<T> {
    value: T
    layout: Axis
}
```

- `utils/check-reorder.ts` — the 1D algorithm (entire file, 34 lines):

```ts
import { mixNumber } from "motion-dom"
import { moveItem } from "motion-utils"
import { ItemData } from "../types"

export function checkReorder<T>(
    order: ItemData<T>[],
    value: T,
    offset: number,
    velocity: number
): ItemData<T>[] {
    if (!velocity) return order
    const index = order.findIndex((item) => item.value === value)
    if (index === -1) return order
    const nextOffset = velocity > 0 ? 1 : -1
    const nextItem = order[index + nextOffset]
    if (!nextItem) return order
    const item = order[index]
    const nextLayout = nextItem.layout
    const nextItemCenter = mixNumber(nextLayout.min, nextLayout.max, 0.5)
    if (
        (nextOffset === 1 && item.layout.max + offset > nextItemCenter) ||
        (nextOffset === -1 && item.layout.min + offset < nextItemCenter)
    ) {
        return moveItem(order, index, index + nextOffset)
    }
    return order
}
```

- `Group.tsx` — order registry. Key excerpts:

```ts
// Group.tsx:79  (prop default)
axis = "y",

// Group.tsx:92  (order rebuilt every render; items re-register via onLayoutMeasure)
const order: ItemData<V>[] = []

// Group.tsx:105-114 (registerItem — note layout[axis] discards the cross axis)
registerItem: (value, layout) => {
    const idx = order.findIndex((entry) => value === entry.value)
    if (idx !== -1) {
        order[idx].layout = layout[axis]
    } else {
        order.push({ value: value, layout: layout[axis] })
    }
    order.sort(compareMin)
},

// Group.tsx:115-139 (updateOrder — diff-and-swap application, virtualization-aware)
updateOrder: (item, offset, velocity) => {
    if (isReordering.current) return
    const newOrder = checkReorder(order, item, offset, velocity)
    if (order !== newOrder) {
        isReordering.current = true
        // Find which two values swapped and apply that swap
        // to the full values array. This preserves unmeasured
        // items (e.g. in virtualized lists).
        const newValues = [...values]
        for (let i = 0; i < newOrder.length; i++) {
            if (order[i].value !== newOrder[i].value) {
                const a = values.indexOf(order[i].value)
                const b = values.indexOf(newOrder[i].value)
                if (a !== -1 && b !== -1) {
                    ;[newValues[a], newValues[b]] = [newValues[b], newValues[a]]
                }
                break
            }
        }
        onReorder(newValues)
    }
},

// Group.tsx:142-144 (one reorder per render)
useEffect(() => {
    isReordering.current = false
})

// Group.tsx:190-192
function compareMin<V>(a: ItemData<V>, b: ItemData<V>) {
    return a.layout.min - b.layout.min
}
```

- `Item.tsx` — drag wiring. Key excerpts (line numbers are pre-plan-015; that plan only changes `useDefaultMotionValue`, lines 47–49):

```tsx
// Item.tsx:98-130 (abridged)
<Component
    drag={axis}
    {...props}
    dragSnapToOrigin
    style={{ ...style, x: point.x, y: point.y, zIndex }}
    layout={layout}
    onDrag={(event, gesturePoint) => {
        const { velocity, point: pointerPoint } = gesturePoint
        const offset = point[axis].get()
        updateOrder(value, offset, velocity[axis])
        autoScrollIfNeeded(groupRef.current, pointerPoint[axis], axis, velocity[axis])
        onDrag && onDrag(event, gesturePoint)
    }}
    onDragEnd={(event, gesturePoint) => {
        resetAutoScrollState()   // plan 017 changes this to resetAutoScrollState(groupRef.current)
        onDragEnd && onDragEnd(event, gesturePoint)
    }}
    onLayoutMeasure={(measured) => {
        registerItem(value, measured)
    }}
    ...
/>
```

- `moveItem` from `motion-utils` (`packages/motion-utils/src/array.ts:11`) — clones the array, splices the item out of `fromIndex` and inserts at `toIndex`. For adjacent indices this is identical to a swap; for distant indices it shifts everything between (correct grid reflow semantics).

- `Group.tsx:35` JSDoc currently reads: `The axis to reorder along. By default, items will be draggable on this axis. To make draggable on both axes, set `<Reorder.Item drag />`` — update as part of Step 5.

- SSR tests `__tests__/server.ssr.test.tsx` assert exact markup containing `touch-action:pan-x` (for the default `axis="y"` → `drag="y"`). The default axis does NOT change in this plan, so these must remain untouched and passing.

### Key behavioral invariant (the whole design rests on this)

During a drag, when a reorder commits and the dragged item's layout slot changes, the drag system rebases the item's transform so that `registered layout + current offset ≈ current visual position`. Evidence this holds today: the existing 1D algorithm compares `layout.max + offset` against neighbor centers *using freshly re-registered layouts* (`onLayoutMeasure` fires after each reorder render and `registerItem` updates entries). If offsets were not rebased, every 1D swap would immediately re-trigger (stale offset + moved layout double-counts) and reordering would run away — it doesn't. The 2D design relies on the same invariant. **Verify it empirically in Step 6 before polishing; see STOP conditions.**

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install (only if needed, once, foreground) | `make bootstrap` from repo root | exit 0 |
| Build | `yarn build` from repo root (never from a package dir) | exit 0 |
| Reorder unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder|check-reorder"` from repo root | all pass |
| Full client tests | `cd packages/framer-motion && yarn test-client` | pass (ignore pre-existing TextEncoder SSR + use-velocity failures) |
| SSR tests | `cd packages/framer-motion && yarn test-server` | Reorder SSR tests unchanged and passing |
| Lint | `yarn lint` from repo root | exit 0 |
| Cypress | see procedure below | pass on React 18 AND 19 |

### Cypress procedure (foreground only — background runs hang silently)

```bash
# React 18
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --headed --config baseUrl=http://localhost:$PORT --spec "cypress/integration/drag-to-reorder.ts,cypress/integration/reorder-grid.ts"
kill $DEV_PID

# React 19 (independent server, own port)
PORT=$((10000 + RANDOM % 50000))
cd ../../dev/react-19 && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --config-file=cypress.react-19.json --config baseUrl=http://localhost:$PORT --headed --spec "cypress/integration/drag-to-reorder.ts,cypress/integration/reorder-grid.ts"
kill $DEV_PID
```

`tail -60` the first run's output; don't re-run to fish for errors.

## Scope

**In scope** (the only files you should modify/create):
- `packages/framer-motion/src/components/Reorder/types.ts`
- `packages/framer-motion/src/components/Reorder/utils/check-reorder.ts`
- `packages/framer-motion/src/components/Reorder/Group.tsx`
- `packages/framer-motion/src/components/Reorder/Item.tsx`
- `packages/framer-motion/src/components/Reorder/utils/__tests__/check-reorder.test.ts` (create)
- `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx` (extend)
- `dev/react/src/tests/reorder-grid.tsx` (create)
- `packages/framer-motion/cypress/integration/reorder-grid.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- The drag gesture system (`src/gestures/drag/`), projection (`src/projection/`) — if the design needs changes there, that's a STOP condition, not an invitation.
- `utils/auto-scroll.ts` internals — plan 017's territory; you only *call* it.
- **Auto-axis detection** (inferring `"both"` from layout wrapping) — explicitly deferred; see Maintenance notes. The default stays `axis="y"`.
- SSR markup expectations in `server.ssr.test.tsx` — must pass unchanged; if your change forces them to change, STOP.
- Public API surface beyond the widened `axis` prop type.

## Git workflow

- Branch: `improve/018-reorder-multidimensional` off `main` (after 015/017 are merged, or rebased onto their branches per the operator).
- Commit per step; message style: short imperative sentence (repo examples: `Add auto-scroll support to Reorder.Group`, `Fix Reorder.Group axis change during window resize`).
- Do NOT push or open a PR unless the operator instructed it.

## Design specification

### API

`Reorder.Group` accepts `axis?: "x" | "y" | "both"`, default `"y"` (unchanged). With `"both"`, items get `drag` (both axes) and reorder targets are found geometrically in 2D.

### New `checkReorder` contract

Rewrite `utils/check-reorder.ts` to return indices instead of an array, and take a 2D offset:

```ts
import { Box, Point } from "motion-utils"   // verify Point is exported from motion-utils; if not, define `interface Point { x: number; y: number }` locally in types.ts

export interface ItemData<T> {
    value: T
    layout: Box          // full box now — was Axis
}

export interface ReorderMove {
    from: number
    to: number
}

export function checkReorder<T>(
    order: ItemData<T>[],
    value: T,
    offset: Point,
    axis: "x" | "y" | "both"
): ReorderMove | null
```

Velocity is no longer a parameter — direction emerges from geometry.

**1D path (`axis` is `"x"` or `"y"`)** — `order` is sorted by `layout[axis].min` (as today). Compute the dragged item's projected interval, then find the *furthest* item whose center it has crossed:

```ts
const projectedMin = item.layout[axis].min + offset[axis]
const projectedMax = item.layout[axis].max + offset[axis]
let target = index
// scan forward: every j > index whose center < projectedMax has been crossed
for (let j = index + 1; j < order.length; j++) {
    if (centerOf(order[j].layout[axis]) < projectedMax) target = j
    else break
}
if (target === index) {
    // scan backward: every j < index whose center > projectedMin has been crossed
    for (let j = index - 1; j >= 0; j--) {
        if (centerOf(order[j].layout[axis]) > projectedMin) target = j
        else break
    }
}
return target === index ? null : { from: index, to: target }
```

where `centerOf(a: Axis) = mixNumber(a.min, a.max, 0.5)`. For the adjacent case this reproduces today's threshold exactly (leading edge crosses next item's center) while removing the velocity gate and supporting multi-position jumps. Non-overlapping sorted items guarantee forward/backward can't both fire.

**2D path (`axis === "both"`)** — `order` is in registration order (= `values` order; see Group changes). Compute the dragged item's projected center point and find the item whose box contains it:

```ts
const projectedCenter = {
    x: centerOf(item.layout.x) + offset.x,
    y: centerOf(item.layout.y) + offset.y,
}
const target = order.findIndex(
    (entry, i) =>
        i !== index &&
        projectedCenter.x >= entry.layout.x.min &&
        projectedCenter.x <= entry.layout.x.max &&
        projectedCenter.y >= entry.layout.y.min &&
        projectedCenter.y <= entry.layout.y.max
)
return target === -1 ? null : { from: index, to: target }
```

A projected center in a gap between items targets nothing — correct. Mixed item sizes work because containment is per-item geometry, not grid arithmetic. Oscillation is prevented structurally: after a move commits, items re-register their *new* layout boxes (via `onLayoutMeasure` on the reorder render — registered boxes are layout positions, not mid-animation visual positions), so the dragged item's projected center now lands in its own new slot, which is excluded (`i !== index` after re-sort/re-registration), producing no further move until the pointer crosses into another item's box.

### Group.tsx changes

1. Prop type: `axis?: "x" | "y" | "both"` (update the `Props` interface and its JSDoc — see Step 5).
2. `registerItem` stores the full `Box`:
   ```ts
   registerItem: (value, layout) => {
       const idx = order.findIndex((entry) => value === entry.value)
       if (idx !== -1) {
           order[idx].layout = layout
       } else {
           order.push({ value, layout })
       }
       if (axis !== "both") order.sort(compareMin)
   },
   ```
   with `compareMin` comparing `a.layout[axis].min - b.layout[axis].min` (it must close over `axis`; convert it from a module-level function to one created inside the component or parameterised — keep output size in mind: a local arrow `const compareMin = (a, b) => a.layout[axis].min - b.layout[axis].min` inside the component body is fine). For `"both"`, registration order is DOM order, which is `values` order because items render in `values` order — do not sort.
3. `updateOrder` applies a *move*, not a swap:
   ```ts
   updateOrder: (item, offset) => {
       if (isReordering.current) return
       const move = checkReorder(order, item, offset, axis)
       if (!move) return
       isReordering.current = true
       // Map measured-order indices onto the full values array. This
       // preserves unmeasured items (e.g. in virtualized lists).
       const fromIndex = values.indexOf(order[move.from].value)
       const toIndex = values.indexOf(order[move.to].value)
       if (fromIndex !== -1 && toIndex !== -1) {
           onReorder(moveItem(values, fromIndex, toIndex))
       }
   },
   ```
   `moveItem` already clones (`[...arr]` parameter destructure). For adjacent indices this is exactly the old swap, so the existing virtualization unit test ("Preserves unmeasured items…", asserting `[1, 3, 2, 4, 5]`) must pass with only its `updateOrder(2, 30, 1)` call updated to the new signature `updateOrder(2, { x: 0, y: 30 })`.
4. Context type `updateOrder: (item: T, offset: Point) => void`; `axis: "x" | "y" | "both"` in `ReorderContextProps`.

### Item.tsx changes

```tsx
drag={axis === "both" ? true : axis}
...
onDrag={(event, gesturePoint) => {
    const { velocity, point: pointerPoint } = gesturePoint
    updateOrder(value, { x: point.x.get(), y: point.y.get() })
    if (axis === "both" || axis === "x") {
        autoScrollIfNeeded(groupRef.current, pointerPoint.x, "x", velocity.x)
    }
    if (axis === "both" || axis === "y") {
        autoScrollIfNeeded(groupRef.current, pointerPoint.y, "y", velocity.y)
    }
    onDrag && onDrag(event, gesturePoint)
}}
```

`drag={true}` already produces `touch-action: none` via the drag feature — no manual style handling. The Group JSDoc line "To make draggable on both axes, set `<Reorder.Item drag />`" must be updated to mention `axis="both"` (this doc line is the original source of #1400's confusion).

## Steps

### Step 1: Baseline

Run the Reorder unit tests and confirm green; run `yarn build` and confirm exit 0. Record results.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"` → pass.

### Step 2: Write unit tests for the new checkReorder (failing)

Create `utils/__tests__/check-reorder.test.ts`. Cases (use `Box` fixtures, items 100×100 with 10px gaps):

1D (`axis: "y"`, order sorted top-to-bottom):
- No move when projected max hasn't crossed next center → `null`.
- Adjacent move down when `layout.y.max + offset.y` crosses next center → `{from: 0, to: 1}`.
- Adjacent move up (negative offset crossing previous center) → `{from: 1, to: 0}`.
- Multi-jump: offset large enough to cross two centers → `{from: 0, to: 2}`.
- Value not in order → `null`. Zero offset → `null`.
- **Velocity-gate regression**: a crossing offset must produce a move with no velocity information at all (this was finding #4 — the old code returned early on `velocity === 0`).

2D (`axis: "both"`, 3×3 grid fixtures, order = values order):
- Projected center inside a diagonal neighbor's box → move to that index (e.g. item 0 dragged to item 4's slot → `{from: 0, to: 4}`).
- Projected center in a gap → `null`.
- Projected center inside the dragged item's own box → `null`.
- Mixed sizes: a 100×100 item dragged over a 200×100 item's box → move (containment, not index math).

These fail because the new signature doesn't exist yet (this is a feature, not a bug fix — API-shaped failure is expected here).

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="check-reorder"` → fails to compile/run (new API absent).

### Step 3: Implement types.ts + check-reorder.ts

Per the design spec. Move `ItemData` to keep living in `types.ts` (now with `layout: Box`); add `Point` import or local interface (check `node_modules/motion-utils/dist` or `packages/motion-utils/src/index.ts` for whether `Point` is exported — if not, define it in `types.ts`).

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="check-reorder"` → all Step 2 tests pass.

### Step 4: Update Group.tsx and Item.tsx

Per the design spec. Update the existing virtualization test's `updateOrder` call signature and the `registerItem` fixtures (they already pass full boxes). Extend `__tests__/index.test.tsx` with a 2D context-level test modeled on the existing "Preserves unmeasured items" test: register a 2×2 grid of boxes with `axis="both"` on the Group, call `updateOrder(1, { x: 115, y: 115 })` (diagonal into item 4's box), assert `onReorder` called with the item moved to index 3.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder|check-reorder"` → all pass. `cd packages/framer-motion && yarn test-server` → Reorder SSR tests pass *unchanged*.

### Step 5: Update JSDoc

`Group.tsx` `axis` prop JSDoc — replace with wording like: "The axis to reorder along, or `\"both\"` to allow reordering in two dimensions (e.g. wrapped or grid layouts). Defaults to `\"y\"`." Keep `@public`.

**Verify**: `yarn lint` → exit 0. `yarn build` → exit 0.

### Step 6: Dev page + manual invariant check

Create `dev/react/src/tests/reorder-grid.tsx` (auto-available at `?test=reorder-grid`). Model the file header/exports on `dev/react/src/tests/drag-to-reorder.tsx` (named `App` export). Content: a `Reorder.Group as="div" axis="both"` with `display: flex; flex-wrap: wrap; width: 340px`, nine `Reorder.Item as="div"` children, each exactly `100×100px` with `margin: 5px`, `id` set to the item value (e.g. `id="item-0"`), a visible label, and deterministic background colors. Plain `useState` for values `[0..8]`. No transitions overrides — default layout animations.

Then run it interactively once: `cd dev/react && yarn vite --port 9990`, open `http://localhost:9990/?test=reorder-grid`, and drag items around. You are checking the **key behavioral invariant**: items should reorder when the dragged item's center enters a neighbor's slot, settle without oscillating (no rapid back-and-forth swapping while holding still), and not teleport. If you cannot run a browser interactively, note that and rely on Step 7's mid-drag Cypress assertions — but say so in your report.

**Verify**: dev server starts and the page renders 9 items (at minimum `curl -s http://localhost:9990/?test=reorder-grid | grep -c root` → 1).

### Step 7: Cypress spec

Create `packages/framer-motion/cypress/integration/reorder-grid.ts`. Follow the pointer-event pattern from `cypress/integration/drag-to-reorder.ts` (trigger `pointerdown` → several `pointermove`s with `wait(50)` between → `pointerup`, all with `{ force: true }`). Tests:

1. **Diagonal reorder**: pointerdown on `#item-0`, move in ~5 steps to the center of item 4's slot (compute coordinates from the fixed 110px cell pitch), wait 100ms, assert mid-drag that the DOM order of `[id^="item-"]` elements has changed so that item 0 now occupies index 4's position in source order (query `.get("[id^='item-']")` and map ids). Then pointerup and re-assert the settled order.
2. **Gap drop is a no-op**: pointerdown on `#item-8`, move its center into the margin gap between two slots (offset by ~55px so the center is between boxes), wait, assert order unchanged, pointerup.
3. **No oscillation**: after the move in test 1, hold the pointer still for 500ms before pointerup and assert the order does not change again during the hold (capture order at two timestamps 300ms apart with `.then()`, not `.should()` — `.should()` retries until it passes and would mask oscillation).

Use `.then()` for all mid-drag captures per the repo's Cypress rules. Do not use `getAnimations()` (transform here is fine but unnecessary — DOM order is the assertion).

**Verify**: run the Cypress procedure (both React 18 and React 19, including the existing `drag-to-reorder.ts` spec as the 1D regression gate) → all pass on both.

### Step 8: Full verification

**Verify**:
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder|check-reorder"` → pass
- `cd packages/framer-motion && yarn test-client` → pass (modulo known pre-existing failures)
- `cd packages/framer-motion && yarn test-server` → Reorder SSR markup tests unchanged, passing
- `yarn lint`, `yarn build` from root → exit 0

## Test plan

Summarised from the steps: new `check-reorder.test.ts` (1D semantics preservation incl. velocity-free regression case, multi-jump, 2D containment/gap/self/mixed-size); extended `index.test.tsx` (2D context-level move application, updated virtualization test proving adjacent `moveItem` ≡ old swap); new Cypress `reorder-grid.ts` (diagonal reorder with mid-drag assertion, gap no-op, oscillation hold-check); existing `drag-to-reorder.ts` + SSR tests as 1D regression gates. Pattern files: `__tests__/index.test.tsx` for unit structure, `cypress/integration/drag-to-reorder.ts` for pointer sequences.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder|check-reorder"` exits 0; `check-reorder.test.ts` exists with ≥10 cases
- [ ] `grep -n "velocity" packages/framer-motion/src/components/Reorder/utils/check-reorder.ts` returns no matches
- [ ] `grep -n '"both"' packages/framer-motion/src/components/Reorder/Group.tsx` matches (new axis option)
- [ ] Cypress `reorder-grid.ts` AND `drag-to-reorder.ts` pass on React 18 and React 19
- [ ] `yarn test-server` Reorder SSR tests pass with **zero changes** to `server.ssr.test.tsx`
- [ ] `yarn lint` and `yarn build` exit 0; `git status` clean outside in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- **The key invariant fails**: in Step 6/7, items oscillate (swap back and forth while the pointer is still) or visually teleport after a 2D move. This means drag-offset rebasing doesn't behave as the 1D evidence suggests for 2D moves, and the fix likely lives in the drag/projection systems (out of scope). Report exactly what you observed (which fixture, which gesture, what the registered boxes/offsets were — add temporary `console.log` in `checkReorder` to capture them, then remove).
- The existing `drag-to-reorder.ts` Cypress spec fails on either React version and the failure traces to the new 1D scan logic rather than a test-coordinate issue. Do not tune thresholds to make it pass — the 1D feel contract is "leading edge crosses neighbor center," and deviation needs maintainer sign-off.
- SSR markup tests require changes (means the default `drag`/`touch-action` changed — the default axis must remain `"y"`).
- `Point` is not exported from `motion-utils` AND defining it locally conflicts with an existing `Point` import elsewhere in the package.
- The virtualization unit test cannot pass under move semantics without weakening its assertion.
- Implementing requires touching `src/gestures/` or `src/projection/`.

## Maintenance notes

- **Deferred: auto-axis detection.** The maintainer's bar for a revival (PR #1862 closing comment) included auto-detecting the axis from layout. It's deliberately out of scope here because it changes the *default* behavior (and SSR `touch-action` output) and multiplies the feel-risk surface. Once `axis="both"` ships and feels good, auto-detection is a small follow-up: after first measure, if registered boxes span >1 distinct row band and >1 distinct column band, behave as `"both"`. Write it as its own plan.
- **Feel review is mandatory before release.** The previous implementation died on feel, not correctness. A human should drag items around `?test=reorder-grid` (and ideally a CSS `display: grid` variant) before this ships. Reviewer checklist: no oscillation at slot boundaries (the containment+re-register design should prevent it; the boundary case is a center exactly on a box edge), behavior with fast diagonal flicks, behavior when dragging outside the group entirely.
- **Interaction with auto-scroll**: `axis="both"` now auto-scrolls both axes (two `autoScrollIfNeeded` calls). The capped-at-initial-limit logic is per scroll container and unchanged, but nobody has exercised x+y simultaneous auto-scroll — if QA finds weirdness, look there first.
- The richer `onReorder` signature requested in #2603 (`(newOrder, {value, from, to})`) falls out almost for free now that `updateOrder` computes `fromIndex`/`toIndex` — deliberately not included (API addition needs maintainer sign-off), but note it in the PR description.
- Issue #1400 should be linked in the PR (`Fixes #1400` only if the maintainer agrees explicit `axis="both"` satisfies it without auto-detection; otherwise `Refs #1400`).
