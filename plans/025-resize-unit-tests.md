# Plan 025: Add unit tests for resize() and wire up the dead ResizeObserver mock

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/resize`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (test-only; zero source changes)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`resize()` is public API on the `motion` package (exported via `packages/motion-dom/src/index.ts:99` → `framer-motion/dom` → `motion`) and has **zero tests**. The module contains exactly the kind of shared-singleton bookkeeping that regresses silently: one module-level `ResizeObserver` shared across all subscriptions, a `WeakMap` of handler `Set`s deciding when to `unobserve`, and a module-level window-resize listener that must tear down when the last subscriber leaves and re-establish on re-subscription. A mock helper already exists at `packages/motion-dom/src/resize/__tests__/mock-resize-observer.ts` but **nothing imports it** — it's dead code that suggests tests were intended and never written. This plan writes the characterization suite so future refactors (and the open drag-QoL plan 021, which touches resize throttling) have a regression gate.

## Current state

- `packages/motion-dom/src/resize/index.ts` — public `resize()`: dispatches on argument type to `resizeWindow(fn)` or `resizeElement(target, fn)`.
- `packages/motion-dom/src/resize/handle-element.ts` — the element path. Key facts to characterize:

```ts
// handle-element.ts:5-7
const resizeHandlers = new WeakMap<Element, Set<ResizeHandler<Element>>>()
let observer: ResizeObserver | undefined
```

```ts
// handle-element.ts:30-41 — entries report border-box size when available,
// falling back to getBBox() for SVG, else offsetWidth/offsetHeight
function notifyTarget({ target, borderBoxSize }: ResizeObserverEntry) {
    resizeHandlers.get(target)?.forEach((handler) => {
        handler(target, {
            get width() { return getWidth(target, borderBoxSize) },
            get height() { return getHeight(target, borderBoxSize) },
        })
    })
}
```

```ts
// handle-element.ts:73-83 — cleanup unobserves only when the last handler leaves
return () => {
    elements.forEach((element) => {
        const elementHandlers = resizeHandlers.get(element)
        elementHandlers?.delete(handler)
        if (!elementHandlers?.size) {
            observer?.unobserve(element)
        }
    })
}
```

Also note `createResizeObserver()` (lines 47–51) no-ops when `typeof ResizeObserver === "undefined"`, and all observer calls are optional-chained — SSR-safe by design.

- `packages/motion-dom/src/resize/handle-window.ts` — the window path: module-level `Set` of callbacks, lazily-attached `"resize"` listener, removed and reset to `undefined` when the last callback unsubscribes (lines 29–39).
- `packages/motion-dom/src/resize/__tests__/mock-resize-observer.ts` — the dead mock: installs `window.ResizeObserver`, tracks observed elements in a `Set`, stores the constructor callback, and captures the instance in a module-level `activeObserver`. **Read the whole file first** — it may lack an exported trigger/getter; extending it (e.g. exporting a `getActiveObserver()` or `notify(entries)` helper) is in scope. Model any such accessor on `packages/framer-motion/src/utils/__tests__/mock-intersection-observer.ts`'s `getActiveObserver()` pattern.
- Jest setup: motion-dom tests run via ts-jest directly against source — **no build step needed**. Config: `packages/motion-dom/jest.config.json` (jsdom environment). Existing exemplar test for structure/style: `packages/motion-dom/src/gestures/utils/__tests__/is-primary-pointer.test.ts`.
- jsdom reality check: jsdom has **no** `ResizeObserver` (hence the mock) and `offsetWidth`/`offsetHeight` are always 0; `getBBox` doesn't exist on jsdom SVG elements. Size assertions must come from mock-provided `borderBoxSize` entries (`[{ inlineSize: N, blockSize: M }]`) or from stubbing the element properties (`Object.defineProperty(el, "offsetWidth", { value: 100 })`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Run resize tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="resize"` (repo root) | all pass |
| Full motion-dom unit tests | `npx jest --config packages/motion-dom/jest.config.json` | no new failures |
| Lint | `yarn lint` (repo root) | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `packages/motion-dom/src/resize/__tests__/resize.test.ts` (create)
- `packages/motion-dom/src/resize/__tests__/mock-resize-observer.ts` (extend only — e.g. add an exported accessor/trigger; keep existing shape)

**Out of scope** (do NOT touch):
- All source files under `packages/motion-dom/src/resize/` (`index.ts`, `handle-element.ts`, `handle-window.ts`, `types.ts`) — this plan is characterization only. If a test reveals a genuine bug, STOP and report; do not fix source in this plan.
- `packages/motion-dom/src/render/dom/scroll/**` — scroll does not use `resize()`; ignore any apparent similarity.

