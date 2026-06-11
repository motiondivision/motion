# Plan 009: Characterization tests for LayoutAnimationBuilder

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/layout/`
> If `LayoutAnimationBuilder.ts` changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (test-only change; no source modification permitted)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `42bfbe3ed`, 2026-06-10

## Why this matters

`packages/motion-dom/src/layout/LayoutAnimationBuilder.ts` (385 lines) is the engine behind `animateLayout()` — imperative FLIP layout animations over plain DOM, exported publicly from `motion-dom` (see `src/index.ts:313-315`). It is one of the most actively developed files in the repo (16 changes in the last year: shared-element handling, exit cleanup, crossfade fixes) and has **zero unit tests** — the only coverage is browser E2E fixtures (`dev/html/public/projection/animate-*.html` run via Cypress), which are slow and catch visual regressions, not logic regressions. The pure orchestration logic — argument parsing, element collection, attribute parsing, exiting-element bookkeeping — is unit-testable in JSDOM today. Characterization tests lock in current behavior so the ongoing iteration on this file (and the planned effects/VisualElement unification, which will touch projection) can't silently break it.

This plan deliberately scopes to the **DOM-independent and DOM-light logic**. Full projection-driven animation flows need real layout measurement and stay in Cypress (JSDOM returns zeroed `getBoundingClientRect`, a known limitation that already forces two framer-motion layout tests to be skipped).

## Current state

- `packages/motion-dom/src/layout/LayoutAnimationBuilder.ts` — the only file in `src/layout/`; no `__tests__` directory exists there. Key testable exports and internals:
  - `parseAnimateLayoutArgs(scopeOrUpdateDom, updateDomOrOptions?, options?)` (line 232, **exported**) — overload resolution: `(fn)` → scope=document; `(fn, options)` → options as defaults; `(selectorOrElement, fn, options?)` → resolves scope via `resolveElements`, falls back to `document` when the selector matches nothing.
  - `collectLayoutElements(scope)` (line 261, module-private) — `scope.querySelectorAll("[data-layout], [data-layout-id]")`, plus the scope itself prepended if it matches the selector.
  - `readLayoutAttributes(element)` (line 273, module-private) — maps `data-layout=""`/`"true"` → `true`, other strings pass through (`"position"`, `"size"`, ...), `data-layout-id` → `layoutId`.
  - `class LayoutAnimationBuilder` (line 62) — constructor schedules `this.start()` on `frame.postRender`; `.shared(id, transition)` records per-layoutId transition overrides consulted in `buildRecords` (line 176-179); `.then()` proxies the ready promise. `start()` (line 102): collect before-records → `willUpdate()` each → `await updateDom()` → collect after-records → `handleExitingElements` → `didUpdate()` on root → resolve with a `GroupAnimation`.
  - `handleExitingElements(before, after)` (line 193) — elements present before but not after: if they have a `layoutId`, mark `isPresent = false` and `relegate()`; always `visualElement.unmount()` and `visualElementStore.delete(element)`.
  - `getOrCreateRecord` (line 302) — reuses `visualElementStore.get(element)` when present; otherwise constructs an `HTMLVisualElement` + `HTMLProjectionNode` and stores it.
- `packages/motion-dom/src/render/store.ts` — `visualElementStore` is a module-level WeakMap-like store; tests must clean up mounted elements (call through `handleExitingElements`' path or unmount manually) to avoid cross-test leakage.
- Jest: `packages/motion-dom/jest.config.json` — ts-jest, `testEnvironment: "jsdom"`, `rootDir: "src"`, test match `**/__tests__/**/*.test.(js|ts)?(x)`.
- Frame-flush helper convention (from CLAUDE.md):

```ts
import { frame } from "../../frameloop"
async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}
```

- Known JSDOM traps (from prior sessions in this repo): `frameData.timestamp` is a module-level singleton that persists across tests; projection's update cycle uses `microtask.read()`, so flushing sometimes needs `await new Promise(r => setTimeout(r, 0))` after layout changes; `getBoundingClientRect` returns zeros unless mocked per element (`element.getBoundingClientRect = () => ({ x, y, width, height, top, right, bottom, left, toJSON: () => "" } as DOMRect)`).
- Exemplar test files:
  - `packages/motion-dom/src/projection/node/__tests__/node.test.ts` — projection lifecycle testing with fake instances and `nextFrame()`/`nextMicrotask()` helpers (see `__tests__/utils.ts` next to it).
  - `packages/motion-dom/src/effects/__tests__/style.test.ts` — DOM-element-based motion-dom tests in JSDOM.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Run the new tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="LayoutAnimationBuilder"` | all pass |
