# Plan issue-3745: Stop PopChild reading children.props.ref when pop is inactive (React 18.3 warning)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update (or add) this plan's row in
> `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/3745 --jq .state` → expect `open`.
> Re-read the "Current state" excerpt of `PopChild.tsx` lines 91–94 and 143–149
> against the live file; on a mismatch, treat as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (read is provably unused when `pop === false`)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/3745

## Why this matters

In React 18.3, creating an element with a `ref` prop installs a warning getter
on `element.props.ref`. `PopChild` reads `children.props?.ref` unconditionally
on every render — including `mode="sync"` / `mode="wait"`, where the value is
never used — so any `<AnimatePresence>` wrapping a `motion.*` child that has a
`ref` logs `Warning: [object Object]: \`ref\` is not a prop.` once per app run
(noisy in every test run; reporter is shipping a pnpm patch to work around
it). The issue includes an exact, verified-correct fix.

## Current state

- `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx:91-94`:
  ```tsx
  const childRef =
      (children.props as { ref?: React.Ref<HTMLElement> })?.ref ??
      (children as unknown as { ref?: React.Ref<HTMLElement> })?.ref
  const composedRef = useComposedRefs(ref, childRef)
  ```
- The only consumer is the clone branch, `PopChild.tsx:143-149`:
  ```tsx
  return (
      <PopChildMeasure isPresent={isPresent} childRef={ref} sizeRef={size} pop={pop}>
          {pop === false
              ? children
              : React.cloneElement(children as any, { ref: composedRef })}
      </PopChildMeasure>
  )
  ```
  Note the existing convention is `pop === false` (not falsy check) — `PresenceChild.tsx:90`
  always passes `pop={mode === "popLayout"}`, but `PopChild`'s `pop` prop is
  optional and `undefined` behaves as pop-active (line 145 clones). Your gate
  must match: read the ref unless `pop === false`.
- `useComposedRefs` (`packages/framer-motion/src/utils/use-composed-ref.ts`) is
  a hook — it must remain called unconditionally; only the `childRef`
  *argument* becomes conditional. Passing `undefined` is fine
  (`PossibleRef<T> = React.Ref<T> | undefined`).
- Repo root installs React `^18.3.1` (root `package.json:70`), so Jest unit
  tests run the exact React version that exhibits the warning.
- React's warning fires once per module instance
  (`specialPropRefWarningShown`); Jest isolates module registries per test
  *file*, so the regression test must live in its own file and contain only
  this assertion.
- Existing ref-composition coverage that must keep passing: Jest test
  "Handles external refs on a single child" (`__tests__/AnimatePresence.test.tsx:630`)
  and Cypress `animate-presence-pop-ref.ts`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| New test | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="PopChild"` | fails pre-fix, passes post-fix |
| Suite | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence"` | pass |
| Cypress | CLAUDE.md § "Running Cypress tests locally", spec `cypress/integration/animate-presence-pop-ref.ts`, React 18 AND 19 | pass |

## Scope

**In scope**:
- `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx` (the 2-line gate)
- `packages/framer-motion/src/components/AnimatePresence/__tests__/PopChild-ref-warning.test.tsx` (create)
- `CHANGELOG.md`

**Out of scope**: `useComposedRefs`; `PresenceChild.tsx`; any popLayout
behavior change; React 19 ref handling (works today, must keep working).

## Git workflow

Branch `fix/issue-3745-popchild-ref-read`. Commit message style: e.g.
`Fix PopChild reading child ref prop when popLayout is inactive`. `gh pr edit`
is broken on this repo — use `gh api -X PATCH repos/motiondivision/motion/pulls/<n>`
for body edits.

## Steps

### Step 1: Write the failing test

Create `__tests__/PopChild-ref-warning.test.tsx` (own file — see the
once-per-module-registry note above). Single test:

- Spy: `jest.spyOn(console, "error").mockImplementation(() => {})` (React 18
  emits this warning via `console.error`).
- Render (using the same `render` helper as `AnimatePresence.test.tsx`, i.e.
  `../../../jest.setup`):
  ```tsx
  const ref = createRef<HTMLDivElement>()
  render(
      <AnimatePresence>
          <motion.div key="a" ref={ref} exit={{ opacity: 0 }} />
      </AnimatePresence>
  )
  ```
  (default mode `"sync"` → `pop === false` path.)
- Assert no `console.error` call whose first args stringify to something
  matching `/ref.*is not a prop/`.

**Verify**: test FAILS on unmodified main with the `ref is not a prop`
warning captured. If it does NOT fail, check (a) React version actually
resolved in `node_modules/react/package.json` is 18.3.x, (b) the JSX dev
runtime is in use; if it still can't be made to fail after 2–3 attempts, STOP
(see STOP conditions).

### Step 2: Apply the gate

In `PopChild.tsx`, replace lines 91–94's assignment with:

```tsx
const childRef =
    pop === false
        ? undefined
        : (children.props as { ref?: React.Ref<HTMLElement> })?.ref ??
          (children as unknown as { ref?: React.Ref<HTMLElement> })?.ref
const composedRef = useComposedRefs(ref, childRef)
```

Keep the explanatory React 19 comment above it (lines 87–90) intact.

**Verify**: Step 1's test passes.

### Step 3: Regression sweep

Run the AnimatePresence Jest suite, then Cypress `animate-presence-pop-ref.ts`
and `animate-presence-pop.ts` on React 18 and React 19 per the CLAUDE.md
recipe. Add CHANGELOG entry under `## Unreleased` → `### Fixed`.

**Verify**: all pass; `yarn build` exits 0.

## Test plan

- New: `PopChild-ref-warning.test.tsx` — sync-mode AnimatePresence + child with
  ref produces no React ref-prop warning (the bug). Failing-first.
- Existing gates: "Handles external refs on a single child"
  (`AnimatePresence.test.tsx:630`) proves popLayout ref composition still
  works; Cypress `animate-presence-pop-ref.ts` on both React versions.

## Done criteria

- [ ] New test fails on main (warning captured), passes with the gate
- [ ] `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence|PopChild"` exits 0
- [ ] Cypress `animate-presence-pop-ref.ts` + `animate-presence-pop.ts` green on React 18 and 19
- [ ] `yarn build` exits 0; CHANGELOG updated; no out-of-scope files touched
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- The Step 1 test cannot be made to fail on main after 2–3 attempts (e.g. the
  installed React no longer defines the warning getter): re-check the resolved
  React version; if genuinely not reproducible in this repo's harness, the fix
  is still clearly correct and defensive (the read is dead code when
  `pop === false`) — per CLAUDE.md's environment-specific-bug guidance you MAY
  proceed, but the test must then assert the gate's observable behavior
  (e.g. that a `Proxy`-wrapped `props` object's `ref` getter is not invoked in
  sync mode) and the PR must state the test couldn't fail in-harness. If you
  can't construct even that, STOP and report.
- Any existing ref-composition test (Jest line 630 or Cypress pop-ref) breaks.
- `PopChild.tsx` lines 91–94 / 143–149 no longer match the excerpts.

## Maintenance notes

- If `PopChild` ever needs the child ref outside the clone branch, the gate
  must be revisited — leave a comment pointing at issue #3745.
- React 18.3 support horizon: once the library drops React 18, the gate and
  the dual `props.ref`/`element.ref` read can be simplified together.
