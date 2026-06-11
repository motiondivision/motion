# Plan 020: Ship a vanilla `drag()` API in motion-dom on the shared projection tree

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/layout packages/motion-dom/src/gestures packages/motion-dom/src/index.ts`
> This plan additionally REQUIRES PR #3748 ("Rewrite animateLayout with batched
> commits on a shared projection tree", branch `animate-layout-batched-commits`)
> to be merged before starting. Verify:
> `git log --oneline -5 -- packages/motion-dom/src/layout/LayoutAnimationBuilder.ts`
> must show commit `498aa804a` (or its merge) in history. If not merged, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED-HIGH (new public API + projection-tree integration)
- **Depends on**: plans/019-port-drag-pan-engine-to-motion-dom.md (hard), PR #3748 merged (hard), plans/009-layout-animation-builder-characterization-tests.md (soft — Step 1 refactors LayoutAnimationBuilder.ts; if 009's tests exist, run them as a gate)
- **Category**: direction
- **Planned at**: commit `42bfbe3ed`, 2026-06-11 (branch facts verified against `origin/animate-layout-batched-commits` @ `87d61a8e7`)

## Why this matters

Vanilla Motion has `animate()`, `press()`, `hover()`, `scroll()` — but no drag. The drag engine is the most-requested missing piece of framework-agnostic Motion, and after plan 019 it lives in motion-dom with only a thin options seam separating it from vanilla use. PR #3748 supplies the missing substrate: a persistent, shared projection tree over plain DOM (`layoutNodes` WeakMap + `prepareNode()` in `LayoutAnimationBuilder.ts`), so a vanilla draggable gets the same layout measurement, scroll handling, and — critically — the same mid-drag layout-change compensation and `animateLayout()` composition that React drag gets from React-managed projection nodes. This closes the `motion-dom/src/node/types.ts` MotionNode gap incrementally: one real gesture shipping on the shared tree, without waiting for the full MotionNode/effects unification arc.

## Current state

(All paths in `packages/motion-dom/src` unless noted. Line numbers for `LayoutAnimationBuilder.ts` refer to the PR #3748 version — re-locate by symbol name, the merged file may differ slightly.)

- `layout/LayoutAnimationBuilder.ts` (post-#3748, ~661 lines) — owns module-private shared-tree machinery this plan extracts:
  - `layoutNodes: WeakMap<Element, IProjectionNode>` — the persistent shared tree, keyed by element.
  - `getProjectionParent(element)` — walks `parentElement` chain to find the nearest mounted ancestor node in `layoutNodes`.
  - `createVisualElement()` — constructs a headless `HTMLVisualElement` (`props: {}`, `presenceContext: null`, empty `latestValues`, `{ allowProjection: true }`).
  - `prepareNode(element, transition)` — gets-or-creates the `HTMLProjectionNode` for an element: reuses `visualElementStore` VEs, clears untracked inline transforms before first measurement, constructs `HTMLProjectionNode(visualElement.latestValues, getProjectionParent(element))`, sets options from `data-layout`/`data-layout-id` attributes via `readNodeOptions()`, calls `node.mount(element)`, registers in `layoutNodes`.
  - `dropNode(element, node)` — stops animation if owned, unmounts, deletes from `layoutNodes`.
- **Load-bearing fact (verified)**: `projection/node/create-projection-node.ts:440-450` — `node.mount(instance)` calls `visualElement.mount(instance)` when `visualElement.current` is unset. So headless VEs from `prepareNode` are mounted: `visualElement.getValue()`, `visualElement.render()`, and `visualElementStore` registration all work on plain DOM. The drag engine's render path (`VisualElementDragControls.ts` — `this.visualElement.render()` in `onMove`, `getValue(axis, ...)` in `getAxisMotionValue`) therefore works against these nodes.
- `gestures/drag/VisualElementDragControls.ts` (post-019 location) — the engine. Constructor (post-019) is `(visualElement, getOptions?)` where `getOptions: () => MotionNodeOptions` overrides reading options from VE props. `addListeners()` wires pointerdown, ref-constraint measurement + ResizeObservers, window resize rescaling, and projection `"didUpdate"` origin compensation; returns a cleanup function. It requires `visualElement.projection` to exist before `addListeners()` runs (lines using `projection!`).
- `gestures/drag/DragControls.ts` (post-019) — multi-element imperative start/stop/cancel; `subscribe(controls)` returns unsubscribe.
- `gestures/press/index.ts` — the vanilla gesture API shape to match: `press(targetOrSelector, handler, options): VoidFunction`, using `resolveElements` (`utils/resolve-elements.ts`).
- `node/types.ts` — `MotionNodeOptions` declares the drag prop surface the engine reads via `getProps()`: `drag`, `dragDirectionLock`, `dragPropagation`, `dragConstraints: false | Partial<BoundingBox> | { current: Element | null }`, `dragElastic`, `dragMomentum`, `dragTransition`, `dragSnapToOrigin`, `dragListener`, `dragControls`, `onDragStart`, `onDrag`, `onDragEnd`, `onDirectionLock`, `onMeasureDragConstraints`, `onDragTransitionEnd`, `_dragX`, `_dragY`.
- HTML fixture infrastructure: `dev/html/public/animate-layout/*.html` (post-#3748) and `dev/html/public/projection/*.html` are plain-DOM fixtures run by Cypress config `packages/framer-motion/cypress.html.json`. Fixtures must not use bare module imports (Vite serves `public/` statically — known trap); copy the import pattern of an existing `animate-layout` fixture exactly. The fixture list for animate-layout specs lives in `packages/framer-motion/cypress/fixtures/animate-layout-tests.json`.

Repo conventions: named exports, `interface`, small-bundle bias, optional chaining. New public APIs need TSDoc with `@public` (see `press()` for tone).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Build all | `yarn build` | exit 0 |
| Rebuild motion-dom only (dev loop) | `cd packages/motion-dom && yarn build` | exit 0 (note: build output may be suppressed — check exit code) |
| motion-dom unit tests | `npx jest --config packages/motion-dom/jest.config.json` | all pass |
| animateLayout regression (characterization) | run the animate-layout Cypress HTML specs (below) | all pass |
| Lint | `yarn lint` | exit 0 |

Cypress HTML-fixture runs (plain-DOM tests; foreground only):

```bash
PORT=$((10000 + RANDOM % 50000))
cd dev/html && yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && cypress run --headed --config-file=cypress.html.json --config baseUrl=http://localhost:$PORT --spec "cypress/integration-html/<spec>.ts"
kill $DEV_PID
```

(Verify the exact integration folder name in `cypress.html.json` — read that file first; the projection/animate-layout specs it references are the pattern to follow.)

## Suggested executor toolkit

- Read `packages/framer-motion/cypress.html.json` and one existing animate-layout spec + fixture pair end-to-end before writing your own.
- Read `packages/motion-dom/src/gestures/press/index.ts` before designing `drag()`'s file — match its structure and TSDoc style.

## Scope

**In scope (modify/create only these):**

- `packages/motion-dom/src/layout/layout-tree.ts` (create — extracted shared-tree module)
- `packages/motion-dom/src/layout/LayoutAnimationBuilder.ts` (imports only — consume the extracted module)
- `packages/motion-dom/src/gestures/drag/index.ts` (create — the `drag()` API)
- `packages/motion-dom/src/gestures/drag/types.ts` (add `DragOptions`)
- `packages/motion-dom/src/index.ts` (export `drag`, `DragOptions`)
- `packages/motion-dom/src/gestures/drag/__tests__/drag-options.test.ts` (create)
- `dev/html/public/drag/*.html` (create fixtures)
- `packages/framer-motion/cypress/integration-html/` (or wherever `cypress.html.json` points) — new spec file(s)
- `plans/README.md` (status row)

**Out of scope (do NOT touch):**

- `VisualElementDragControls.ts` logic — if the engine needs a change beyond what the `getOptions` seam provides, STOP and report; don't fork its behavior.
- React-side drag (`packages/framer-motion/src/gestures/drag/index.ts`, Reorder) — must be unaffected.
- `whileDrag` / variants support for vanilla — explicitly deferred (no variant system on headless VEs).
- The MotionNode factory itself (`node/types.ts` surface beyond what exists) — this plan ships one gesture, not the node API.
- Auto-binding user-supplied motion values to styles beyond `addValue` (no styleEffect wiring here).

## Git workflow

- Branch: `advisor/020-vanilla-drag` off `main` (after #3748 and 011 are in).
- Commit per step; imperative messages matching repo style.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract the shared projection tree into `layout/layout-tree.ts`

Move from `LayoutAnimationBuilder.ts` into a new `packages/motion-dom/src/layout/layout-tree.ts`, exporting (module-internal to the package; do NOT add to the public index in this step):

- `layoutNodes` (the WeakMap)
- `getProjectionParent(element)`
- `createVisualElement()`
- `dropNode(element, node)`
- A generalized acquire function split out of `prepareNode`:

```ts
export interface LayoutNodeOptions {
    layout?: boolean
    layoutId?: string
    animationType?: "both" | "size" | "position" | "preserve-aspect"
    transition?: Transition
}

export function acquireLayoutNode(
    element: HTMLElement,
    options: LayoutNodeOptions
): IProjectionNode
```

`acquireLayoutNode` contains `prepareNode`'s body verbatim except the `readNodeOptions(element, transition)` call sites: it takes the resolved options directly. `LayoutAnimationBuilder.ts` keeps `readNodeOptions` (data-attribute parsing is builder-specific) and reimplements `prepareNode` as `acquireLayoutNode(element, readNodeOptions(element, transition))` plus its existing `isPresent`/`onExitComplete` reset lines. Net behavior for `animateLayout()` must be identical.

Careful with the get-or-create branch: on reuse, `prepareNode` currently calls `node.setOptions(readNodeOptions(...))` — in the extracted version, `acquireLayoutNode` calls `node.setOptions(options)` on reuse. Preserve the first-time-only inline-transform clearing and the `visualElementStore` lookup exactly.

**Verify**: `cd packages/motion-dom && yarn build` → exit 0; then run ALL existing animate-layout Cypress HTML specs (the list in `cypress/fixtures/animate-layout-tests.json` / the specs referencing `dev/html/public/animate-layout/`) → all pass. If plan 009's characterization tests exist, run them too → all pass.

### Step 2: Define `DragOptions` and the options adapter

In `packages/motion-dom/src/gestures/drag/types.ts`, add:

```ts
export interface DragOptions {
    /** Drag axis. true = both. @default true */
    axis?: boolean | "x" | "y"
    /** Constraint area: an Element to measure, or per-edge pixel offsets. */
    constraints?: Element | Partial<BoundingBox>
    elastic?: DragElastic
    momentum?: boolean
    transition?: Transition          // maps to dragTransition
    snapToOrigin?: boolean | "x" | "y"
    directionLock?: boolean
    propagation?: boolean
    distanceThreshold?: number
    controls?: DragControls          // imperative start/stop/cancel
    x?: MotionValue<number>          // external output values
    y?: MotionValue<number>
    onDragStart?: DragHandler
    onDrag?: DragHandler
    onDragEnd?: DragHandler
    onDirectionLock?: (axis: "x" | "y") => void
    onMeasureConstraints?: (constraints: BoundingBox) => BoundingBox | void
}
```

Write a pure mapper in `gestures/drag/index.ts`:

```ts
function mapDragOptions(element: HTMLElement, options: DragOptions): MotionNodeOptions {
    const { axis = true, constraints = false, ... } = options
    return {
        drag: axis,
        dragConstraints:
            constraints instanceof Element ? { current: constraints } : constraints,
        dragElastic: options.elastic,
        dragMomentum: options.momentum,
        dragTransition: options.transition,
        dragSnapToOrigin: options.snapToOrigin,
        dragDirectionLock: options.directionLock,
        dragPropagation: options.propagation,
        onDragStart: ..., onDrag: ..., onDragEnd: ...,
        onDirectionLock: ..., onMeasureDragConstraints: options.onMeasureConstraints,
        onDragTransitionEnd: ...,
    }
}
```

Only map keys with defined values, so the engine's own defaulting in `getProps()` (drag-prop defaults at the bottom of `VisualElementDragControls.ts`) stays the single source of defaults. Note `{ current: constraints }` deliberately satisfies the structural `isRefObject` check — vanilla element constraints reuse the entire ref-constraints path (measurement, ResizeObservers, window-resize rescaling) with zero engine changes.

**Verify**: `cd packages/motion-dom && yarn build` → exit 0 (types compile; `drag()` not wired yet — keep the mapper exported for the unit test).

### Step 3: Implement `drag()`

In `packages/motion-dom/src/gestures/drag/index.ts`:

```ts
export function drag(
    targetOrSelector: ElementOrSelector,
    options: DragOptions = {}
): VoidFunction {
    const cancelFns: VoidFunction[] = []

    for (const element of resolveElements(targetOrSelector)) {
        if (!(element instanceof HTMLElement)) continue

        // 1. Acquire the element's node from the shared tree.
        //    Drag-only elements join with no layout/layoutId options;
        //    elements that also carry data-layout keep whatever options
        //    a builder set — do not overwrite layout/layoutId here.
        const node = acquireLayoutNode(element, {})

        const visualElement = node.options.visualElement as HTMLVisualElement

        // 2. Register external output values so the VE render pipeline
        //    is the single writer of element.style.transform.
        options.x && visualElement.addValue("x", options.x)
        options.y && visualElement.addValue("y", options.y)

        // 3. Instantiate the engine with the injected options resolver.
        const dragControls = new VisualElementDragControls(
            visualElement,
            () => mapDragOptions(element, options)
        )

        const removeListeners = dragControls.addListeners()
        const unsubscribe = options.controls?.subscribe(dragControls)

        cancelFns.push(() => {
            unsubscribe?.()
            removeListeners?.()
            dragControls.isDragging
                ? dragControls.cancel()
                : dragControls.endPanSession()
        })
    }

    return () => cancelFns.forEach((fn) => fn())
}
```

Resolve these specifics while implementing (decisions, not options):

- `acquireLayoutNode(element, {})` on an element already in the tree must NOT clobber existing layout options — check the Step 1 reuse branch: when called with `{}`, skip `setOptions` entirely if the node already exists and the options object has no keys. Add that guard in `acquireLayoutNode`.
- `addListeners()` assumes `projection` exists (it does — step 3.1) and calls `projection.updateLayout()` if no layout yet; that's the desired eager measure.
- `addValue` API: confirm the method name on motion-dom's `VisualElement` (`grep -n "addValue" packages/motion-dom/src/render/VisualElement.ts`); if the signature differs, adapt the call, not the engine.
- Export `drag` and `DragOptions` from `packages/motion-dom/src/index.ts`. There is no existing export named `drag` in motion-dom or framer-motion (verified at planning time) — if the build reports a collision, STOP.
- TSDoc the function `@public`, modeled on `press()`.

**Verify**: `yarn build` (root) → exit 0; `node -e "console.log(typeof require('./packages/motion-dom/dist/cjs/index.js').drag)"` → `function`.

### Step 4: Unit tests for the pure parts

Create `packages/motion-dom/src/gestures/drag/__tests__/drag-options.test.ts` covering `mapDragOptions`:

- default: `{}` → `{ drag: true, dragConstraints: false }` and no other defined keys
- `axis: "x"` → `drag: "x"`
- `constraints: element` → `dragConstraints: { current: element }` (use `document.createElement`)
- `constraints: { left: 0, right: 100 }` → passed through
- handler mapping: `onDragStart`/`onDrag`/`onDragEnd`/`onMeasureConstraints` arrive under the engine's prop names

Model file structure on an existing motion-dom gesture test (`packages/motion-dom/src/gestures/utils/__tests__/is-primary-pointer.test.ts`).

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="drag-options"` → all pass.

