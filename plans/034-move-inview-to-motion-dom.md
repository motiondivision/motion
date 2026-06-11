# Plan 034: Move `inView()` from framer-motion to motion-dom

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/render/dom/viewport packages/framer-motion/src/utils/use-in-view.ts packages/framer-motion/src/dom.ts packages/framer-motion/src/motion/features/viewport/index.ts packages/motion-dom/src/index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Note: plan 026 also edits
> `features/viewport/index.ts` — if its documented change to `onIntersectionUpdate`
> has landed, that is expected drift; reconcile and continue.)

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (touches the public export chain of three published packages; mitigated by verbatim code move + star re-exports + new unit tests)
- **Depends on**: none (026 touches the same feature file — trivial merge either order; see drift note above)
- **Category**: tech-debt
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`inView()` is framework-agnostic DOM code (zero React imports) that lives in the React package. Every other vanilla utility — `hover`, `press`, `resize`, `scroll`, view transitions — has already been migrated to motion-dom (cf. commits `ea266671d` "Move animateVisualElement and dependencies to motion-dom", `9920cfc6a` "Refactor MotionProps into vanilla package"); `inView` is the last straggler. Costs today: standalone `motion-dom` consumers have no `inView`, and the repo carries two parallel IntersectionObserver wrappers with a duplicated threshold table. This plan moves the function verbatim, keeps every existing public import path working via the established re-export chain, dedupes the threshold table, and gives the function its first unit tests. It does **not** merge the two observer implementations (see Out of scope).

## Current state

- `packages/framer-motion/src/render/dom/viewport/index.ts` — the entire standalone `inView` implementation (68 lines): `inView()`, `InViewOptions`, `ViewChangeHandler`, private `MarginType`/`MarginValue` types, and a private threshold table. Its only externally-sourced import is already from motion-dom:

```ts
// packages/framer-motion/src/render/dom/viewport/index.ts:1
import { ElementOrSelector, resolveElements } from "motion-dom"
```

```ts
// packages/framer-motion/src/render/dom/viewport/index.ts:18-21
const thresholds = {
    some: 0,
    all: 1,
}
```

- Consumers of that file — the complete list (verified by grep at planning time):
  - `packages/framer-motion/src/dom.ts:8` — `export { inView } from "./render/dom/viewport"` (public API). Note `dom.ts:1` is already `export * from "motion-dom"`, and `framer-motion/src/index.ts:12` is `export * from "./dom"` — so once motion-dom exports `inView`, the star chain re-publishes it on `framer-motion`, `framer-motion/dom`, `motion`, and `motion/react` with no further work.
  - `packages/framer-motion/src/utils/use-in-view.ts:4` — `import { inView, InViewOptions } from "../render/dom/viewport"`.
- The duplicate threshold table in the React feature:

```ts
// packages/framer-motion/src/motion/features/viewport/index.ts:5-8
const thresholdNames = {
    some: 0,
    all: 1,
}
```

- motion-dom's index follows one-`export *`-per-module, grouped/ordered by path — the resize precedent:

```ts
// packages/motion-dom/src/index.ts:87-99 (abridged)
export * from "./gestures/utils/is-primary-pointer"

export * from "./node/types"
...
export * from "./resize"
```

- Inside motion-dom, `resolveElements` lives at `packages/motion-dom/src/utils/resolve-elements.ts` — the moved file imports it relatively (see `packages/motion-dom/src/gestures/hover.ts:1` for the convention).
- Name-collision check (done at planning time): nothing in motion-dom currently exports `inView`, `InViewOptions`, or `ViewChangeHandler` (the `src/view/` directory is view *transitions*; no overlap).
- Test infrastructure: framer-motion has an IntersectionObserver mock at `packages/framer-motion/src/utils/__tests__/mock-intersection-observer.ts` (installs `window.IntersectionObserver`, exposes `getActiveObserver()` returning the last observed callback). motion-dom tests run via ts-jest against **source** (`packages/motion-dom/jest.config.json`, jsdom) — no build needed for them. framer-motion tests resolve `motion-dom` to its **built dist** — `yarn build` from repo root is required after motion-dom edits and before framer-motion tests.
- Both packages' builds end with a `check-bundle.js` size gate; this move shifts ~0.3 kB from framer-motion to motion-dom and the gated entry bundles (`size-rollup-*`) don't gain anything new, so the gates should be unaffected — if one trips, that's a STOP condition, not a threshold to edit.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build all (repo root; REQUIRED after motion-dom edits, runs both size gates) | `yarn build` | exit 0 |
| New motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="in-view"` (repo root) | all pass |
| Hook + feature tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="(use-in-view|viewport)"` | all pass |
| SSR safety | `cd packages/framer-motion && yarn test-server` | no NEW failures (pre-existing `TextEncoder is not defined` failures are known — compare against a pre-change run) |
| Lint | `yarn lint` (repo root) | exit 0 |

## Scope

