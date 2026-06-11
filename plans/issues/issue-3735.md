# Plan issue-3735: Guard all `window` accesses in motion-dom so animations work in non-browser JS runtimes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/3735 --jq .state` → expect `"open"`. If closed, mark this plan REJECTED (fixed independently) and stop.
> 2. `git log --oneline 42bfbe3ed..HEAD -- packages/motion-dom/src` — if any commit touches the files in Scope, re-verify every excerpt in "Current state" against the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/3735

## Why this matters

`animateTarget` in motion-dom reads `window.MotionHandoffAnimation` with no
`typeof window` guard, so any runtime where `window` is undefined (or lexically
shadowed, as in Lynx's web runtime which wraps bundles in
`(function(){ const window = void 0; ... })()`) throws
`TypeError: Cannot read properties of undefined (reading 'MotionHandoffAnimation')`
the moment an animation starts. A dozen other motion-dom files have the same
unguarded pattern. The reporter (Huxpro, Lynx framework) has a ready-made fix on
a fork — the repo blocks external PRs, so we land it ourselves.

## Current state

Verified against the working tree at `42bfbe3ed`:

- `packages/motion-dom/src/animation/interfaces/visual-element-target.ts:117` — the reported crash:
  ```ts
  if (window.MotionHandoffAnimation) {
  ```
  (second access at line 121: `window.MotionHandoffAnimation(appearId, key, frame)`)
- `packages/motion-dom/src/render/utils/reduced-motion/index.ts:3` — the existing pattern to generalise:
  ```ts
  const isBrowser = typeof window !== "undefined"
  ```
- `packages/motion-dom/src/render/VisualElement.ts:592-595` — **already guarded**
  (`typeof window !== "undefined" && (window as any).MotionCheckAppearSync`).
  The issue's affected-files list includes it; it needs NO change. Do not touch.
- Remaining unguarded sites (all verified by grep at planning time):
  - `packages/motion-dom/src/projection/node/create-projection-node.ts:124,126` (`window.MotionHasOptimisedAnimation!`, `window.MotionCancelOptimisedAnimation!`), `:468,472` (`window.innerWidth`), `:677` (`window.MotionCancelOptimisedAnimation &&`)
  - `packages/motion-dom/src/projection/node/HTMLProjectionNode.ts:14-21` (`documentNode.mount(window)` inside `defaultParent`), `:27` (`window.getComputedStyle` in `checkIsScrollRoot`)
  - `packages/motion-dom/src/render/dom/style-computed.ts:7`
  - `packages/motion-dom/src/render/html/HTMLVisualElement.ts:21`
  - `packages/motion-dom/src/animation/keyframes/DOMKeyframesResolver.ts:154,159,186`
  - `packages/motion-dom/src/animation/keyframes/KeyframesResolver.ts:67` (`window.scrollTo`)
  - `packages/motion-dom/src/animation/utils/css-variables-conversion.ts:44`
  - `packages/motion-dom/src/gestures/hover.ts:69,73,86,91`
  - `packages/motion-dom/src/gestures/press/index.ts:72,73,102,103`
  - `packages/motion-dom/src/resize/handle-window.ts:11,14,21,36`
  - `packages/motion-dom/src/utils/supports/scroll-timeline.ts:28,33` (`window.ScrollTimeline`/`window.ViewTimeline` inside `memoSupports` callbacks)
- Reference implementation: the reporter's fork branch
  `Huxpro/motion:fix/add-typeof-window-guards` (1 commit ahead of main, touches
  12 source files + new `utils/is-browser.ts`). View it:
  `curl -sL "https://github.com/Huxpro/motion/compare/motiondivision:main...Huxpro:fix/add-typeof-window-guards.diff"`.
  Use it as a reference, but prefer the shared `isBrowser` import at every site
  (the fork mixes inline `typeof window !== "undefined"` and `isBrowser`;
  a shared const minifies smaller — CLAUDE.md prioritises output bytes).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build all packages (repo root) | `yarn build` | exit 0 |
