# Plan 005: Add grid/distance-based stagger to the `stagger()` utility

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/utils/stagger.ts packages/motion-dom/src/utils/__tests__/stagger.test.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpt against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction / dx
- **Planned at**: commit `42bfbe3ed`, 2026-06-10

## Why this matters

`stagger()` only supports 1-dimensional delay distribution (`from: "first" | "last" | "center" | index`). Ripple/wave effects over grids — a common UI pattern — require hand-rolled trigonometry: the repo's own example `dev/react/src/examples/Animation-stagger-custom.tsx` reimplements column/row math, `distance2D`, and normalization across ~30 lines to do what should be one option. Adding a `grid` option makes the existing API cover 2D layouts with a few lines of library code (this repo prioritizes small output size; the addition is ~10 lines).

## Current state

- `packages/motion-dom/src/utils/stagger.ts` (complete current implementation):

  ```ts
  export type StaggerOrigin = "first" | "last" | "center" | number

  export type StaggerOptions = {
      startDelay?: number
      from?: StaggerOrigin
      ease?: Easing
  }

  export function getOriginIndex(from: StaggerOrigin, total: number) {
      if (from === "first") {
          return 0
      } else {
          const lastIndex = total - 1
          return from === "last" ? lastIndex : lastIndex / 2
      }
  }

  export function stagger(
      duration: number = 0.1,
      { startDelay = 0, from = 0, ease }: StaggerOptions = {}
  ): DynamicOption<number> {
      return (i: number, total: number) => {
          const fromIndex =
              typeof from === "number" ? from : getOriginIndex(from, total)
          const distance = Math.abs(fromIndex - i)
          let delay = duration * distance

          if (ease) {
              const maxDelay = total * duration
              const easingFunction = easingDefinitionToFunction(ease)
              delay = easingFunction(delay / maxDelay) * maxDelay
          }

          return startDelay + delay
      }
  }
  ```

- `packages/motion-dom/src/utils/__tests__/stagger.test.ts` — existing tests; use as the structural pattern for new cases.
- The hand-rolled pattern this replaces: `dev/react/src/examples/Animation-stagger-custom.tsx:5-10,46-50` (`col`/`row`/`distance2D` math).
- Export chain: `stagger` is exported from `motion-dom/src/index.ts` and reaches `motion` + `framer-motion` via `export *` — no wiring needed beyond the option itself.

Repo conventions: minimal output bytes; no `var`; strict equality; named exports.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Unit tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="stagger"` | all pass |
| Build | `yarn build` | exit 0 |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope**:
- `packages/motion-dom/src/utils/stagger.ts`
- `packages/motion-dom/src/utils/__tests__/stagger.test.ts`

**Out of scope**:
- `packages/motion-dom/src/animation/utils/calc-child-stagger.ts` — the React `staggerChildren` path; intentionally separate, do not unify.
- The dev example file — leave it; it's a demo, not a consumer to migrate.
- Any new exported helper function (e.g. `staggerGrid`) — extend `StaggerOptions` instead; one API, no new export surface.

## Git workflow

- Branch: `advisor/005-grid-stagger`
- Single commit is fine: "Add grid option to stagger()".
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend the API (spec — implement exactly this)

Add to `StaggerOptions`:

```ts
export type StaggerOptions = {
    startDelay?: number
    from?: StaggerOrigin
    ease?: Easing
    grid?: [columns: number, rows: number]
}
```

Behavior when `grid: [columns, rows]` is provided:

- Index `i` maps to cell `(col, row)` = `(i % columns, Math.floor(i / columns))`.
- The origin index resolves exactly as today (`from` keeps its existing meaning: an element index or `"first" | "center" | "last"`, resolved against `total` via `getOriginIndex`). The origin cell is the resolved index mapped through the same col/row formula. Non-integer origin indices (e.g. `"center"` with even `total`) are fine — col/row math works on fractional indices: `(originIndex % columns, originIndex / columns → use Math.floor only for integer indices)`. To keep fractional origins meaningful, compute the origin cell as `(originIndex % columns, Math.floor(originIndex / columns))` when `originIndex` is an integer, otherwise `(columns - 1) / 2, (rows - 1) / 2)` for `"center"`. Simplest correct rule, implement this: when `from === "center"` and `grid` is set, origin cell is the grid center `((columns - 1) / 2, (rows - 1) / 2)`; for all other `from` values resolve to an index first, then map with `% / Math.floor`.
- `distance` = Euclidean: `Math.hypot(col - originCol, row - originRow)` (check `Math.hypot` is used elsewhere or use `Math.sqrt(dx*dx + dy*dy)` — match whichever the codebase already uses: `grep -rn "Math.hypot" packages/motion-dom/src`).
- `ease` normalization: replace `total * duration` with the maximum possible delay for the configuration — `duration * maxDistance` where `maxDistance` is the largest distance from the origin cell to any of the four grid corners. (For the 1D path keep the existing `total * duration` normalizer unchanged — byte-for-byte behavior compatibility.)
- Without `grid`, behavior must be bit-identical to today.

**Verify**: `yarn build` → exit 0.

### Step 2: Tests

Extend `packages/motion-dom/src/utils/__tests__/stagger.test.ts` (match its existing style):

1. 1D regression: existing tests untouched and passing (no behavior change without `grid`).
2. `grid: [3, 3]`, `from: 0` (top-left), `duration: 0.1`: delay for `i=0` is `startDelay+0`; `i=2` (cell 2,0) → `0.2`; `i=4` (cell 1,1, center) → `0.1 * Math.hypot(1,1) ≈ 0.1414`; `i=8` (cell 2,2) → `0.1 * Math.hypot(2,2) ≈ 0.2828`.
3. `grid: [3, 3]`, `from: "center"` → `i=4` delay 0; corners equal `0.1 * Math.hypot(1,1)`.
4. `grid` + `ease: "easeIn"` → delays still in `[startDelay, startDelay + duration * maxDistance]` and monotone in distance.
5. `grid` + `startDelay` offsets all results.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="stagger"` → all pass, including pre-existing cases.

### Step 3: Gates

**Verify**: `yarn build` → exit 0; `yarn lint` → exit 0; `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="utils"` → no new failures.

## Test plan

Covered in Step 2 — five enumerated cases in `stagger.test.ts`, modeled on the file's existing tests.

## Done criteria

- [ ] `grep -n "grid" packages/motion-dom/src/utils/stagger.ts` → matches in `StaggerOptions` and implementation
- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="stagger"` → all pass (old + 5 new)
- [ ] `yarn build` and `yarn lint` exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The current `stagger.ts` no longer matches the excerpt (drifted).
- Existing stagger tests encode a different `ease` normalization than `total * duration` — the regression-compatibility assumption is wrong; report before changing anything.
- You find yourself wanting to change `calc-child-stagger.ts` or add a new export — out of scope by design.

## Maintenance notes

- If React's `staggerChildren`/`delayChildren` later gains grid support, `calc-child-stagger.ts` should delegate to this implementation rather than fork the math — note for that future change, not this one.
- Reviewer should check the no-`grid` path is byte-identical (library size + behavior) and that the changelog gets an "Added" entry.
- Docs (motion.dev stagger page) deliberately out of scope — separate repo.
