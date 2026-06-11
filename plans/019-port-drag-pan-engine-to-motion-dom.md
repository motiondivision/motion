# Plan 019: Port the pan/drag gesture engine to motion-dom (behavior-preserving)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures packages/framer-motion/src/events packages/framer-motion/src/utils/distance.ts packages/framer-motion/src/utils/get-context-window.ts packages/motion-dom/src/gestures packages/motion-dom/src/index.ts packages/motion-dom/src/node/types.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt (prerequisite for plan 020, direction)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

The drag/pan gesture engine (`PanSession`, `VisualElementDragControls`, constraint math, `DragControls`) lives in `framer-motion` but is already almost React-free: its only framer-motion-local dependencies are ~50 lines of trivial helpers, and `VisualElement`, the projection system, `setDragLock`, `measurePageBox`, `animateMotionValue`, and all the types it consumes already live in `motion-dom`. Moving the engine to `motion-dom` — with framer-motion reduced to thin re-export shims and the React `Feature` adapters — is the prerequisite for a vanilla `drag()` API (plan 020) and resolves the existing TODO at `packages/motion-dom/src/node/types.ts:723` (`dragControls?: any // TODO: Replace with DragControls when ported to motion-dom`). This plan is **strictly behavior-preserving**: no logic changes, all existing tests pass unchanged.

## Current state

Files and their roles (all verified at `42bfbe3ed`):

**To move into motion-dom:**