| Full motion-dom suite (leak check) | `cd packages/motion-dom && yarn test` | passes; no new failures elsewhere |
| Typecheck via build | `cd packages/motion-dom && yarn build` | exit 0 (tests are excluded from tsconfig — ts-jest typechecks them at run time) |

## Scope

**In scope** (the only files you should create/modify):
- `packages/motion-dom/src/layout/__tests__/LayoutAnimationBuilder.test.ts` (create)
- `plans/README.md` — status update

**Out of scope** (do NOT touch):
- `LayoutAnimationBuilder.ts` itself — this is characterization: tests describe what the code DOES today. If you find behavior that looks like a bug, write the test asserting **current** behavior with a `// NOTE: current behavior — possibly a bug, see report` comment, and list it in your final report. Do not fix.
- Module-private functions are tested **through the public surface** (`parseAnimateLayoutArgs`, the class, DOM fixtures) — do not export `collectLayoutElements`/`readLayoutAttributes` just to test them.
- Cypress fixtures in `dev/html/public/projection/` — E2E coverage exists; not this plan.
- `visualElementStore`, projection node sources — read-only references.

## Git workflow

- Branch: `advisor/009-layout-builder-tests`
- Single commit, e.g. "Add characterization tests for LayoutAnimationBuilder"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Scaffold the test file with cleanup discipline