## Git workflow

- Branch: `test/resize-unit-tests`
- Commit style (match `git log`): `test(resize): add unit tests for element and window resize handling`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Wire up the mock

Read `mock-resize-observer.ts` fully. Ensure the test file can (a) install the mock before importing the module under test, and (b) trigger entries. Important module-state caveat: `handle-element.ts` captures `observer` in module scope on first use — `jest.resetModules()` + re-`require` in `beforeEach` is the reliable way to get a fresh observer/mock pairing per test (the window path's `windowCallbacks`/`windowResizeHandler` are also module-level). Structure the suite accordingly from the start.

**Verify**: a trivial first test (`resize(el, handler)` then mock-trigger → handler called) passes via the resize test pattern command.

### Step 2: Element-path tests

In `resize.test.ts`, cover:

1. **border-box sizes reported**: subscribe, trigger an entry with `borderBoxSize: [{ inlineSize: 100, blockSize: 50 }]` → handler receives `info.width === 100`, `info.height === 50`.
2. **HTML fallback**: trigger an entry with no `borderBoxSize`, having stubbed `offsetWidth`/`offsetHeight` via `Object.defineProperty` → handler receives the stubbed values.
3. **Multiple handlers, one element**: two `resize()` calls, same element → one `observe` per call is fine, but both handlers fire per entry; removing one (call its cleanup) leaves the other firing and does **not** `unobserve`.
4. **Last-handler cleanup unobserves**: after the second cleanup, the mock's observed-element set no longer contains the element.
5. **Characterize the shared-handler edge**: the same function reference subscribed twice via two `resize()` calls occupies one `Set` slot — the first cleanup silences both subscriptions. Name the test so it reads as documented behavior, e.g. `"KNOWN BEHAVIOR: duplicate handler reference is deduped across subscriptions"`.
6. **Selector input**: `resize(".box", handler)` resolves elements via `document.querySelectorAll` (append two matching divs to `document.body`); both get observed.
7. **No ResizeObserver**: temporarily delete the mock from `window` (fresh module registry), call `resize(el, handler)` → no throw, cleanup function still callable.

**Verify**: resize test pattern → all pass.

### Step 3: Window-path tests

1. **Window callback fires**: `resize(handler)`, dispatch `window.dispatchEvent(new Event("resize"))` → handler called with `info.width === window.innerWidth`, `info.height === window.innerHeight`.
2. **Teardown on last unsubscribe**: two window subscriptions; remove one → dispatch still fires the survivor; remove the last → dispatch fires nothing (spy on the removed handler), and a **new** subscription afterwards works again (re-attachment after the `windowResizeHandler = undefined` reset).

**Verify**: resize test pattern → all pass. Then the full motion-dom suite → no new failures (known pre-existing failures in this repo's suites — e.g. SSR `TextEncoder` — are ignorable if they appear; they are unrelated to resize).

### Step 4: Lint

**Verify**: `yarn lint` → exit 0.

## Test plan

This plan *is* the test plan — Steps 2–3 enumerate the cases. SVG `getBBox` fallback is deliberately left untested: jsdom SVG elements lack `getBBox`, and `isSVGElement(target) && "getBBox" in target` guards it; faking both adds mock complexity for a two-line code path. Note this omission in a comment at the top of the test file.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `packages/motion-dom/src/resize/__tests__/resize.test.ts` exists with ≥9 tests, all passing via the resize test pattern command
- [ ] `grep -rn "mock-resize-observer" packages/motion-dom/src --include="*.ts"` shows at least one import outside the mock file itself
- [ ] Full motion-dom jest run: no new failures vs. pre-change
- [ ] `git status` shows no modified source files under `packages/motion-dom/src/resize/` other than the two in-scope test files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any test reveals behavior contradicting the "Current state" excerpts (e.g. cleanup unobserves while handlers remain) — that's a source bug; report it as a finding instead of fixing it here.
- The module-level singleton state cannot be isolated between tests even with `jest.resetModules()` — report rather than writing order-dependent tests.
- You are tempted to modify `handle-element.ts`/`handle-window.ts` to make them more testable — that's out of scope; report what blocked you.

## Maintenance notes

- Plan 021 (drag QoL) proposes resize throttling; this suite is the regression gate for it — whoever executes 021 should run the resize test pattern after their change.
- Two latent design quirks are *documented by* (not fixed in) this suite: the duplicate-handler dedupe (Step 2.5) and the fact that the observer observes the default content-box while reporting border-box sizes (a border/padding-only change won't fire the callback). If either becomes a user-reported bug, the test names to update are here.
- The mock's `activeObserver` is module-level; keep any added accessor read-only (mirror `mock-intersection-observer.ts`).
