# Plan 002: Finish `animateView()` non-root target resolution (View Transitions)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/view/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `42bfbe3ed`, 2026-06-10

## Why this matters

`animateView()` (View Transitions API integration) is public — it is exported from `motion-dom/src/view` and reaches the `motion` package through the `export *` chain — but its implementation carries three explicit TODOs that all describe the same gap: targets other than `"root"` are never resolved to elements, and elements are never auto-assigned `view-transition-name`s. Today a user who writes `animateView(update).get(".card", {...})`-style non-root targets must manually set `view-transition-name` on every element in CSS for anything to happen, and selector/Element targets (the declared `ViewTransitionTargetDefinition = string | Element` type) are silently treated as pre-named layers. There is also **zero E2E coverage**: `tests/` has `animate/`, `animate-layout/`, `effects/`, `gestures/`, `scroll/` — no `view/`. Finishing this makes the already-shipped API actually deliver its typed surface.

## Current state

Relevant files (all in `packages/motion-dom/src/view/`):

- `index.ts` — `ViewTransitionBuilder` class and `animateView()` factory (lines 103–108). Targets are stored in `targets = new Map<ViewTransitionTargetDefinition, ViewTransitionTarget>()` (line 15).
- `types.ts` — the target types:

  ```ts
  // packages/motion-dom/src/view/types.ts:20
  export type ViewTransitionTargetDefinition = string | Element
  ```

- `start.ts` — the engine. The three TODOs:

  ```ts
  // packages/motion-dom/src/view/start.ts:31
  // TODO: Go over existing targets and ensure they all have ids

  // packages/motion-dom/src/view/start.ts:60 (inside document.startViewTransition callback)
  // TODO: Go over new targets and ensure they all have ids

  // packages/motion-dom/src/view/start.ts:77-78 (inside targets.forEach)
  // TODO: If target is not "root", resolve elements
  // and iterate over each
  ```

  Surrounding behavior you must preserve: when no `"root"` target exists, `:root` gets `view-transition-name: none` (start.ts:37–41); a CSS rule forces `animation-timing-function: linear !important` on all view-transition pseudo-elements so easing can be applied via `updateTiming` (start.ts:50–53); per-target animations are built by iterating `targets` and matching generated `getViewAnimations()` entries.

- `utils/get-layer-info.ts`, `utils/get-view-animations.ts` — how generated WAAPI view-transition animations are discovered and matched to layer names. Read both before designing (Step 1).
- `packages/motion-dom/src/utils/resolve-elements.ts` — existing `resolveElements(ElementOrSelector)` helper; use it for selector resolution (it is what `LayoutAnimationBuilder` uses).

Export chain: `view/index.ts` → `motion-dom/src/index.ts:154` → `framer-motion/src/dom.ts:1` (`export * from "motion-dom"`) → `motion` package. No export wiring needed.

Repo conventions: named exports, `interface` for type definitions, optional chaining over `if`, small output size is a priority.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Build | `yarn build` | exit 0 |
| motion-dom unit tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="view"` | all pass |
| Playwright (real Chromium — required, JSDOM/Electron lack `startViewTransition`) | `npx playwright test tests/view/` | all pass |
| Lint | `yarn lint` | exit 0 |

Playwright config: `playwright.config.ts` — `testDir: "./tests"`, `baseURL: http://localhost:8000/playwright/`, auto-started `webServer`. Test pages live in `dev/html/public/playwright/` and specs in `tests/<area>/<name>.spec.ts`. After editing motion-dom source, rebuild before running E2E (fixtures consume built output).

## Scope

**In scope**:
- `packages/motion-dom/src/view/start.ts`
- `packages/motion-dom/src/view/index.ts` (only if target bookkeeping needs a normalized key)
- `packages/motion-dom/src/view/utils/` (new helper file allowed, e.g. `assign-names.ts`)
- `packages/motion-dom/src/view/__tests__/` (create unit tests)
- `dev/html/public/playwright/view-*.html` (create fixture pages)
- `tests/view/` (create Playwright specs)

**Out of scope**:
- Any React-layer integration (AnimatePresence + view transitions) — separate, larger design question; do not start it.
- `getViewAnimations` / browser-global typings in `types.global.ts` unless a type error forces a minimal addition.
- The CSS `linear !important` mechanism — required by the easing strategy; do not "simplify" it.

## Git workflow

- Branch: `advisor/002-view-target-resolution`
- Commit per step; short imperative subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Investigate and write the design note (no code yet)

Read `start.ts` in full plus `utils/get-layer-info.ts` and `utils/get-view-animations.ts`. Answer in a short note committed as `plans/002-notes.md`:

