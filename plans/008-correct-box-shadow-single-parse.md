# Plan 008: Parse box-shadow once per frame in projection scale correction

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/projection/styles/scale-box-shadow.ts packages/motion-dom/src/value/types/complex/index.ts`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (pure refactor; output is bit-identical, guarded by existing characterization tests)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `42bfbe3ed`, 2026-06-10

## Why this matters

During layout (FLIP) animations, `correctBoxShadow.correct()` runs **every frame** for every layout-animating element that has a `boxShadow`. Today it parses the shadow string **twice** per call: once via `complex.parse(latest)` and once via `complex.createTransformer(latest)` — each of which internally runs `analyseComplexValue`, the heaviest string operation in the value system (a global regex tokenization pass over the full value string). This was flagged as recommendation #4 of the in-repo `PERFORMANCE_AUDIT.md` and verified still unfixed at the planned-at commit. Deriving both the values array and the transformer from a *single* `analyseComplexValue` pass halves the per-frame string-parsing cost for box-shadow scale correction, with zero behavior change.

## Current state

- `packages/motion-dom/src/projection/styles/scale-box-shadow.ts` — the whole file is ~43 lines. The relevant part:

```ts
// scale-box-shadow.ts:5-13 (current)
export const correctBoxShadow: ScaleCorrectorDefinition = {
    correct: (latest: string, { treeScale, projectionDelta }) => {
        const original = latest
        const shadow = complex.parse(latest)          // ← full analyseComplexValue pass #1

        // TODO: Doesn't support multiple shadows
        if (shadow.length > 5) return original

        const template = complex.createTransformer(latest)  // ← full analyseComplexValue pass #2
```

- `packages/motion-dom/src/value/types/complex/index.ts` — the complex value module:
  - `analyseComplexValue(value)` (line 46, **already exported**) returns `ComplexValueInfo` = `{ values, split, indexes, types }`.
  - `parseComplexValue(v)` (line 82) is just `analyseComplexValue(v).values`.
  - `buildTransformer(info: ComplexValueInfo)` (line 86, **module-private, not exported**) builds the string-template function from an already-computed `ComplexValueInfo`.
  - `createTransformer(source)` (line 108) is `buildTransformer(analyseComplexValue(source))`.
- Existing tests: `packages/motion-dom/src/projection/styles/__tests__/scale-correction.test.ts` has a `describe("correctBoxShadow")` block (line 58) with four assertions on `.correct(...)` output strings — this is the characterization gate.

Repo conventions: named exports only, `interface` over `type`, prioritise small output size (the fix *reduces* code).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Targeted tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="scale-correction"` | all pass |
| Complex-value tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="complex"` | all pass |
| Package build (typecheck gate) | `cd packages/motion-dom && yarn build` | exit 0 |
| Full motion-dom suite | `cd packages/motion-dom && yarn test` | all pass |

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/value/types/complex/index.ts` — export `buildTransformer`
- `packages/motion-dom/src/projection/styles/scale-box-shadow.ts` — single-parse refactor
- `packages/motion-dom/src/projection/styles/__tests__/scale-correction.test.ts` — optional added cases
- `plans/README.md` — status update

**Out of scope** (do NOT touch, even though they look related):
- `scale-border-radius.ts` — it doesn't use complex parsing; nothing to fix.
- The `TODO: Doesn't support multiple shadows` at `scale-box-shadow.ts:10` — multiple-shadow support is a feature, not this refactor. Keep the `shadow.length > 5` early-return exactly as is (note: with the refactor, the early-return happens after the single parse — that's fine; today it happens after parse #1 and before parse #2, so the refactor changes nothing for that path either).
- `complex.parse` / `complex.createTransformer` public API — other call sites depend on them; do not change their signatures or remove them.
- The non-null assertions on `projectionDelta!`/`treeScale!` (lines 17-18) — scale correctors only run inside projection render where these are set; leave them.

## Git workflow

- Branch: `advisor/008-box-shadow-single-parse`
- Single commit, e.g. "Parse box-shadow once in projection scale correction"
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Export `buildTransformer` from the complex value module

In `packages/motion-dom/src/value/types/complex/index.ts:86`, change `function buildTransformer(` to `export function buildTransformer(`. Nothing else changes in this file.

**Verify**: `cd packages/motion-dom && yarn build` → exit 0.

### Step 2: Refactor `correctBoxShadow` to a single parse

In `scale-box-shadow.ts`, replace the two-parse block with one `analyseComplexValue` call:

```ts
import { analyseComplexValue, buildTransformer } from "../../value/types/complex"
import { mixNumber } from "../../utils/mix/number"
import type { ScaleCorrectorDefinition } from "./types"

export const correctBoxShadow: ScaleCorrectorDefinition = {
    correct: (latest: string, { treeScale, projectionDelta }) => {
        const original = latest
        const info = analyseComplexValue(latest)
        const shadow = [...info.values]

        // TODO: Doesn't support multiple shadows
        if (shadow.length > 5) return original

        const template = buildTransformer(info)
        // ... rest of the function unchanged (offset calc, x/y scale, blur, spread, return template(shadow))
```

Note the `[...info.values]` copy: the current code mutates the parsed array in place (`shadow[0 + offset] /= xScale`). `complex.parse()` returned a fresh array each call; `info.values` is the analysis's own array. A shallow copy preserves exact current semantics at negligible cost (≤6-element array). Keep the rest of the function (lines 14–41 of the current file) byte-identical.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="scale-correction"` → all pass, including the 4 existing `correctBoxShadow` assertions.

### Step 3: Add one regression test

In `scale-correction.test.ts`, inside the existing `describe("correctBoxShadow")`, add a case asserting the early-return path still works post-refactor (a >5-token shadow string returns unchanged), e.g. `"5px 10px 20px 40px 5px #000 inset"`-style input → expect output `toBe` input. Model the node setup on the existing tests in that block (they build `{ projectionDelta, treeScale }` objects).

**Verify**: same jest command → all pass, one more test than before.

### Step 4: Full gates

**Verify**: `cd packages/motion-dom && yarn test` → suite passes. `cd packages/motion-dom && yarn build` → exit 0.

## Test plan

- Existing: 4 `correctBoxShadow` characterization assertions in `scale-correction.test.ts` must produce identical output strings (they encode current behavior exactly).
- New: 1 early-return regression test (Step 3).
- Pattern exemplar: the existing `describe("correctBoxShadow")` block in the same file.
- Command: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="scale-correction"`.

## Done criteria

- [ ] `grep -c "complex.parse\|createTransformer" packages/motion-dom/src/projection/styles/scale-box-shadow.ts` → `0`
- [ ] `grep -c "analyseComplexValue" packages/motion-dom/src/projection/styles/scale-box-shadow.ts` → `1`
- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="scale-correction"` → all pass (≥5 correctBoxShadow tests)
- [ ] `cd packages/motion-dom && yarn build` → exit 0
- [ ] `cd packages/motion-dom && yarn test` → pass
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The current `scale-box-shadow.ts` no longer matches the excerpt (someone fixed it already).
- Any existing `correctBoxShadow` test produces a *different* string after the refactor — that means `analyseComplexValue`'s values array semantics differ from `complex.parse` in a way this plan didn't predict. Do not adjust the tests to match; revert and report.
- Exporting `buildTransformer` causes a bundle-size check failure in `node ./scripts/check-bundle.js` (runs inside `yarn build`) — report the delta.

## Maintenance notes

- If multiple-shadow support is ever added (the in-file TODO), the single-parse structure here is the right starting point — `analyseComplexValue` already tokenizes the full string; only the indexing logic needs generalizing.
- Reviewer focus: the `[...info.values]` copy (mutation safety) and that `buildTransformer`'s export doesn't get re-exported from `motion-dom/src/index.ts` (it shouldn't be — internal use only).
- Related but deferred: `PERFORMANCE_AUDIT.md` recommendations #1 (WAAPI for `x`/`scale`/`rotate`) and #2 (color acceleration) remain open; they are large projects, tracked as direction items, not executor plans.