| motion-dom unit tests | `npx jest --config packages/motion-dom/jest.config.json` | all pass |
| New test only | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="visual-element-target"` | pass after fix |
| framer-motion client tests | `cd packages/framer-motion && yarn test-client` | matches pre-change baseline |
| framer-motion SSR tests | `cd packages/framer-motion && yarn test-server` | matches pre-change baseline (known pre-existing TextEncoder failures may exist — capture baseline BEFORE editing) |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope** (the only files you may modify/create):
- `packages/motion-dom/src/utils/is-browser.ts` (create)
- `packages/motion-dom/src/render/utils/reduced-motion/index.ts` (use shared const)
- `packages/motion-dom/src/animation/interfaces/visual-element-target.ts`
- `packages/motion-dom/src/animation/interfaces/__tests__/visual-element-target.test.ts` (create)
- `packages/motion-dom/src/projection/node/create-projection-node.ts`
- `packages/motion-dom/src/projection/node/HTMLProjectionNode.ts`
- `packages/motion-dom/src/render/dom/style-computed.ts`
- `packages/motion-dom/src/render/html/HTMLVisualElement.ts`
- `packages/motion-dom/src/animation/keyframes/DOMKeyframesResolver.ts`
- `packages/motion-dom/src/animation/keyframes/KeyframesResolver.ts`
- `packages/motion-dom/src/animation/utils/css-variables-conversion.ts`
- `packages/motion-dom/src/gestures/hover.ts`
- `packages/motion-dom/src/gestures/press/index.ts`
- `packages/motion-dom/src/resize/handle-window.ts`
- `packages/motion-dom/src/utils/supports/scroll-timeline.ts`

**Out of scope**:
- `packages/motion-dom/src/render/VisualElement.ts` — already guarded (line 592).
- `document.` accesses anywhere — the issue is strictly about `window`.
- framer-motion package sources.

## Steps

### Step 1: Capture test baselines

From repo root run `cd packages/framer-motion && yarn test-server` and
`yarn test-client`; save the pass/fail summary. Pre-existing failures are not
yours to fix — you only must not add new ones.

### Step 2: Write the failing test FIRST

Create `packages/motion-dom/src/animation/interfaces/__tests__/visual-element-target.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { animateTarget } from "../visual-element-target"
import type { VisualElement } from "../../../render/VisualElement"

test("animateTarget does not throw when window is undefined (#3735)", () => {
    expect(typeof window).toBe("undefined")

    const start = jest.fn()
    const fakeValue = {
        get: () => 0,
        isAnimating: () => false,
        start,
        animation: undefined,
    }
    const visualElement = {
        getDefaultTransition: () => undefined,
        getValue: (key: string) =>
            key === "willChange" ? undefined : fakeValue,
        addValue: () => {},
        latestValues: {},
        shouldReduceMotion: false,
        animationState: undefined,
    } as unknown as VisualElement

    expect(() => animateTarget(visualElement, { opacity: 1 })).not.toThrow()
    expect(start).toHaveBeenCalledTimes(1)
})
```

The `@jest-environment node` docblock makes `window` genuinely undefined,
reproducing the runtime class the issue describes. The stub is sufficient:
`animateTarget` reaches `window.MotionHandoffAnimation` (line 117) because
`fakeValue.get() === 0 !== 1` skips the same-value early-out, and
`animateMotionValue` is curried so `value.start` (mocked) never executes DOM code.

**Verify (must FAIL)**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="visual-element-target"`
→ fails with `ReferenceError: window is not defined` (node's flavour of the
reported `TypeError`). If it fails for any other reason (e.g. a module-level
import crashes in node env), STOP and report.

### Step 3: Create the shared `isBrowser` util

Create `packages/motion-dom/src/utils/is-browser.ts`:

```ts
export const isBrowser = typeof window !== "undefined"
```