- `packages/framer-motion/src/gestures/pan/PanSession.ts` (435 lines) — pointer-tracking session: history, velocity, scroll compensation, per-frame throttling. Imports from motion-dom (`cancelFrame`, `frame`, `frameData`, `isPrimaryPointer`, `EventInfo`, `PanHandler`), motion-utils, and three framer-motion locals: `addPointerEvent`, `extractEventInfo`, `distance2D`.
- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` (854 lines) — the drag engine. Already imports `type VisualElement`, `setDragLock`, `measurePageBox`, `ResolvedConstraints`, `animateMotionValue`, `addValueToWillChange`, `resize`, `isElementTextInput`, `eachAxis`, `percent`, etc. from `motion-dom` (lines 1–22). framer-motion-local imports (lines 23–37): `addPointerEvent`, `extractEventInfo`, `MotionProps` (type only, for `getProps()`), `getContextWindow`, `isRefObject`, `PanSession`, and `./utils/constraints`.
- `packages/framer-motion/src/gestures/drag/utils/constraints.ts` (232 lines) — pure constraint math. Imports **only** from `motion-dom` and `motion-utils` already. Zero React coupling.
- `packages/framer-motion/src/events/add-pointer-event.ts` (11 lines) and `packages/framer-motion/src/events/event-info.ts` (20 lines) — `addPointerEvent`, `extractEventInfo`, `addPointerInfo`. Depend only on motion-dom's `addDomEvent`, `isPrimaryPointer`, `EventInfo`.
- `packages/framer-motion/src/utils/distance.ts` (10 lines) — `distance`, `distance2D`. Depends only on `motion-utils` `Point`.
- `packages/framer-motion/src/utils/get-context-window.ts` (6 lines) — `getContextWindow(visualElement)`. Depends only on motion-dom's `VisualElement` type.
- `packages/framer-motion/src/gestures/drag/use-drag-controls.ts` — contains two things: the `DragControls` class (React-free except `(event as React.PointerEvent).nativeEvent || event` at line 63) and the `useDragControls()` hook (stays in framer-motion).

**Stay in framer-motion (thin React adapters):**

- `packages/framer-motion/src/gestures/drag/index.ts` — `DragGesture extends Feature<HTMLElement>`; subscribes `dragControls` prop, calls `controls.addListeners()`.
- `packages/framer-motion/src/gestures/pan/index.ts` — `PanGesture extends Feature<Element>`; wraps `PanSession` with `onPan*` props.

**Key facts that make this a near-mechanical move:**

- motion-dom's `VisualElement.getProps()` returns `MotionNodeOptions` (`packages/motion-dom/src/render/VisualElement.ts:755`, type at line 310), and `MotionNodeOptions` in `packages/motion-dom/src/node/types.ts` **already declares the full drag prop surface** (`drag`, `dragDirectionLock`, `dragPropagation`, `dragConstraints`, `dragElastic`, `dragMomentum`, `dragTransition`, `dragControls`, `dragSnapToOrigin`, `dragListener`, `onDrag*`, etc. — lines ~583–780). So `VisualElementDragControls.getProps(): MotionProps` can become `getProps(): MotionNodeOptions` with no behavioral change.
- `dragConstraints` is typed structurally as `false | Partial<BoundingBox> | { current: Element | null }` (`node/types.ts:650`) — no React ref type needed.
- `presenceContext` and `animationState` are fields on motion-dom's `VisualElement`; the engine's uses (`VisualElementDragControls.ts:107-108, 175-176, 290-305`) compile unchanged in motion-dom.
- motion-dom already has the destination directories: `packages/motion-dom/src/gestures/drag/` (currently `types.ts` + `state/`) and `packages/motion-dom/src/gestures/pan/` (currently `types.ts`).
- Public API chain: `packages/framer-motion/src/dom.ts:1` is `export * from "motion-dom"` and the `motion` package re-exports that, so anything exported from motion-dom's index is automatically public — **do not add duplicate exports to framer-motion's index for moved symbols that framer-motion already exports** (e.g. `DragControls`); instead make framer-motion's existing export site a re-export of the motion-dom implementation, otherwise the build will fail with duplicate-export errors.

Repo conventions: named exports only, `interface` over `type` for object shapes, prioritise small output size, prefer optional chaining. Match the import style of existing motion-dom gesture files (see `packages/motion-dom/src/gestures/press/index.ts`).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Install (only if needed) | `yarn` | exit 0 |
| Build all packages | `yarn build` | exit 0 |
| Drag/pan unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="drag\|pan"` | all pass |
| Full framer-motion client tests | `cd packages/framer-motion && yarn test-client` | pass (ignore pre-existing failures: SSR `TextEncoder not defined`, `use-velocity`) |
| motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json` | all pass |
| Cypress drag specs (React 18) | see block below | all specs pass |
| Cypress drag specs (React 19) | see block below with `cypress.react-19.json` | all specs pass |

Cypress (per CLAUDE.md — start Vite directly, never `yarn dev-server`/turbo; run in foreground):

```bash
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT \
  --spec "cypress/integration/drag.ts,cypress/integration/drag-momentum.ts,cypress/integration/drag-ref-constraints-absolute-scrolled.ts,cypress/integration/drag-ref-constraints-element-resize.ts,cypress/integration/drag-ref-constraints-resize-handle.ts,cypress/integration/drag-to-reorder.ts,cypress/integration/drag-scroll-while-drag.ts,cypress/integration/layout-relative-drag.ts"
