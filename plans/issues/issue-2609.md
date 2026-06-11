# Plan issue-2609: Make `scaleZ` render in the transform string like every other transform prop

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2609 --jq .state` → expected `open`. If closed, STOP.
> 2. `git log --oneline 42bfbe3ed..HEAD -- packages/motion-dom/src/render/utils/keys-transform.ts packages/motion-dom/src/render/html/utils/build-transform.ts packages/motion-dom/src/effects/style/transform.ts packages/motion-dom/src/render/dom/parse-transform.ts`
>    If any commits appear, compare the "Current state" excerpts against the
>    live code before proceeding; on a mismatch, treat it as a STOP condition.
>    In particular, if PR #3749 (`worktree-style-effect`) has merged, the two
>    `buildTransform` implementations have been reorganised — the core fix
>    (Step 2) is unchanged, but re-locate the test files per the notes in
>    "Interaction with PR #3749" below.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plans/issues/pr-3749.md — see interaction note)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2609

## Why this matters

`motion.div initial={{ scaleZ: 2 }}` (or via `animate`/variants) silently
drops `scaleZ`: every other transform (`scaleX`, `scaleY`, `rotateZ`,
`translateZ`) appears in the built `transform` string, but `scaleZ` never
does. The TypeScript types already advertise support
(`CSSStyleDeclarationWithTransform.scaleZ: number` at
`packages/motion-dom/src/animation/types.ts:608` and
`TransformProperties.scaleZ` at `types.ts:714`), and the value-type map
already defines it — the only gap is that `scaleZ` is missing from
`transformPropOrder`, the array both transform builders iterate. This is a
confirmed, reproducible bug with a one-line root cause.

## Current state

- `packages/motion-dom/src/render/utils/keys-transform.ts:4-22` —
  `transformPropOrder` lists every transform key in serialization order.
  `scaleZ` is absent (excerpt; note `scaleX`, `scaleY` then straight to
  `rotate`):
  ```ts
  export const transformPropOrder = [
      "transformPerspective",
      "x",
      "y",
      "z",
      "translateX",
      "translateY",
      "translateZ",
      "scale",
      "scaleX",
      "scaleY",
      "rotate",
      ...
  ```
  `transformProps` (line 34) is derived from this array, so `scaleZ` is also
  not recognised as a transform prop by `buildHTMLStyles`
  (`packages/motion-dom/src/render/html/utils/build-styles.ts:30`) — it falls
  through to the plain-style branch and is written as an invalid `scaleZ`
  style, i.e. dropped by the browser.
- Both transform builders iterate `transformPropOrder` and already handle a
  `scaleZ` entry generically via `key.startsWith("scale")` (default value 1):
  - `packages/motion-dom/src/render/html/utils/build-transform.ts:36-62`
    (VisualElement/React pipeline)
  - `packages/motion-dom/src/effects/style/transform.ts:19-38`
    (effects/vanilla pipeline)
- Value type already exists: `packages/motion-dom/src/value/types/maps/transform.ts:19`
  → `scaleZ: scale`. No change needed there.
- `packages/motion-dom/src/render/dom/parse-transform.ts:17-60` — matrix
  parsers used by `readTransformValue` when reading a transform prop's origin
  off a computed `matrix()`/`matrix3d()`. Maps are keyed per prop;
  `scaleZ` is absent from both `matrix2dParsers` and `matrix3dParsers`.
  Without an entry, `parsers[name]` is `undefined` and
  `values[undefined as any]` yields `undefined` (silent NaN downstream).
- `packages/motion-dom/src/animation/keyframes/utils/unit-conversion.ts:19-38`
  — `removeNonTranslationalTransform` handles new scale keys generically
  (`key.startsWith("scale") ? 1 : 0`). No change needed.
- `packages/motion-dom/src/render/utils/keys-position.ts` — spreads
  `transformPropOrder` into `positionalKeys`. Adding `scaleZ` is consistent
  with how `rotate`/`scale` are already handled there
  (`DOMKeyframesResolver.readKeyframes` guards every `positionalValues[name]`
  access — see `packages/motion-dom/src/animation/keyframes/DOMKeyframesResolver.ts:97,118`).
- Known side consumer: `packages/motion-dom/src/render/svg/utils/scrape-motion-values.ts:24`
  maps SVG props found in `transformPropOrder` to `attr*` names. After this
  change, a `scaleZ` MotionValue passed as a direct prop (not style) to an
  SVG motion component would map to `attrScaleZ`. `scaleZ` is meaningless on
  SVG attributes, so this is acceptable; do not special-case it.

### Interaction with PR #3749 (worktree-style-effect)

#3749 rewrites both `build-transform.ts` and `effects/style/transform.ts`
and deletes `packages/framer-motion/src/render/html/utils/__tests__/build-styles.test.ts`,
but does NOT touch `keys-transform.ts` or `parse-transform.ts`. Because both
present and future builders iterate `transformPropOrder`, Step 2's one-line
fix is valid before and after #3749. If #3749 has already merged when you
execute this plan, put the buildTransform unit test wherever the surviving
`buildTransform` tests live (search: `grep -rln "buildTransform" packages/*/src --include="*.test.*"`).

## Commands you will need

| Purpose | Command (repo root) | Expected on success |
|---|---|---|
| Build all packages | `yarn build` | exit 0 |
| Unit tests (targeted) | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="build-transform"` | all pass |
| motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="transform"` | all pass |
| Full framer-motion Jest | `cd packages/framer-motion && yarn test-client` | pass (ignore known SSR TextEncoder / use-velocity failures) |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/render/utils/keys-transform.ts`
- `packages/motion-dom/src/render/dom/parse-transform.ts`
- `packages/framer-motion/src/render/html/utils/__tests__/build-transform.test.ts` (extend)
- `packages/framer-motion/src/motion/__tests__/` — one component-level test (extend an existing render test file, e.g. where `initial` transform rendering is already asserted)

**Out of scope**:
- `packages/motion-dom/src/effects/style/transform.ts` and
  `packages/motion-dom/src/render/html/utils/build-transform.ts` — they need
  no edits (they iterate the array) and #3749 rewrites both; touching them
  invites conflicts.
- Type files — `scaleZ` is already typed.
- WAAPI acceleration of `scaleZ` as an individual value — transforms are
  serialized into one `transform` string; nothing extra needed.

## Git workflow

- Branch: `fix/issue-2609-scalez` from `main`.
- Commit style: short imperative subject (match `git log --oneline`), e.g.
  `Fix scaleZ not being applied to transform string (#2609)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing tests first

1. In `packages/framer-motion/src/render/html/utils/__tests__/build-transform.test.ts`
   (imports `buildTransform` from `motion-dom`), add:
   ```ts
   it("Outputs scaleZ", () => {
       expect(buildTransform({ scaleZ: 2 }, {})).toBe("scaleZ(2)")
       expect(buildTransform({ scaleZ: 1 }, {})).toBe("none")
       expect(
           buildTransform({ scaleX: 2, scaleZ: 3, rotateZ: 90 }, {})
       ).toBe("scaleX(2) scaleZ(3) rotateZ(90deg)")
   })
   ```
2. Component-level test (JSDOM, JS fallback path is sufficient — pure style
   output): render `<motion.div initial={{ scaleZ: 2, rotateX: 10 }} />` and
   assert `container.firstChild` has
   `style.transform === "scaleZ(2) rotateX(10deg)"`. Model after existing
   initial-render transform assertions in
   `packages/framer-motion/src/motion/__tests__/` (search
   `grep -rn "toHaveStyle" packages/framer-motion/src/motion/__tests__/render.test.tsx | head`).

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="build-transform"`
→ the new assertions FAIL with output `"none"` / missing `scaleZ(...)` (the
bug, reproduced). If they pass, STOP — the bug no longer exists; reclassify.

### Step 2: Add `scaleZ` to `transformPropOrder`

In `packages/motion-dom/src/render/utils/keys-transform.ts`, insert
`"scaleZ"` after `"scaleY"`:
```ts
    "scale",
    "scaleX",
    "scaleY",
    "scaleZ",
    "rotate",
```

**Verify**: `yarn build` → exit 0, then re-run the Step 1 Jest command → new
tests pass.

### Step 3: Add `scaleZ` matrix parsers

In `packages/motion-dom/src/render/dom/parse-transform.ts`:
- `matrix2dParsers` (line 17): add `scaleZ: () => 1,` (a 2D matrix implies no
  Z scale; note parser values that are numbers are treated as array indices,
  so it MUST be a function, not the literal `1`).
- `matrix3dParsers` (line 43): add
  `scaleZ: (v) => Math.sqrt(v[8] * v[8] + v[9] * v[9] + v[10] * v[10]),`
  (length of the third column basis vector, mirroring how `scaleX`/`scaleY`
  use columns 1 and 2).

Add unit coverage where `parseValueFromTransform` is already tested
(`grep -rln "parseValueFromTransform" packages --include="*.test.*"`; if no
test file exists, add assertions to the Step 1 build-transform test file):
- `parseValueFromTransform("none", "scaleZ")` → `1`
- `parseValueFromTransform("matrix3d(1,0,0,0, 0,1,0,0, 0,0,3,0, 0,0,0,1)", "scaleZ")` → `3`
- `parseValueFromTransform("matrix(1, 0, 0, 1, 10, 20)", "scaleZ")` → `1`

**Verify**: targeted Jest run for the touched test files → all pass.

### Step 4: Full regression pass

**Verify**:
- `cd packages/framer-motion && yarn test-client` → no new failures
  (pre-existing SSR TextEncoder and use-velocity failures are known — ignore).
- `npx jest --config packages/motion-dom/jest.config.json` → pass.
- `yarn lint` → exit 0.

## Test plan

- `build-transform.test.ts`: scaleZ serialization, default-1 collapse to
  `"none"`, ordering between scaleX and rotateZ (Step 1).
- Component render test: `initial={{ scaleZ: 2, rotateX: 10 }}` produces the
  combined transform string (Step 1).
- `parse-transform`: scaleZ from `none`, `matrix3d`, and 2D `matrix` (Step 3).
- Pattern exemplar: `packages/framer-motion/src/render/html/utils/__tests__/build-transform.test.ts`.

## Done criteria

- [ ] `yarn build` exits 0
- [ ] New scaleZ tests exist and pass; full `yarn test-client` shows no new failures
- [ ] `grep -n '"scaleZ"' packages/motion-dom/src/render/utils/keys-transform.ts` returns one hit between `scaleY` and `rotate`
- [ ] `git status` shows no files outside the in-scope list modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- The Step 1 tests pass before the fix (bug already fixed upstream — report,
  recommend closing the issue instead).
- `keys-transform.ts` no longer contains the array as excerpted (drift —
  likely #3749 follow-ups; re-ground before editing).
- Any existing test fails after Step 2 — especially layout-projection or
  unit-conversion tests; that means a `transformPropOrder` consumer makes an
  assumption this plan missed. Report the failing test name and output.
- The fix appears to require touching `effects/style/transform.ts` or
  `build-transform.ts` (it shouldn't).

## Maintenance notes

- `transformPropOrder` is consumed by build-transform (both pipelines),
  parse-transform, unit-conversion, keys-position, and the SVG motion-value
  scraper. Any future transform key addition must audit the same five sites
  — consider extracting this checklist into a comment in keys-transform.ts.
- Reviewer should scrutinize the matrix3d scaleZ extraction (column-norm
  approach is only exact for non-skewed matrices — same approximation already
  used for scaleX/scaleY).
- Closing issue 2609 after merge: only when the `plans/issues/README.md` row
  for this plan is marked APPROVED.