Create `packages/motion-dom/src/layout/__tests__/LayoutAnimationBuilder.test.ts`. Imports: `LayoutAnimationBuilder`, `parseAnimateLayoutArgs` from `../LayoutAnimationBuilder`; `frame` from `../../frameloop`; `visualElementStore` from `../../render/store`. Add the `nextFrame()` helper (excerpt above). In `afterEach`, clear `document.body.innerHTML` after unmounting any visual elements you created (iterate elements you tracked, `visualElementStore.get(el)?.unmount()` then `visualElementStore.delete(el)`).

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="LayoutAnimationBuilder"` → 0 tests is fine at this point; file compiles and runs (exit 0 with "no tests" warning is acceptable until Step 2).

### Step 2: Tests for `parseAnimateLayoutArgs` (pure logic, ~6 cases)

1. `(fn)` → `{ scope: document, updateDom: fn, defaultOptions: undefined }`
2. `(fn, opts)` → defaultOptions === opts
3. `(element, fn)` → scope === element
4. `(".selector", fn, opts)` with a matching element in the DOM → scope is that element, defaultOptions === opts
5. `".selector"` matching nothing → scope falls back to `document`
6. Selector matching multiple elements → scope is the **first** match

**Verify**: jest command → these 6 pass.

### Step 3: Tests for element collection + attribute parsing via the builder (DOM-light)

Build small DOM fixtures with `document.body.innerHTML` and drive `new LayoutAnimationBuilder(scope, updateDom)`; observe behavior through which elements end up in `visualElementStore` after the run completes (`await builder.then(noop)` or `await nextFrame()` twice plus a `setTimeout(0)` flush — see the JSDOM traps note; expect to need both).

Cases (~5):
1. Elements with `data-layout` and `data-layout-id` inside scope are collected (appear in `visualElementStore`); plain elements are not.
2. A scope element that itself has `data-layout` is included.
3. `data-layout="position"` propagates: the created record's projection options have `animationType: "position"` (access via `visualElementStore.get(el)!.projection!.options`).
4. `data-layout=""` and `data-layout="true"` both behave as boolean layout (animationType `"both"`).
5. `updateDom` callback is awaited: pass an async `updateDom` that toggles a flag after a microtask; assert collection of "after" elements reflects DOM changes made inside it (e.g. an element given `data-layout` inside `updateDom` ends up in the store).

**Verify**: jest command → all pass. If projection internals throw in JSDOM on zero-size boxes, mock `getBoundingClientRect` per element as shown in Current state.

### Step 4: Tests for exit/shared bookkeeping (~4 cases)

1. An element present before `updateDom` and removed by it gets unmounted: `visualElementStore.get(removedEl)` → `undefined` after completion.
2. A removed element **with** `data-layout-id` leaves its surviving counterpart (same `data-layout-id`) in the store with `projection.resumeFrom` defined (shared-element handoff) — assert what actually holds; if `resumeFrom` is undefined in JSDOM, assert the store/unmount behavior only and note it.
3. `.shared(id, transition)` override: after the run, the surviving element's `projection.options.transition` is the override, not the default options.
4. The builder's promise resolves with a `GroupAnimation` instance (import it from `../../animation/GroupAnimation`), even when no animations were created (zero layout change) — **careful**: `GroupAnimation.getAll` reads `animations[0]`; with an empty group, property access like `.duration` throws. Assert only `instanceof GroupAnimation` and `animations.length`, don't read playback props on an empty group. (This sharp edge is a known TODO at `GroupAnimation.ts:29` — see report note.)

**Verify**: jest command → all pass.

### Step 5: Full-suite leak check

**Verify**: `cd packages/motion-dom && yarn test` → no new failures in *other* test files (module-level frameloop/store state can leak across files; if another suite breaks, your cleanup in Step 1 is insufficient — fix the cleanup, not the other suite).

## Test plan

(This plan *is* the test plan.) Target: ~15 new passing tests across the four groups above, in one new file, modeled structurally on `packages/motion-dom/src/projection/node/__tests__/node.test.ts` (async frame-flush style) and `effects/__tests__` (DOM fixtures in JSDOM).

## Done criteria

- [ ] `packages/motion-dom/src/layout/__tests__/LayoutAnimationBuilder.test.ts` exists with ≥12 passing tests
- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="LayoutAnimationBuilder"` → all pass
- [ ] `cd packages/motion-dom && yarn test` → exit 0, no new failures in other files
- [ ] No source files modified (`git status` shows only the new test file and `plans/README.md`)
- [ ] Final report lists any "current behavior — possibly a bug" notes discovered while characterizing
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The builder's `start()` flow cannot be driven to completion in JSDOM after applying both flush techniques (`nextFrame()` ×2 and `setTimeout(0)`) plus `getBoundingClientRect` mocks — report exactly where it hangs (likely `frame.postRender` never firing or a microtask-read dependency). Do not add fake timers to force it; that masks the real scheduling.
- You need to modify `LayoutAnimationBuilder.ts` (e.g. to export a private function) to make anything testable.
- More than 2 of the Step 3/4 cases are impossible without real layout measurement — report which, and recommend they become Cypress HTML fixtures instead.

## Maintenance notes

- These are characterization tests: when `LayoutAnimationBuilder` behavior intentionally changes (e.g. the in-flight animateLayout v2 work), updating these tests is expected — they exist to make such changes *deliberate*, not to freeze the API.
- The `GroupAnimation` empty-array sharp edge (Step 4.4) is a real latent bug worth a one-line guard in a future PR (`getAll` should handle `animations.length === 0`); deferred out of this test-only plan.
- Reviewer focus: cleanup discipline (`visualElementStore` and `document.body` reset per test) — module-level state leakage here can cause flaky failures in unrelated suites.