kill $DEV_PID
# Repeat with dev/react-19 and --config-file=cypress.react-19.json for React 19.
```

## Scope

**In scope (modify/create only these):**

- `packages/motion-dom/src/gestures/pan/PanSession.ts` (create — moved)
- `packages/motion-dom/src/gestures/drag/VisualElementDragControls.ts` (create — moved)
- `packages/motion-dom/src/gestures/drag/DragControls.ts` (create — class extracted from use-drag-controls.ts)
- `packages/motion-dom/src/gestures/drag/utils/constraints.ts` (create — moved)
- `packages/motion-dom/src/gestures/drag/utils/is-ref-object.ts` (create — small structural helper)
- `packages/motion-dom/src/events/add-pointer-event.ts`, `packages/motion-dom/src/events/event-info.ts` (create — moved)
- `packages/motion-dom/src/utils/distance.ts` (create — moved)
- `packages/motion-dom/src/utils/get-context-window.ts` (create — moved)
- `packages/motion-dom/src/index.ts` (add exports)
- `packages/motion-dom/src/node/types.ts` (one line: `dragControls?: any` → typed)
- The framer-motion source files listed in "Current state" (convert to re-export shims or update imports)
- `packages/framer-motion/src/gestures/drag/__tests__/*` and `packages/framer-motion/src/gestures/drag/utils/__tests__/constraints.test.ts` — **only** import-path updates if a moved symbol's old path is deleted; prefer keeping shims so tests don't change at all
- `plans/README.md` (status row)

**Out of scope (do NOT touch):**

- Any behavior change to drag/pan logic — no logic edits whatsoever, including the known dead `_point` parameter and the overdamp hack (those are plan 021).
- `packages/motion-dom/src/layout/**` and `LayoutAnimationBuilder` (plan 020 / PR #3748 territory).
- `packages/framer-motion/src/components/Reorder/**` — consumes the `drag` prop, unaffected by a pure move.
- The `Feature` classes' logic (`gestures/drag/index.ts`, `gestures/pan/index.ts`) beyond import-path updates.
- framer-motion's `src/utils/is-ref-object.ts` — it has other consumers (e.g. `use-scroll`); leave it.

## Git workflow

- Branch: `advisor/019-port-drag-pan-engine` off `main`.
- One commit per step below; message style matches repo (`git log` examples: "Fix stranded drag transform after layout swap in React 19", imperative, no conventional-commit prefixes).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Move the leaf helpers into motion-dom

Create in motion-dom, copying implementations verbatim from the framer-motion files listed in "Current state":

1. `packages/motion-dom/src/events/event-info.ts` — `extractEventInfo`, `addPointerInfo`, `EventListenerWithPointInfo`. Change `import { EventInfo, isPrimaryPointer } from "motion-dom"` to relative imports (`../gestures/types` for `EventInfo` — check where `EventInfo` is declared with `grep -rn "interface EventInfo" packages/motion-dom/src` — and `../gestures/utils/is-primary-pointer`).
2. `packages/motion-dom/src/events/add-pointer-event.ts` — `addPointerEvent`. motion-dom's `addDomEvent` is at `packages/motion-dom/src/events/add-dom-event.ts` (verify with `ls packages/motion-dom/src/events/` — if the directory doesn't exist yet, find `addDomEvent` via grep and place these files beside it).
3. `packages/motion-dom/src/utils/distance.ts` — `distance`, `distance2D`.
4. `packages/motion-dom/src/utils/get-context-window.ts` — `getContextWindow`, importing `VisualElement` relatively (`../render/VisualElement`).
5. `packages/motion-dom/src/gestures/drag/utils/is-ref-object.ts`:

```ts
export function isRefObject<E = any>(ref: any): ref is { current: E } {
    return (
        ref &&
        typeof ref === "object" &&
        Object.prototype.hasOwnProperty.call(ref, "current")
    )
}
```

Export the new public symbols (`addPointerEvent`, `extractEventInfo`, `addPointerInfo`, `distance`, `distance2D`, `getContextWindow`) from `packages/motion-dom/src/index.ts`, keeping alphabetical/grouped ordering consistent with the file's existing sections.

Convert the framer-motion originals (`src/events/add-pointer-event.ts`, `src/events/event-info.ts`, `src/utils/distance.ts`, `src/utils/get-context-window.ts`) into one-line re-exports from `"motion-dom"` so every existing framer-motion import keeps working.

**Verify**: `yarn build` → exit 0. If the build fails with duplicate export errors, framer-motion's index already re-exported one of these names — resolve by removing the duplicate framer-motion export site, not the motion-dom one.

### Step 2: Move constraints.ts

Move `packages/framer-motion/src/gestures/drag/utils/constraints.ts` → `packages/motion-dom/src/gestures/drag/utils/constraints.ts`. Convert its `"motion-dom"` imports (`calcLength`, `mixNumber`, `DragElastic`, `ResolvedConstraints`) to relative paths. Replace the framer-motion original with a re-export shim from `"motion-dom"`, and export the moved functions (`applyConstraints`, `calcRelativeConstraints`, `calcRelativeAxisConstraints`, `calcViewportConstraints`, `calcOrigin`, `rebaseAxisConstraints`, `resolveDragElastic`, `defaultElastic`, and the rest) from motion-dom's index.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="constraints"` → all pass (the existing test `packages/framer-motion/src/gestures/drag/utils/__tests__/constraints.test.ts` runs against the shim unchanged).

### Step 3: Move PanSession

Move `packages/framer-motion/src/gestures/pan/PanSession.ts` → `packages/motion-dom/src/gestures/pan/PanSession.ts`. Update imports: motion-dom symbols become relative; `addPointerEvent`/`extractEventInfo`/`distance2D` now come from the motion-dom locations created in Step 1. Export `PanSession` (and its `PanSessionOptions`/handler types) from motion-dom's index. Replace the framer-motion original with a re-export shim. Update `packages/framer-motion/src/gestures/pan/index.ts` to import `PanSession` from the shim or `"motion-dom"` directly (either is fine; prefer `"motion-dom"`).

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="pan"` → all pass.

### Step 4: Move VisualElementDragControls with the options-resolver seam

Move `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` → `packages/motion-dom/src/gestures/drag/VisualElementDragControls.ts` with exactly these changes:

1. All imports become relative/motion-dom-internal; `PanSession`, `addPointerEvent`, `extractEventInfo`, `getContextWindow`, `isRefObject`, constraints utils now resolve to the files moved in Steps 1–3.
2. `import { MotionProps } from "../../motion/types"` → use `MotionNodeOptions` from `../../node/types`. `getProps(): MotionProps` (line 770) becomes `getProps(): MotionNodeOptions`.
3. Add an **optional injected options resolver** (this is the seam plan 020 builds on; with no third argument behavior is byte-identical):

```ts
constructor(
    visualElement: VisualElement<HTMLElement>,
    getOptions?: () => MotionNodeOptions
) {
    this.visualElement = visualElement
    if (getOptions) this.getBaseOptions = getOptions
}

private getBaseOptions: () => MotionNodeOptions = () =>
    this.visualElement.getProps()

getProps(): MotionNodeOptions {
    const props = this.getBaseOptions()
    // ...existing defaults destructure/spread unchanged (lines 771-788)
}
```

   Every internal `this.visualElement.getProps()` call used for *drag options* must route through `this.getProps()` — audit the file: line 547 (`getAxisMotionValue`) and line 622 (`transformTemplate` in `scalePositionWithinConstraints`) read `this.visualElement.getProps()` directly; change both to `this.getProps()`. (Behavior identical today since the default resolver is `visualElement.getProps`.)
4. Keep `elementDragControls`, `DragControlOptions`, `expectsResolvedDragConstraints` exported from the new location; export `VisualElementDragControls`, `elementDragControls`, `expectsResolvedDragConstraints`, and `DragControlOptions` from motion-dom's index.

Replace the framer-motion original with a re-export shim. Update `packages/framer-motion/src/gestures/drag/index.ts` imports. Run `grep -rn "VisualElementDragControls\|elementDragControls\|expectsResolvedDragConstraints" packages/framer-motion/src --include="*.ts*" | grep -v __tests__` and update every consumer (known: `gestures/drag/index.ts`, `motion/features/definitions.ts`, `use-drag-controls.ts`) to import from the shim or `"motion-dom"`.

**Verify**: `yarn build` → exit 0, then `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="drag"` → all pass.

### Step 5: Extract DragControls class

Create `packages/motion-dom/src/gestures/drag/DragControls.ts` containing the `DragControls` class from `use-drag-controls.ts:28-98`, with the React type removed:

```ts
start(
    event: PointerEvent | { nativeEvent: PointerEvent },
    options?: DragControlOptions
) {
    const nativeEvent =
        (event as { nativeEvent?: PointerEvent }).nativeEvent || (event as PointerEvent)
    this.componentControls.forEach((controls) => {
        controls.start(nativeEvent, options)
    })
}
```

`packages/framer-motion/src/gestures/drag/use-drag-controls.ts` keeps only `useDragControls()` and re-exports `DragControls` from `"motion-dom"`. Export `DragControls` from motion-dom's index — then check framer-motion's public index (`grep -rn "DragControls" packages/framer-motion/src/index.ts packages/framer-motion/src/dom.ts`): since `dom.ts` re-exports all of motion-dom, remove any now-duplicate named export of `DragControls` from framer-motion's index if the build reports a conflict (keep `useDragControls` exported as before).

Update `packages/motion-dom/src/node/types.ts:723`: `dragControls?: any // TODO: ...` → `dragControls?: DragControls` with the relative import added to the file's existing import block (it already imports from `../gestures/drag/types` at line 9).

**Verify**: `yarn build` → exit 0; `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-drag-controls"` → all pass.

### Step 6: Full verification sweep

Run, in order:

1. `cd packages/framer-motion && yarn test-client` → pass (modulo the pre-existing failures noted in Commands).
2. `npx jest --config packages/motion-dom/jest.config.json` (from root) → pass.
3. `yarn lint` → exit 0.
4. The Cypress drag spec list against React 18, then React 19 (commands above) → all pass.

**Verify**: all four gates green.

## Test plan

This is a behavior-preserving move: **no new tests**. The regression gates are the existing suites:

- `packages/framer-motion/src/gestures/drag/__tests__/index.test.tsx`, `use-drag-controls.test.tsx`, `utils/__tests__/constraints.test.ts` — must pass without modification (shims preserve import paths).
- The 8 Cypress drag specs listed in Commands, on both React versions.

If any existing test requires more than an import-path change to pass, that is a STOP condition (it means behavior drifted).

## Done criteria

ALL must hold:

- [ ] `yarn build` exits 0
- [ ] `yarn lint` exits 0
- [ ] `cd packages/framer-motion && yarn test-client` passes (pre-existing TextEncoder/use-velocity failures excepted)
- [ ] `npx jest --config packages/motion-dom/jest.config.json` passes
- [ ] Listed Cypress drag specs pass on React 18 AND React 19
- [ ] `grep -rn "from \"react\"" packages/motion-dom/src/gestures packages/motion-dom/src/events` returns no matches
- [ ] `grep -n "dragControls?: any" packages/motion-dom/src/node/types.ts` returns no matches
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Code at the "Current state" locations doesn't match the cited excerpts/line numbers (drift since `42bfbe3ed` — e.g. PR #3748 or another branch landed touching these files).
- Any existing drag/pan/constraints test fails and the fix would require changing test assertions or gesture logic (not just an import path).
- Moving a file creates a circular import inside motion-dom that you cannot resolve by importing from a deeper relative path (i.e. you'd need to restructure modules).
- `yarn build` reports duplicate exports you cannot resolve by removing a framer-motion-side duplicate (never resolve by un-exporting from motion-dom).
- You find a consumer of `PanSession`/`VisualElementDragControls`/`elementDragControls` outside `packages/framer-motion/src` and `packages/motion-dom/src` (e.g. in `dev/` apps importing deep paths).

## Maintenance notes

- The `getOptions` constructor seam added in Step 4 exists for plan 020 (vanilla `drag()`); do not remove it as "unused" — plan 020's options adapter injects it.
- Reviewers should diff the moved files against the originals (`git diff --no-index`) to confirm changes are limited to imports, the `MotionNodeOptions` type swap, the `getOptions` seam, and the `DragControls` event-unwrap typing.
- Re-export shims left in framer-motion (`src/events/*`, `src/utils/distance.ts`, etc.) are deliberate to keep this diff minimal; a follow-up may inline them and update all framer-motion imports, but that's churn without user value — fold it into the next big framer-motion refactor instead.
- Bundle size: pure moves + re-exports should be size-neutral. If the repo's size checks flag growth, check that moved modules aren't being double-included (shim importing motion-dom AND old copy still present).
