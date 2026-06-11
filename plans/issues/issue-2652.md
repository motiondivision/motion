# Plan issue-2652: Decide the future of `loadExternalIsValidProp` / implicit `@emotion/is-prop-valid` loading

> **Executor instructions**: This plan is decision-gated. Do NOT modify any
> source until the maintainer has recorded a decision in the
> `plans/issues/README.md` row for issue-2652. Run the drift check first.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2652 --jq .state`
> → expect `"open"`. Confirm the excerpt below matches
> `packages/framer-motion/src/render/dom/utils/filter-props.ts`.

## Status

- **Priority**: P2 (active user pain — latest "any updates?" comment 2026-06-08)
- **Effort**: S (option A) / M (option C)
- **Risk**: MED — behaviour change for `styled(motion.div)` users
- **Depends on**: none
- **Category**: feature / tech-debt — decision-gated
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2652

## Why this matters

Filed 2024-05-06. `filter-props.ts` still ships a module-level
`try { require("@emotion/is-prop-" + "valid") } catch {}` whose own comment
says it should have been removed "in a 6.0.0" (motion is now on 12.x). The
implicit require:

- breaks/warns in ESM and Vite builds when the package isn't installed
  (comment from jamescrowley 2024-10-09; original report in PR #2531 thread);
- forced `@emotion/is-prop-valid` into `peerDependencies` (optional) —
  `packages/framer-motion/package.json:102,107-109` — which still trips some
  package managers' peer-resolution warnings;
- is dead weight for everyone who doesn't use styled(motion.x).

## Current state

`packages/framer-motion/src/render/dom/utils/filter-props.ts:9-14` — explicit
injection API already exists:
```ts
export function loadExternalIsValidProp(isValidProp?: IsValidProp) {
    if (typeof isValidProp !== "function") return
    shouldForward = (key: string) =>
        key.startsWith("on") ? !isValidMotionProp(key) : isValidProp(key)
}
```
`filter-props.ts:30-43` — the implicit loader (string-concat to dodge bundler
static resolution):
```ts
try {
    const emotionPkg = "@emotion/is-prop-" + "valid"
    loadExternalIsValidProp(require(emotionPkg).default)
} catch {
    // fallback is the existing `isPropValid`.
}
```
Explicit injection is already wired through the public API:
`packages/framer-motion/src/components/MotionConfig/index.tsx:40` —
`isValidProp && loadExternalIsValidProp(isValidProp)` (the documented
`<MotionConfig isValidProp={isPropValid}>` pattern).

## Decision gate (maintainer)

Record ONE of these in the README row before any code change:

- **Option A — remove the implicit require (recommended, next major)**:
  delete `filter-props.ts:30-43`, drop `@emotion/is-prop-valid` from
  `peerDependencies`/`peerDependenciesMeta`, document that
  `styled(motion.div)` users must pass
  `<MotionConfig isValidProp={isPropValid}>`. Breaking for CJS users who
  relied on auto-loading → major-version changelog entry.
- **Option B — keep as-is, document**: close the issue explaining the
  `MotionConfig isValidProp` escape hatch for ESM/Vite environments.
- **Option C — A + dedicated entry point**: as A, plus export
  `loadExternalIsValidProp` from the public API (it is currently internal) so
  non-React/`motion` consumers can inject without `MotionConfig`.

## Steps (after decision; written for Option A — adapt per gate)

### Step 1: Failing-first coverage

Add a Jest test in
`packages/framer-motion/src/render/dom/__tests__/filter-props.test.tsx`
(create if absent; model on neighbouring tests in `src/render/dom/__tests__/`)
asserting: (a) by default, non-motion arbitrary props are forwarded; (b) after
`loadExternalIsValidProp(isPropValid)`, arbitrary non-DOM props are filtered.
This pins the explicit-injection behaviour before removing the implicit path.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="filter-props"` → passes.

### Step 2: Remove the implicit loader

Delete the `try { ... } catch {}` block (`filter-props.ts:30-43`), keeping
`loadExternalIsValidProp` and the explanatory comment about Emotion/Styled
Components (rewritten to describe the explicit `MotionConfig` route). Remove
`"@emotion/is-prop-valid"` from `peerDependencies` and `peerDependenciesMeta`
in `packages/framer-motion/package.json`.

**Verify**: `grep -rn "is-prop-" packages/framer-motion/src packages/framer-motion/package.json` → only the `loadExternalIsValidProp` definition/imports remain.

### Step 3: Build + full test pass

`yarn build` from repo root, then
`npx jest --config packages/framer-motion/jest.config.json` (ignore the
known pre-existing SSR TextEncoder and use-velocity failures).

### Step 4: Changelog + PR

Add a CHANGELOG.md entry under Unreleased flagged as **breaking** ("Removed
implicit `@emotion/is-prop-valid` auto-loading; use
`<MotionConfig isValidProp>`"). Open a PR referencing #2652. Do not merge —
breaking changes ride the next major.

## Done criteria

- [ ] Maintainer decision recorded in `plans/issues/README.md` row
- [ ] Tests from Step 1 pass; full Jest suite green (modulo known failures)
- [ ] No `require("@emotion/is-prop-valid")` (concatenated or not) in src
- [ ] CHANGELOG entry marks the breaking change
- [ ] Issue commented with the decision (close only if Option B and row APPROVED)

## STOP conditions

- README row has no recorded option → do nothing.
- Removing the peer dep breaks any in-repo test/dev app that imports
  `@emotion/is-prop-valid` implicitly → report before working around.
