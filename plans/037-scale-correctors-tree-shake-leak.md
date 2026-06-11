# Plan 037: Stop layout-animation scale correctors leaking into the minimal `m` bundle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/render/utils/is-forced-motion-value.ts packages/motion-dom/src/projection/styles/scale-correction.ts packages/motion-dom/src/projection/node/create-projection-node.ts packages/motion-dom/src/index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: MED-LOW
- **Depends on**: none (soft: 035 — if landed, final step ratchets the `m` budget; soft collision: 008 edits `scale-box-shadow.ts` *internals* — disjoint from this plan's files, whichever lands second re-runs the scale-correction jest suite)
- **Category**: perf (bundle size)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`m` is the size-first motion component: features (animation, drag, layout)
are meant to arrive via `LazyMotion`/feature packages, not in the core. But
the core render path's `isForcedMotionValue` statically imports
`scaleCorrectors` from `projection/styles/scale-correction.ts`, and that
module **eagerly constructs the default borderRadius/boxShadow correctors**,
pulling `correctBorderRadius` and `correctBoxShadow` (box-shadow parsing +
projection math) into every `m.div`. Source-map attribution of
`dist/size-rollup-m.js` at `42bfbe3ed`: `scale-box-shadow` 312 B +
`scale-correction` 245 B + `scale-border-radius` 222 B ≈ **780 B min
(~0.3 kB gz) of dead code in the minimal bundle** — these correctors are
only ever *read* by the projection node, which is not in the `m` graph. The
registration mechanism (`addScaleCorrector`) already exists and is public
API; the defaults just need to move behind it. The `m` bundle is currently
over its 6 kB budget (6.31); this plan likely brings it back under.

## Current state

- `packages/motion-dom/src/render/utils/is-forced-motion-value.ts` (entire file):

```ts
import { transformProps } from "./keys-transform"
import type { MotionNodeOptions } from "../../node/types"
import {
    scaleCorrectors,
    addScaleCorrector,
} from "../../projection/styles/scale-correction"

export { scaleCorrectors, addScaleCorrector }

export function isForcedMotionValue(
    key: string,
    { layout, layoutId }: MotionNodeOptions
) {
    return (
        transformProps.has(key) ||
        key.startsWith("origin") ||
        ((layout || layoutId !== undefined) &&
            (!!scaleCorrectors[key] || key === "opacity"))
    )
}
```

- `packages/motion-dom/src/projection/styles/scale-correction.ts` (entire file):

```ts
import { isCSSVariableName } from "../../animation/utils/is-css-variable"
import { correctBorderRadius } from "./scale-border-radius"
import { correctBoxShadow } from "./scale-box-shadow"
import type { ScaleCorrectorMap } from "./types"

export const scaleCorrectors: ScaleCorrectorMap = {
    borderRadius: {
        ...correctBorderRadius,
        applyTo: [ "borderTopLeftRadius", "borderTopRightRadius",
                   "borderBottomLeftRadius", "borderBottomRightRadius" ],
    },
    borderTopLeftRadius: correctBorderRadius,
    borderTopRightRadius: correctBorderRadius,
    borderBottomLeftRadius: correctBorderRadius,
    borderBottomRightRadius: correctBorderRadius,
    boxShadow: correctBoxShadow,
}

export function addScaleCorrector(correctors: ScaleCorrectorMap) {
    for (const key in correctors) {
        scaleCorrectors[key] = correctors[key]
        if (isCSSVariableName(key)) {
            scaleCorrectors[key].isCSSVariable = true
        }
    }
}
```

- Consumers of the registry:
  - `packages/motion-dom/src/projection/node/create-projection-node.ts:27`
    — `import { scaleCorrectors } from "../../render/utils/is-forced-motion-value"`;
    iterates it at lines 2092–2095 (`const { correct, applyTo, isCSSVariable } = scaleCorrectors[key]`).
  - `packages/motion-dom/src/render/html/utils/scrape-motion-values.ts:3,21` —
    via `isForcedMotionValue` (this is the path that drags it into `m`).
  - `packages/framer-motion/src/render/html/use-props.ts:3,15` — same.
- How projection enters bundles: `packages/framer-motion/src/motion/features/layout.ts:1`
  and `.../features/drag.ts:3` import `HTMLProjectionNode`, whose factory
  lives in `create-projection-node.ts`. So **a module-scope registration in
  `create-projection-node.ts` executes in every bundle that can actually run
  layout animations** (domMax, full `motion`, vanilla `animateLayout`), and
  in none that can't (`m` alone, domAnimation).
- Public API: `addScaleCorrector` is exported from
  `packages/motion-dom/src/index.ts:208` and re-exported at
  `packages/framer-motion/src/index.ts:93` and
  `packages/framer-motion/src/projection.ts:7`. `scaleCorrectors` itself is
  also exported (`motion-dom/src/index.ts:210`). Keep both exports working.
- Existing tests: `packages/motion-dom/src/projection/styles/__tests__/scale-correction.test.ts`
  imports `correctBorderRadius`/`correctBoxShadow` directly (not the map) —
  it keeps passing untouched.
- `packages/motion-dom/package.json` declares `"sideEffects": false`. This is
  why the registration MUST be an explicit module-scope **call expression**
  inside `create-projection-node.ts` (a module that's included for its
  exports), NOT a bare side-effect import (`import "./defaults"`), which
  bundlers are allowed to drop entirely under `sideEffects: false`.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Build all | `yarn build` | exit 0 |
| motion-dom tests | `cd packages/motion-dom && yarn test` | all pass |
| framer-motion client tests | `cd packages/framer-motion && yarn test-client` | all pass (pre-existing failures listed in CLAUDE.md memory are ignorable) |
| Layout-targeted jest | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="layout"` | all pass |
| Size bundles | `yarn measure` (after `yarn build`) | `m` drops ~0.25–0.3 kB gz |
| Leak grep | `grep -c "borderTopLeftRadius" packages/framer-motion/dist/size-rollup-m.js` | `0` after fix (`1` before) |
| Projection E2E | `make test-html` | all Cypress HTML projection specs pass |

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/projection/styles/scale-correction.ts`
- `packages/motion-dom/src/projection/styles/default-scale-correctors.ts` (create)
- `packages/motion-dom/src/projection/node/create-projection-node.ts` (imports + one registration line only)
- `packages/motion-dom/src/projection/styles/__tests__/scale-correction.test.ts` (extend)

**Out of scope** (do NOT touch, even though they look related):
- `is-forced-motion-value.ts` — its logic and re-exports are correct once the
  registry starts empty.
- `scale-box-shadow.ts` / `scale-border-radius.ts` internals — plan 008 owns
  a refactor of `scale-box-shadow.ts`; this plan only changes *where the map
  is populated*.
- `motion-dom/src/index.ts` / framer-motion export surfaces — no export
  changes needed.
- Everything else in `create-projection-node.ts` (2,465 lines; in-flight work
  touches it — keep the diff to the import block + one line).

## Git workflow

- Branch: `advisor/037-scale-correctors-registration`
- One commit, e.g. `Register default scale correctors from the projection node, not the core render path`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Empty the eager registry

In `scale-correction.ts`: remove the `correctBorderRadius`/`correctBoxShadow`
imports and replace the `scaleCorrectors` initializer with an empty map:

```ts
export const scaleCorrectors: ScaleCorrectorMap = {}
```

`addScaleCorrector` stays exactly as is.

### Step 2: Create `default-scale-correctors.ts`

New file `packages/motion-dom/src/projection/styles/default-scale-correctors.ts`
exporting the moved literal:

```ts
import { correctBorderRadius } from "./scale-border-radius"
import { correctBoxShadow } from "./scale-box-shadow"
import type { ScaleCorrectorMap } from "./types"

export const defaultScaleCorrectors: ScaleCorrectorMap = {
    borderRadius: { ...correctBorderRadius, applyTo: [ /* the four corner keys, verbatim from the old map */ ] },
    borderTopLeftRadius: correctBorderRadius,
    borderTopRightRadius: correctBorderRadius,
    borderBottomLeftRadius: correctBorderRadius,
    borderBottomRightRadius: correctBorderRadius,
    boxShadow: correctBoxShadow,
}
```

### Step 3: Register from the projection node

In `create-projection-node.ts`, extend the line-27 import to also bring in
`addScaleCorrector` (it's re-exported from the same module), import
`defaultScaleCorrectors`, and add ONE module-scope statement directly after
the import block:

```ts
addScaleCorrector(defaultScaleCorrectors)
```

It must be a top-level call expression (see the `sideEffects: false` note in
Current state — do not use a bare side-effect import).

**Verify**: `yarn build` → exit 0.

### Step 4: Prove the leak is gone and behavior is intact

Run `yarn measure` after the build, then:

- `grep -c "borderTopLeftRadius" packages/framer-motion/dist/size-rollup-m.js` → **0**
- `grep -c "borderTopLeftRadius" packages/framer-motion/dist/size-rollup-motion.js` → **≥1**
  (full bundle still registers them)
- `grep -c "borderTopLeftRadius" packages/framer-motion/dist/size-rollup-dom-max.js` → **≥1**
- `cd packages/motion-dom && yarn test` → all pass
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="layout"` →
  all pass (two known JSDOM-limitation failures listed in CLAUDE.md memory —
  "layout animation values progress" and "layout='position'" — are
  pre-existing; verify they fail the same way on a clean checkout before
  ignoring them)
- `make test-html` → all projection fixtures pass (this is the real gate:
  several fixtures, e.g. `shared-mix-finish.html`, animate borderRadius
  through projection)

### Step 5 (only if plan 035 is DONE): Ratchet the `m` budget

`yarn measure`, set the `size-rollup-m.js` budget (and any other improved
entries) to actual × 1.01 rounded up to the nearest 0.05 kB.

**Verify**: `node dev/inc/bundlesize.mjs framer-motion` → exit 0.

## Test plan

Extend `packages/motion-dom/src/projection/styles/__tests__/scale-correction.test.ts`:

1. `scaleCorrectors` starts WITHOUT default keys when only the registry
   module is imported — assert via an import of `scale-correction` only
   (note: if any other module imported by the test file transitively loads
   `create-projection-node`, registration will have run; keep this test's
   imports minimal).
2. `addScaleCorrector(defaultScaleCorrectors)` populates `borderRadius`
   (with the 4-entry `applyTo`), the four corner keys, and `boxShadow` —
   this locks the moved literal against drift.
3. Keep the existing `correctBorderRadius`/`correctBoxShadow` cases untouched.

Verification: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="scale-correction"` → all pass, including ≥2 new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `yarn build` exits 0
- [ ] `grep -c "borderTopLeftRadius" packages/framer-motion/dist/size-rollup-m.js` → 0
- [ ] `grep -c "borderTopLeftRadius" packages/framer-motion/dist/size-rollup-dom-max.js` → ≥1
- [ ] motion-dom + framer-motion layout jest suites pass; scale-correction suite has the new cases
- [ ] `make test-html` passes
- [ ] `dist/size-rollup-m.js` gz (per `node dev/inc/bundlesize.mjs framer-motion` output) ≤ 6.1 kB
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any projection/layout test fails showing borderRadius or boxShadow
  rendering uncorrected (e.g. border radius visually scaling during a layout
  animation) — that means some projection-capable graph does NOT include
  `create-projection-node.ts` and the registration site is wrong. Report
  which entry point, don't scatter more registration calls.
- A LazyMotion test fails around forced motion values: with async feature
  loading, the first render scrapes props with an empty registry and the
  post-load re-render must re-scrape. If any test shows borderRadius stuck as
  a plain style after `domMax` loads, this plan's premise (re-render
  re-scrapes) is wrong for that path — report, do not patch around it.
- `create-projection-node.ts` at HEAD has conflicting in-flight changes
  around the import block (PR #3748 / `worktree-style-effect` territory) that
  make the one-line addition non-mechanical.

## Maintenance notes

- The contract is now: **core render code may READ `scaleCorrectors` but
  must never populate it; only projection-feature code (or users, via the
  public `addScaleCorrector`) registers correctors.** A future
  `isForcedMotionValue` change that re-imports a corrector implementation
  would silently reintroduce the leak — the `grep` done-criterion on
  `size-rollup-m.js` is the cheap reviewer check (consider folding it into
  `scripts/check-bundle.js` alongside plan 036's assertion if it regresses
  once).
- Plan 008 (single-parse `correctBoxShadow`) edits the corrector *internals*;
  this plan moved their *registration*. Whichever lands second: re-run the
  scale-correction jest suite; no other interaction.
- The effects/VisualElement unification (`worktree-style-effect`) will give
  this a cleaner home eventually (feature-scoped registration); this plan's
  shape (defaults module + registry) ports directly.