1. How does a target key in `builder.targets` (a `string | Element`) currently end up matched against a generated animation's layer name? (Trace the `targets.forEach` body in start.ts:75 onward.)
2. What should the layer name be for (a) a selector target matching one element, (b) a selector matching N elements, (c) an `Element` target? Proposal to validate: selectors that look like pre-named layers (plain identifiers, e.g. `"card"`) keep current behavior; CSS selectors / Elements get resolved via `resolveElements` and each element receives a generated `view-transition-name` (e.g. `«motion-view-N»` counter) set as an inline style before capture and removed in `transition.finished.finally`, alongside the existing `css.remove()` cleanup.
3. Confirm the same name must be present in BOTH captures: existing elements named before `document.startViewTransition` (TODO at line 31), and elements created by `update()` named inside the transition callback after `await update()` (TODO at line 60). Decide how re-resolution after `update()` works (re-run the selector).

**Verify**: `plans/002-notes.md` exists and answers all three questions with `file:line` citations.

### Step 2: Implement name assignment and resolution

Implement per your validated design. Required behaviors:

- `"root"` keeps its special-casing untouched.
- String targets that are plain layer identifiers must keep working exactly as today (backwards compatibility — this is the currently-documented usage).
- Selector/Element targets: resolve with `resolveElements`, assign generated names (skip elements that already have a `view-transition-name` inline or computed), build one animation set per resolved element by iterating, and clean up generated names in `finished.finally`.
- Multiple elements under one target definition each get their own layer/animations.

**Verify**: `yarn build` → exit 0.

### Step 3: Unit tests

Create `packages/motion-dom/src/view/__tests__/resolve-targets.test.ts` for the pure parts (name generation, skip-if-already-named, cleanup bookkeeping). JSDOM has no `startViewTransition`; note start.ts:24–29 already has a fallback branch (calls `update()`, resolves an empty `GroupAnimation`) — unit-test that fallback still works with element targets.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="view"` → all pass.

### Step 4: Playwright E2E

Create `dev/html/public/playwright/view-target-element.html` and `view-target-selector-multiple.html` fixtures plus `tests/view/view-targets.spec.ts`:

- Case 1: `animateView` with an `Element` target animating `opacity` on its `new` layer → assert the element visibly transitions (sample computed style mid-transition or assert via `document.getAnimations()` that a `::view-transition-*` animation for the generated name exists).
- Case 2: selector matching 3 elements → 3 distinct named layers animate.
- Case 3 (regression): plain-identifier target with manually CSS-assigned `view-transition-name` behaves as before.

Model spec structure after an existing file in `tests/animate-layout/animate-layout.spec.ts`. Chromium only — skip in browsers without `document.startViewTransition` (guard with a feature check + `test.skip`).

**Verify**: `npx playwright test tests/view/` → all pass.

### Step 5: Remove the TODOs and full gates

Delete the three TODO comments (now implemented). Run full gates.

**Verify**: `grep -n "TODO" packages/motion-dom/src/view/start.ts` → no matches; `npx jest --config packages/motion-dom/jest.config.json` → no new failures; `yarn lint` → exit 0.

## Test plan

- Unit: `view/__tests__/resolve-targets.test.ts` — name generation, already-named skip, no-`startViewTransition` fallback.
- E2E: `tests/view/view-targets.spec.ts` — the three cases in Step 4 (element target, multi-element selector, pre-named regression).
- Pattern exemplar: `tests/animate-layout/animate-layout.spec.ts`.

## Done criteria

- [ ] `yarn build` exits 0
- [ ] `grep -n "TODO" packages/motion-dom/src/view/start.ts` → no matches
- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="view"` → all pass
- [ ] `npx playwright test tests/view/` → all pass, including the pre-named-layer regression case
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 reveals that string targets are NOT currently used as raw layer names (i.e. the matching mechanism differs from this plan's assumption) — report what you found with citations and wait for direction.
- Generated-name assignment breaks the snapshot capture (old/new layers missing) and you cannot fix it within two attempts — View Transition capture timing is subtle.
- The fix appears to require changes to `getViewAnimations`'s matching contract beyond reading layer names.
- `document.startViewTransition` is unavailable in the repo's pinned Playwright Chromium (check with a trivial probe first) — report; do not swap test frameworks.

## Maintenance notes

- A future React integration (AnimatePresence driving `animateView`) will build on exactly this resolution layer; keep the element→name assignment in its own helper so React can reuse it.
- Reviewer should scrutinize cleanup: generated `view-transition-name`s must not leak after interrupted transitions (`interrupt: "immediate"` path in `view/queue.ts` / `ViewTransitionOptions`).
- Deferred: documenting `animateView` on motion.dev (docs live outside this repo).
