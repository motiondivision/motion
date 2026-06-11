# Plan issue-2580: Verify `attrX` & co. typecheck in `AnimationSequence`, pin with a type test, close #2580

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update
> the status row for this plan in `plans/issues/README.md`.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2580 --jq .state`
> → expected `open`. If closed, mark the README row DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (pure types; no interaction with PR #3749 — verified
  the branch does not change `DOMKeyframesDefinition` composition)
- **Category**: bug / types (already fixed on main — verification + regression type test + close)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2580

## Why this matters

Reported 2024: using SVG forced-attr properties (`attrX`, `attrY`,
`attrScale`) inside an `AnimationSequence` segment —
`animate([[scope.current, { attrX: 100 }]])` — worked at runtime but raised
a TypeScript error. **Verified fixed at planning time**: the exact repro
compiles cleanly against the current built d.ts (exit 0, see verification
in "Current state"). The types gained `SVGForcedAttrKeyframesDefinition`
inside `DOMKeyframesDefinition`, which `DOMSegment` uses. What's missing is
a regression type test so a future type refactor can't silently regress it,
and the issue should be closed.

## Current state

- `packages/motion-dom/src/animation/types.ts:565-577`:
  ```ts
  export type SVGForcedAttrKeyframesDefinition = {
      [K in keyof SVGForcedAttrProperties]?: ValueKeyframesDefinition
  }
  ...
  export type DOMKeyframesDefinition = StyleKeyframesDefinition &
      SVGKeyframesDefinition &
      SVGPathKeyframesDefinition &
      SVGForcedAttrKeyframesDefinition &
      VariableKeyframesDefinition
  ```
  with `SVGForcedAttrProperties { attrX?: number; attrY?: number; attrScale?: number }`
  at `types.ts:725-729`.
- Sequence segments use it:
  `packages/framer-motion/src/animation/sequence/types.ts:76` —
  `export type DOMSegment = [ElementOrSelector, DOMKeyframesDefinition]`
  (imported from `motion-dom`).
- Planning-time verification (repro from the issue, compiled with the repo's
  TypeScript against `packages/framer-motion/dist/index.d.ts` via a paths
  mapping):
  ```ts
  import { animate } from "framer-motion"
  declare const el: SVGTextElement
  animate([[el, { attrX: 100 }, { duration: 1 }]])
  animate(el, { attrX: 100 })
  ```
  → `tsc --strict --noEmit` exit 0, no errors.
- How this repo tests types: there is no `tsd`; type regressions are caught
  by ordinary `.test.tsx` files that are type-checked during the package
  build (`tsc --noEmitOnError -p .` in
  `packages/framer-motion/package.json:78`) and compiled by ts-jest.
  Exemplar: `packages/framer-motion/src/motion/__tests__/types.test.tsx`
  ("accepts expected values" pattern).
- The issue's CodeSandbox
  (https://codesandbox.io/p/sandbox/framer-motion-animate-content-svg-text-forked-5nn53q)
  is Cloudflare-blocked at planning time; the inline repro in the issue body
  is complete, so nothing is lost.

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Build (type-checks all src incl. tests' imports) | `yarn build` | exit 0 |
| Run the touched test | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="sequence"` | all pass |
| Close issue (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2580 -f state=closed -f state_reason=completed` | closed |

## Scope

**In scope** (only file you may modify):
- `packages/framer-motion/src/animation/__tests__/animate-sequences.test.tsx`
  (or the existing sequence test file found via
  `grep -rln "createAnimationsFromSequence\|animate(\[" packages/framer-motion/src/animation/__tests__ | head -1`)
  — add ONE small type-exercising test.

**Out of scope**:
- `packages/motion-dom/src/animation/types.ts` — no change needed; the types
  are correct.
- Adding a tsd/expect-type dependency — the repo doesn't use one.

## Steps

### Step 1: Confirm the repro compiles on current main

Add the regression test (Step 2 below) FIRST and run `yarn build` — if the
build's type-check fails on it, the issue is NOT fixed; STOP and report
(this becomes a FIX plan against `types.ts`).

### Step 2: Add the regression type test

In the sequence test file (see Scope), add a test that exercises the issue's
exact shape — its value is the compile, the runtime assertion is minimal:

```tsx
test("accepts SVG forced-attr properties in sequence segments (#2580)", () => {
    const el = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
    )
    // Type regression gate: attrX/attrY/attrScale must be valid segment keys
    const animation = animate([
        [el, { attrX: 100, attrY: 50, attrScale: 2 }, { duration: 0.01 }],
    ])
    expect(animation).toBeDefined()
    animation.stop()
})
```

Match the file's existing imports (`animate` is imported from `../../`
or `framer-motion` depending on the file — copy its style).

**Verify**: `yarn build` → exit 0 (type-check passed);
`npx jest --config packages/framer-motion/jest.config.json --testPathPattern="<that file>"` → passes.

### Step 3: Comment and close (GATED)

Only if the `plans/issues/README.md` row for this plan is APPROVED:
- Comment on #2580: the repro now typechecks; `DOMKeyframesDefinition`
  includes `SVGForcedAttrKeyframesDefinition`
  (`motion-dom/src/animation/types.ts:573-577`); regression type test added;
  reopen with a minimal `.ts` snippet + TS version if it still errors.
- Close: `gh api -X PATCH repos/motiondivision/motion/issues/2580 -f state=closed -f state_reason=completed`

Otherwise mark the row BLOCKED ("verified fixed; awaiting close approval").

## Done criteria

- [ ] `yarn build` exit 0 with the new test in place
- [ ] New sequence test passes
- [ ] Issue closed with comment (or row BLOCKED awaiting approval)
- [ ] Only the one test file modified (`git status`)
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- The new test produces a TS error mentioning `attrX` — the bug still exists
  for the path the executor used (e.g. a different `animate` overload).
  Report the exact compiler error and which import was used.
- The sequence test file can't be located — list
  `packages/framer-motion/src/animation/__tests__/` contents in the report.

## Maintenance notes

- If `DOMKeyframesDefinition` is ever split (e.g. SVG types separated for
  bundle-size or strictness), this test is the canary for sequence segments.
- The `attrX` runtime rendering path is covered elsewhere
  (`buildSVGAttrs` → attrs; `packages/motion-dom/src/render/svg/utils/build-attrs.ts:83-85`);
  this plan is only about types.