**In scope** (the only files you should modify/create/delete):
- `packages/motion-dom/src/in-view/index.ts` (create)
- `packages/motion-dom/src/in-view/__tests__/index.test.ts` (create)
- `packages/motion-dom/src/in-view/__tests__/mock-intersection-observer.ts` (create — copy of the framer-motion mock)
- `packages/motion-dom/src/index.ts` (one export line)
- `packages/framer-motion/src/render/dom/viewport/index.ts` (delete, and its directory if then empty)
- `packages/framer-motion/src/dom.ts` (remove one line)
- `packages/framer-motion/src/utils/use-in-view.ts` (one import line)
- `packages/framer-motion/src/motion/features/viewport/index.ts` (threshold dedupe only)

**Out of scope** (do NOT touch, even though they look related):
- **Merging the two IntersectionObserver implementations.** `features/viewport/observers.ts` shares observers per root+options and fires per-element callbacks; standalone `inView` creates one observer per call with unobserve-on-no-return semantics. Unifying them changes observable behavior (observer instance lifetimes, initial-fire timing) — that's a separate, behavior-risk plan if ever wanted. Keep `observers.ts` exactly as is.
- `packages/framer-motion/src/utils/use-in-view.ts` beyond the import line — the hook's logic is correct.
- `packages/framer-motion/src/index.ts` and `packages/motion/src/*` — the star chains make changes there unnecessary; touching them risks the public surface.
- Any `bundlesize` threshold in either `package.json`.

## Git workflow

- Branch: `refactor/move-inview-to-motion-dom`
- Commit style (match `git log`, cf. `ea266671d`): `refactor: move inView to motion-dom`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the motion-dom module (verbatim move)

Create `packages/motion-dom/src/in-view/index.ts` with the full contents of `packages/framer-motion/src/render/dom/viewport/index.ts`, with exactly two changes:

1. The import becomes relative:
   ```ts
   import {
       ElementOrSelector,
       resolveElements,
   } from "../utils/resolve-elements"
   ```
2. The private threshold table becomes a named export (used by Step 5):
   ```ts
   export const inViewThresholds = {
       some: 0,
       all: 1,
   }
   ```
   …and the one usage inside `inView()` (`thresholds[amount]`) becomes `inViewThresholds[amount]`.

Everything else — `ViewChangeHandler`, `MarginType`/`MarginValue` (still unexported), `InViewOptions`, the `inView` body — moves character-for-character. Do not "improve" anything in transit.

Then add to `packages/motion-dom/src/index.ts`, between the gestures block and `export * from "./node/types"` (path-alphabetical position):

```ts
export * from "./in-view"
```

**Verify**: `yarn build` → exit 0 (motion-dom compiles and its size gate passes; framer-motion still builds — old file still present and unreferenced changes pending).

### Step 2: Unit-test the moved function in motion-dom

Copy `packages/framer-motion/src/utils/__tests__/mock-intersection-observer.ts` verbatim into `packages/motion-dom/src/in-view/__tests__/mock-intersection-observer.ts` (cross-package test imports aren't allowed; the file is 32 lines). Create `packages/motion-dom/src/in-view/__tests__/index.test.ts` importing `inView` from `"../index"` and the mock from `"./mock-intersection-observer"` (the mock installs on import). Cover:

1. **Enter fires onStart**: `inView(el, onStart)`; trigger `getActiveObserver()?.([{ target: el, isIntersecting: true }])` → `onStart` called once with `(el, entry)`.
2. **Returned callback fires on leave**: `onStart` returns `onEnd`; trigger leave → `onEnd` called once; trigger enter again → `onStart` called twice (re-arms).
3. **No returned callback ⇒ once per element**: `onStart` returns `undefined`; after enter, the mock's active observer is cleared by `unobserve` (assert `getActiveObserver()` is `undefined`, matching the mock's `unobserve` behavior) and a further enter triggers nothing.
4. **No double-fire on repeated same-state entries**: two consecutive `isIntersecting: true` entries → `onStart` once (the `Boolean(onEnd)` guard).
5. **Stop function disconnects**: call the returned function; `getActiveObserver()` is `undefined`.
6. **Selector input**: `inView(".target", onStart)` with two matching divs appended to `document.body` → both observed (extend the mock minimally with an observed-elements `Set` if needed to assert this — keep the accessor pattern).