(Do not attempt full JSDOM drag simulation — JSDOM lacks real layout and `getBoundingClientRect` returns zeros; pointer-flow coverage belongs in the Cypress HTML fixtures below.)

### Step 5: Cypress HTML fixtures + specs

Create fixtures in `dev/html/public/drag/`, copying the import/setup pattern of an existing `dev/html/public/animate-layout/*.html` fixture byte-for-byte (script tag style, no bare imports):

1. `drag-basic.html` — a 100×100 box with `drag(box)`. Spec: pointerdown at center, three pointermoves (+100, +50), pointerup; assert mid-gesture `transform` translates track the pointer (read computed style, single-point `.then()` assertions, not `.should()` retries).
2. `drag-axis-x.html` — `drag(box, { axis: "x" })`; assert y never moves.
3. `drag-constraints-element.html` — box inside a larger bordered container, `drag(box, { constraints: container })`; drag far past the right edge, assert final x clamps to container bounds (allow elastic overshoot mid-gesture, settle after release with `momentum: false, elastic: 0` for determinism).
4. `drag-momentum.html` — flick then assert continued movement after pointerup (model on the React `drag-momentum` spec's approach).
5. `drag-with-animate-layout.html` — **the composition case this plan exists for**: a draggable box and a sibling with `data-layout`; mid-drag, call `animateLayout()` mutating the sibling so the draggable's layout shifts; assert the box does not jump relative to the pointer (the projection `"didUpdate"` origin-compensation path in `addListeners`).

Spec file(s) go where `cypress.html.json`'s `integrationFolder`/`specPattern` points; register fixtures the same way the animate-layout specs do (check `cypress/fixtures/animate-layout-tests.json` for whether a fixture-list JSON is the mechanism, and mirror it).

**Verify**: run the new spec(s) via the Cypress HTML command block → all pass. Then re-run the animate-layout specs → still all pass (drag-only nodes in the shared tree must not perturb builder behavior).

### Step 6: Full gate

`yarn build && yarn lint`, motion-dom jest suite, framer-motion `yarn test-client` (React drag must be untouched), new + existing HTML Cypress specs.

**Verify**: all green.

## Test plan

- Unit (Jest, motion-dom): `drag-options.test.ts` — 5+ cases listed in Step 4.
- E2E (Cypress HTML, plain DOM): the 5 fixtures/specs in Step 5; the composition fixture (#5) is the real regression gate for "based on the shared projection tree".
- Regression: existing animate-layout HTML specs (shared-tree extraction), framer-motion client jest + at minimum the `drag.ts` Cypress React spec (engine untouched proof).

## Done criteria

ALL must hold:

- [ ] `yarn build` and `yarn lint` exit 0
- [ ] `npx jest --config packages/motion-dom/jest.config.json` passes incl. new `drag-options` tests
- [ ] New Cypress HTML drag specs pass (all 5 fixtures)
- [ ] Existing animate-layout Cypress HTML specs pass unchanged
- [ ] `cd packages/framer-motion && yarn test-client` passes (pre-existing failures excepted); no React-side source files modified (`git status`)
- [ ] `drag` is exported: `node -e "console.log(typeof require('./packages/motion-dom/dist/cjs/index.js').drag)"` prints `function`
- [ ] No files outside the in-scope list modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- PR #3748 is not merged, or the merged `LayoutAnimationBuilder.ts` differs structurally from the described `prepareNode`/`layoutNodes` shape (re-plan Step 1 against reality).
- Plan 019 is not DONE (no `VisualElementDragControls` in motion-dom, or no `getOptions` constructor seam).
- The engine needs a logic change to work headless (e.g. `addListeners` throws on a node acquired via `acquireLayoutNode`, or `visualElement.render()` doesn't write the transform in fixture #1). Report the exact failure — the fix belongs in a deliberate engine change, not an improvised fork.
- The composition fixture (#5) fails because `willUpdate`/snapshot timing differs for drag-only nodes — this is a real architectural finding; report it with the failing fixture rather than papering over it with waits.
- Any animate-layout spec regresses after Step 1.
- A naming collision on `drag` surfaces anywhere in the export chain (motion-dom → framer-motion `dom.ts` → motion).

## Maintenance notes

- This establishes the pattern for future vanilla gestures that need projection (vanilla Reorder is the obvious next consumer; it would build on `drag()` + `animateLayout()`).
- `drag()`'s cancel function intentionally does NOT `dropNode` — the node stays in the `layoutNodes` WeakMap (GC'd with the element) so an element that's both draggable and `data-layout` keeps its tree identity. If a leak is ever suspected, the WeakMap keying makes element GC the backstop; revisit only with evidence.
- Reviewers should scrutinize: the `acquireLayoutNode` reuse-branch guard (empty options must not clear builder-set `layout`/`layoutId`), and the single-writer invariant (only the VE render pipeline writes `style.transform`; user-supplied `x`/`y` values are registered via `addValue`, never bound separately).
- Deferred deliberately: `whileDrag` (needs vanilla variants), `dragListener: false` equivalent (vanilla users simply don't call `drag()`; imperative-only start is covered by `options.controls` + `DragControls.start`), SVG draggables (engine is typed `VisualElement<HTMLElement>`), and any `styleEffect` auto-binding.
- API naming (`drag`, `DragOptions`, option names without the `drag` prefix) should get maintainer sign-off in PR review — flag it explicitly in the PR description.
