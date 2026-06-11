# Plan 015: Fix conditional hook call in Reorder.Item's useDefaultMotionValue

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/components/Reorder/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`useDefaultMotionValue` in `Reorder.Item` calls the `useMotionValue` hook inside a ternary — a Rules of Hooks violation. If a user's `style.x` or `style.y` prop switches between a `MotionValue` and a plain value (or `undefined`) across renders, React's hook order changes and React throws ("Rendered more/fewer hooks than during the previous render"), crashing the component tree. This has gone undetected because `react-hooks/rules-of-hooks` is commented out in the repo's `.eslintrc` (line 30). The fix is a two-line refactor that makes the hook call unconditional.

## Current state

- `packages/framer-motion/src/components/Reorder/Item.tsx` — the Reorder item component; contains the bug at lines 47–49:

```ts
// Item.tsx:47-49
function useDefaultMotionValue(value: any, defaultValue: number = 0) {
    return isMotionValue(value) ? value : useMotionValue(defaultValue)
}
```

It is called at lines 81–84:

```ts
// Item.tsx:81-84
const point = {
    x: useDefaultMotionValue(style.x),
    y: useDefaultMotionValue(style.y),
}
```

- `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx` — existing unit tests for Reorder; follow its structure (`render` imported from `../../../jest.setup`) for the new test.
- Repo conventions: no default exports, `const`/`let` only, arrow callbacks, strict equality. Library code prioritises small output size — keep the fix minimal.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install (only if node_modules missing) | `make bootstrap` from repo root, foreground, once | exit 0 |
| Build (only needed once before first test run) | `yarn build` from repo root | exit 0 |
| Run Reorder unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"` from repo root | all pass |
| Full client tests | `cd packages/framer-motion && yarn test-client` | all pass (pre-existing failures listed below are acceptable) |
| Lint | `yarn lint` from repo root | exit 0 |

Known pre-existing failures to ignore (do not attempt to fix): SSR tests failing with `TextEncoder is not defined`, and the `use-velocity` test.

## Scope

**In scope** (the only files you should modify):
- `packages/framer-motion/src/components/Reorder/Item.tsx`
- `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `.eslintrc` — do not enable `react-hooks/rules-of-hooks` repo-wide; that floods unrelated files and belongs to the lint plan (007).
- Any other Reorder file (`Group.tsx`, `check-reorder.ts`, `auto-scroll.ts`) — covered by plans 016–018.

## Git workflow

- Branch: `improve/015-reorder-conditional-hook` off `main`.
- Commit message style: short imperative sentence, e.g. `Fix conditional hook call in Reorder.Item` (matches repo log, no conventional-commit prefixes).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing test

Add to `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx`:

```tsx
it("Survives style.x switching between MotionValue and undefined", () => {
    const Component = ({ useMV }: { useMV: boolean }) => {
        const x = useMotionValue(0)
        return (
            <Reorder.Group onReorder={() => {}} values={[0]}>
                <Reorder.Item value={0} style={useMV ? { x } : {}} />
            </Reorder.Group>
        )
    }

    const { rerender } = render(<Component useMV={true} />)
    expect(() => rerender(<Component useMV={false} />)).not.toThrow()
})
```

Import `useMotionValue` from `"../../../value/use-motion-value"` (check how other tests in the package import it — match the local convention). React logs hook-order errors via `console.error` before throwing; the existing `jest.setup` may convert console errors to failures — either failure mode (throw or console error) is acceptable as long as the test fails pre-fix.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"` → the new test FAILS with a hooks-related error (e.g. "Rendered fewer hooks than expected" / "change in the order of Hooks"). If it passes before the fix, STOP (see STOP conditions).

### Step 2: Make the hook call unconditional

In `Item.tsx`, replace lines 47–49 with:

```ts
function useDefaultMotionValue(value: any, defaultValue: number = 0) {
    const fallback = useMotionValue(defaultValue)
    return isMotionValue(value) ? value : fallback
}
```

This creates one unused MotionValue when the user supplies their own — negligible cost, and the only way to keep hook order stable.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"` → all tests pass, including the new one.

### Step 3: Full verification

**Verify**: `cd packages/framer-motion && yarn test-client` → passes (modulo the known pre-existing failures above). `yarn lint` from root → exit 0.

## Test plan

- New test (Step 1) in `__tests__/index.test.tsx`: rerender toggling `style.x` from MotionValue to plain object must not throw. This is the regression gate for the exact bug.
- Existing Reorder tests (union types, ref hydration, virtualized reorder) must keep passing unchanged.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"` exits 0, with the new toggle test present and passing
- [ ] The string `: useMotionValue(` no longer appears inside a ternary in `Item.tsx`: `grep -n "? value : useMotionValue" packages/framer-motion/src/components/Reorder/Item.tsx` returns no matches
- [ ] `yarn lint` exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 1 test does NOT fail before the fix. Investigate whether the jest setup swallows React hook-order errors (check `packages/framer-motion/src/jest.setup.tsx`); report what you find rather than shipping a test that can't fail.
- `Item.tsx:47-49` no longer matches the excerpt (drift — someone may have fixed this already).
- Fixing the test requires modifying `jest.setup` or any out-of-scope file.

## Maintenance notes

- Plan 018 (2D reorder) rewrites other parts of `Item.tsx`; land this first so the rewrite inherits the fixed helper. Merge conflicts between them are trivial (different lines).
- Reviewer should confirm the extra MotionValue allocation is acceptable (it is — `useMotionValue` is cheap and this matches how React requires hooks to work).
- Follow-up deferred: enabling `react-hooks/rules-of-hooks` in lint (see plan 007's lint scope) would prevent this class of bug repo-wide.