Model file structure on `packages/framer-motion/src/utils/__tests__/use-in-view.test.tsx`'s use of the mock (the `enter`/`leave` helper pattern at its top).

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="in-view"` → ≥6 tests pass.

### Step 3: Repoint framer-motion and delete the old file

1. `packages/framer-motion/src/utils/use-in-view.ts:4` → `import { inView, InViewOptions } from "motion-dom"`.
2. `packages/framer-motion/src/dom.ts` → delete line 8 (`export { inView } from "./render/dom/viewport"`); the `export * from "motion-dom"` on line 1 now supplies it.
3. Delete `packages/framer-motion/src/render/dom/viewport/index.ts`; if the `viewport/` directory is then empty, delete the directory.

**Verify**: `grep -rn "render/dom/viewport" packages/framer-motion/src packages/motion/src` → no matches. Then `yarn build` → exit 0 (this also proves declaration emit for `UseInViewOptions extends Omit<InViewOptions, ...>` resolves against the motion-dom types).

### Step 4: Confirm the public surface is intact

**Verify** (from repo root, after Step 3's build):
- `node -e "const m = require('./packages/framer-motion/dist/cjs/index.js'); if (typeof m.inView !== 'function') throw new Error('inView missing from framer-motion')"` → exits 0. (If the CJS dist filename differs, check `packages/framer-motion/package.json` `main` and adjust the path — do not skip the check.)
- `node -e "const m = require('./packages/motion-dom/dist/cjs/index.js'); if (typeof m.inView !== 'function') throw new Error('inView missing from motion-dom')"` → exits 0 (same caveat via motion-dom's `main`).
- `grep -n "inView" packages/framer-motion/dist/index.d.ts` (or the emitted types entry per `types` in package.json) → `inView` present.

### Step 5: Dedupe the threshold table in the React feature

In `packages/framer-motion/src/motion/features/viewport/index.ts`: delete the local `thresholdNames` const (lines 5–8), import `inViewThresholds` from `"motion-dom"` (extend the existing `import { Feature } from "motion-dom"` line), and change the one usage (`thresholdNames[amount]` → `inViewThresholds[amount]`).

**Verify**: `yarn build` → exit 0. `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="(use-in-view|viewport)"` → all pass.

### Step 6: Full gates

**Verify**: `yarn lint` → exit 0. `cd packages/framer-motion && yarn test-server` → no new failures vs. a pre-change baseline run (record both counts in your report). The Cypress specs `while-in-view.ts` / `while-in-view-remount.ts` cover the feature path in CI; the feature's only change is the threshold import, so running them locally is optional — if you do, follow the React 18 + React 19 Vite procedure in `CLAUDE.md`.

## Test plan

Step 2 is the new coverage (the standalone `inView` had zero tests before this plan — these double as the move's behavior lock). Existing `use-in-view.test.tsx` exercises the moved function through the hook against **built** motion-dom — it passing post-build is the integration gate. No new Cypress spec: observer behavior is fully mockable in jsdom and the browser path is already covered by the two `while-in-view` specs.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `yarn build` exits 0 (both packages' size gates included)
- [ ] motion-dom `in-view` tests: ≥6 tests exist and pass
- [ ] framer-motion `(use-in-view|viewport)` tests pass
- [ ] `grep -rn "render/dom/viewport" packages/` (excluding `dist/`, `node_modules/`, `plans/`) → no matches
- [ ] Step 4's two `node -e` export checks exit 0
- [ ] `grep -c "some: 0" packages/framer-motion/src/motion/features/viewport/index.ts` → 0 (table deduped)
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated (and the "Move `inView()`" deferred bullet already points here)

## STOP conditions

Stop and report back (do not improvise) if:

- Any consumer of `render/dom/viewport` exists beyond the two listed (the grep in Step 3 finds more) — the consumer map has drifted.
- `yarn build` fails in declaration emit after Step 3 (e.g. TS4023-style "cannot be named" on `UseInViewOptions`) — report the exact error; do not restructure types to silence it.
- Either package's bundle-size gate (`check-bundle.js`) fails — do not edit thresholds; report the delta.
- A name collision surfaces on `inView`/`InViewOptions`/`ViewChangeHandler`/`inViewThresholds` in motion-dom's `export *` chain.
- You find yourself wanting to modify `observers.ts` or change `inView`'s observable behavior — both are explicitly out of scope.

## Maintenance notes

- **New public type names**: `InViewOptions`, `ViewChangeHandler`, and `inViewThresholds` become exported from `motion-dom` and therefore from `framer-motion`/`motion` via the star chains (previously only the `inView` function was public). This is additive; the reviewer should just be aware the d.ts surface grows by three names.
- Anyone deep-importing `framer-motion/dist/es/render/dom/viewport/...` (unsupported but possible) breaks; supported specifiers (`framer-motion`, `framer-motion/dom`, `motion`, `motion/react`, `motion-dom`) are unchanged.
- The two-implementation split (standalone `inView` vs. `features/viewport/observers.ts`) is now at least co-located by name; a future consolidation plan would start from `observers.ts`'s shared-observer model and must treat `inView`'s per-call observer + unobserve-on-no-return semantics as public behavior.
- Plan 026 (stale `viewport.once`) edits `features/viewport/index.ts` in the `onIntersectionUpdate` body; this plan edits the top-of-file const + import. Whichever lands second: trivial rebase, re-run the viewport jest pattern.
- The motion-dom copy of the IntersectionObserver mock intentionally duplicates the framer-motion one (no cross-package test imports). If the mock grows behavior, update both or extract to a shared dev package — don't let them drift silently.