In `render/utils/reduced-motion/index.ts`, delete the local
`const isBrowser = typeof window !== "undefined"` (line 3) and import it from
`../../../utils/is-browser` instead.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="reduced-motion"` → no new failures (or no matching tests; then run full motion-dom suite).

### Step 4: Guard every unguarded site

Import `isBrowser` (relative path per file) and apply. Guard semantics: in a
non-browser runtime each operation becomes a safe no-op; in browsers behaviour
is byte-for-byte identical.

| File | Change |
|---|---|
| `visual-element-target.ts:117` | `if (isBrowser && window.MotionHandoffAnimation) {` |
| `create-projection-node.ts:124` | `if (isBrowser && window.MotionHasOptimisedAnimation!(appearId, "transform")) {` |
| `create-projection-node.ts:468` | `frame.read(() => { if (isBrowser) innerWidth = window.innerWidth })` |
| `create-projection-node.ts:472` | first line of the `attachResizeListener` callback: `if (!isBrowser) return` |
| `create-projection-node.ts:677` | condition becomes `isBrowser && window.MotionCancelOptimisedAnimation && !this.hasCheckedOptimisedAppear` |
| `HTMLProjectionNode.ts:14` | `if (!rootProjectionNode.current && isBrowser) {` (so `defaultParent` returns `undefined` off-browser) |
| `HTMLProjectionNode.ts:27` | `checkIsScrollRoot: (instance) => Boolean(isBrowser && window.getComputedStyle(instance).position === "fixed")` |
| `style-computed.ts:7` | insert `if (!isBrowser) return ""` before the `window.getComputedStyle` call |
| `HTMLVisualElement.ts:21` | `return isBrowser ? window.getComputedStyle(element) : ({} as CSSStyleDeclaration)` |
| `DOMKeyframesResolver.ts:154` | `if (name === "height" && isBrowser) {` |
| `DOMKeyframesResolver.ts` (before line ~159 `this.measuredOrigin = ...`) | insert `if (!isBrowser) return` |
| `DOMKeyframesResolver.ts:186` area (`measureEndState`) | extend early return: `if (!element || !element.current || !isBrowser) return` |
| `KeyframesResolver.ts:67` | `if (resolver.suspendedScrollY !== undefined && isBrowser) {` |
| `css-variables-conversion.ts:44` | insert `if (!isBrowser) return fallback` before the `window.getComputedStyle` line |
| `hover.ts:69-91` | wrap the two `window.removeEventListener` calls and the two `window.addEventListener` calls in `if (isBrowser) { ... }` blocks |
| `press/index.ts:72-73,102-103` | same `if (isBrowser)` wrapping |
| `handle-window.ts` | first line of `createWindowResizeHandler()`: `if (!isBrowser) return` (the cleanup's `removeEventListener` at line 36 only runs when the handler was created, i.e. in-browser — no extra guard needed) |
| `scroll-timeline.ts:28,33` | `() => isBrowser && window.ScrollTimeline !== undefined` and `() => isBrowser && window.ViewTimeline !== undefined` |

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="visual-element-target"` → PASSES.

### Step 5: Full verification

1. `yarn build` (repo root) → exit 0.
2. `npx jest --config packages/motion-dom/jest.config.json` → all pass.
3. `cd packages/framer-motion && yarn test-client && yarn test-server` → no new failures vs. Step 1 baseline.
4. `yarn lint` → exit 0.

### Step 6: PR

Branch e.g. `fix/3735-window-guards`. PR body: link issue #3735, credit the
reporter's fork (`Thanks @Huxpro — based on Huxpro/motion:fix/add-typeof-window-guards`),
note that `VisualElement.ts` was already guarded. `gh pr edit` is broken on
this repo — if body edits are needed use
`gh api -X PATCH repos/motiondivision/motion/pulls/<n> -f body=...`.

## Test plan

- New: `visual-element-target.test.ts` (node env) — the regression gate for the
  reported crash; written first, observed failing (Step 2), passing after Step 4.
- Existing motion-dom + framer-motion client/SSR suites guard against behaviour
  change in browser-like (jsdom) environments, where `isBrowser` is true and all
  guards are transparent.

## Done criteria

- [ ] New node-env test exists and passes; it failed before the fix
- [ ] `grep -rn "window\." packages/motion-dom/src --include="*.ts" | grep -v __tests__ | grep -v "typeof window" | grep -v "isBrowser"` shows no unguarded *executable* `window.` access outside guarded blocks (manually confirm remaining hits are inside `if (isBrowser)` scopes, type declarations, or comments)
- [ ] `yarn build` and `yarn lint` exit 0; motion-dom suite green; framer-motion client/SSR suites match baseline
- [ ] No files outside the Scope list modified (`git status`)
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Step 2's test fails with anything other than `window is not defined` (means the module graph itself isn't node-safe and the fix is bigger than planned).
- TypeScript rejects `defaultParent` returning `undefined` in `HTMLProjectionNode.ts` — check `ProjectionNodeConfig` type before improvising a cast.
- Any framer-motion test that passed in the Step 1 baseline fails after Step 4.
- The fork diff and live code disagree on any line you're editing.

## Maintenance notes

- Future code touching `window` in motion-dom should import `isBrowser` — a
  lint rule (`no-restricted-globals`) would prevent regressions; deferred.
- Reviewer: scrutinise `DOMKeyframesResolver` early-returns — they change
  measurement behaviour only when `isBrowser` is false (measurement is
  meaningless there anyway).
