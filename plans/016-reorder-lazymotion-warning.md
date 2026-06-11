# Plan 016: Make the Reorder-inside-LazyMotion warning actionable and documented

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/motion/index.tsx packages/framer-motion/src/components/Reorder/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`Reorder.Group`/`Reorder.Item` render the full `motion` proxy, which statically imports the complete feature bundle. Importing Reorder anywhere therefore silently defeats `LazyMotion`'s bundle-size benefits (GitHub issues #2232, #2094). Inside `<LazyMotion strict>`, users currently get the *generic* motion-in-LazyMotion warning ("Import and render a `m` component instead") — advice that is impossible to follow for Reorder, since users don't control which component Reorder renders. Issue #2094 calls this out as inactionable. This plan makes the warning tell the truth ("Reorder preloads all features; LazyMotion cannot tree-shake around it") and documents the limitation on the component props. The *real* fix — Reorder rendering `m` and requiring user-loaded `domMax` features — is a breaking change and is explicitly deferred (see Maintenance notes).

## Current state

- `packages/framer-motion/src/motion/index.tsx` — `useStrictMode` (lines 181–202) fires the warning. `ignoreStrict` is passed only by Reorder (verified: the only non-type usages of `ignoreStrict` in `src/` are `motion/index.tsx`, `motion/utils/valid-prop.ts`, `Reorder/Group.tsx:169`, `Reorder/Item.tsx:129`), so the `ignoreStrict` branch of this conditional is, in practice, the Reorder branch:

```ts
// motion/index.tsx:191-201
if (
    process.env.NODE_ENV !== "production" &&
    preloadedFeatures &&
    isStrict
) {
    const strictMessage =
        "You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead."
    configAndProps.ignoreStrict
        ? warning(false, strictMessage, "lazy-strict-mode")
        : invariant(false, strictMessage, "lazy-strict-mode")
}
```

- `packages/motion-utils/src/errors.ts` — `warning(check, message, errorCode)` logs `console.warn(formatErrorMessage(message, errorCode))` in dev. It does not dedupe; that is pre-existing behavior and not changed by this plan.
- `packages/framer-motion/src/components/Reorder/Group.tsx` (lines 18–63) and `Item.tsx` (lines 20–45) — exported `Props` interfaces with JSDoc on each prop; this is where the documentation note goes.
- Repo conventions: JSDoc with `@public` tags on public props; error messages passed with a string error code.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build (once, before first test run) | `yarn build` from repo root | exit 0 |
| Run targeted tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="(Reorder|LazyMotion)"` from repo root | all pass |
| Full client tests | `cd packages/framer-motion && yarn test-client` | all pass (ignore pre-existing TextEncoder SSR failures and use-velocity) |
| Lint | `yarn lint` from repo root | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `packages/framer-motion/src/motion/index.tsx` (the `useStrictMode` function only)
- `packages/framer-motion/src/components/Reorder/Group.tsx` (JSDoc only)
- `packages/framer-motion/src/components/Reorder/Item.tsx` (JSDoc only)
- `packages/framer-motion/src/components/LazyMotion/__tests__/` or `Reorder/__tests__/index.test.tsx` (new test — put it wherever the existing strict-mode warning test lives; search with `grep -rn "lazy-strict-mode\|break tree shaking" packages/framer-motion/src --include="*.test.tsx"`)

**Out of scope** (do NOT touch, even though they look related):
- `packages/framer-motion/src/render/components/motion/proxy.ts` and the `m` proxy — switching Reorder to `m` is the deferred breaking fix, not this plan.
- The non-strict LazyMotion case (no warning fires at all today when `strict` is false) — same-by-design for plain `motion` components; changing it is a behavior decision for the maintainer.
- The `warning()` implementation in motion-utils — no dedup changes.
- Error-code documentation outside this repo (motion.dev).

## Git workflow

- Branch: `improve/016-reorder-lazymotion-warning` off `main`.
- Commit style: short imperative sentence (e.g. `Make Reorder LazyMotion warning actionable`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Find the existing strict-mode warning test and write the failing test

Locate existing coverage: `grep -rn "break tree shaking\|lazy-strict-mode" packages/framer-motion/src --include="*.tsx" --include="*.ts"`. Add a test (in the same file as existing strict-mode tests if one exists, otherwise in `Reorder/__tests__/index.test.tsx`):

```tsx
it("Warns with Reorder-specific guidance inside LazyMotion strict", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
    render(
        <LazyMotion features={domMax} strict>
            <Reorder.Group onReorder={() => {}} values={[0]}>
                <Reorder.Item value={0} />
            </Reorder.Group>
        </LazyMotion>
    )
    expect(
        warnSpy.mock.calls.some(([msg]) =>
            String(msg).includes("Reorder")
        )
    ).toBe(true)
    warnSpy.mockRestore()
})
```

Import `LazyMotion` and `domMax` the way existing LazyMotion tests do (check `packages/framer-motion/src/components/LazyMotion/__tests__/`).

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="(Reorder|LazyMotion)"` → new test FAILS (current warning text says "motion component", never "Reorder").

### Step 2: Split the warning message in useStrictMode

In `motion/index.tsx`, replace the body of the dev-mode block so the `ignoreStrict` branch gets its own message (keep the same `"lazy-strict-mode"` error code — a new code would need a docs page on motion.dev, which is outside this repo):

```ts
configAndProps.ignoreStrict
    ? warning(
          false,
          "You have rendered a `Reorder` component within a `LazyMotion` component. `Reorder` preloads the full feature bundle, so `LazyMotion` cannot reduce bundle size for this part of the tree. To take advantage of `LazyMotion`, build reorder interactions from `m` components and drag gestures directly.",
          "lazy-strict-mode"
      )
    : invariant(
          false,
          "You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead.",
          "lazy-strict-mode"
      )
```

Keep the code size impact minimal: the strings live inside a `NODE_ENV !== "production"` block, so they're stripped from production bundles — verify the block structure is unchanged.

**Verify**: targeted jest run → new test passes; existing strict-mode tests (the `invariant` path for plain `motion` components) still pass.

### Step 3: Document the limitation on the Props interfaces

Add to the JSDoc of the exported `Props` interface in both `Group.tsx` and `Item.tsx` (top-level interface comment, not per-prop), matching existing JSDoc style:

```
 * Note: `Reorder` components preload all motion features and are not
 * compatible with the bundle-size benefits of `LazyMotion`.
```

**Verify**: `yarn lint` → exit 0. `cd packages/framer-motion && yarn test-client` → passes (modulo known pre-existing failures).

## Test plan

- New test (Step 1): Reorder inside `LazyMotion strict` produces a warning mentioning `Reorder`. This is the regression gate.
- Existing gate: whatever test currently covers the `invariant` throw for plain `motion` inside `LazyMotion strict` must keep passing (the generic message must not change).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="(Reorder|LazyMotion)"` exits 0 with the new test present
- [ ] `grep -c "Reorder" packages/framer-motion/src/motion/index.tsx` ≥ 1 (the new message exists)
- [ ] The generic invariant message is unchanged: `grep -n "Import and render a \`m\` component instead" packages/framer-motion/src/motion/index.tsx` still matches
- [ ] `yarn lint` exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `grep -rln "ignoreStrict" packages/framer-motion/src --include="*.tsx" --include="*.ts"` (excluding tests) returns files beyond `motion/index.tsx`, `motion/utils/valid-prop.ts`, `Reorder/Group.tsx`, `Reorder/Item.tsx` — the "ignoreStrict ⇒ Reorder" assumption would be false and the message would mislead other callers.
- The existing strict-mode invariant test starts failing and the fix would require changing the generic message or the error code.
- `useStrictMode` in `motion/index.tsx` no longer matches the excerpt (drift).

## Maintenance notes

- **Deferred real fix (maintainer decision)**: make Reorder render `m` and require features from `LazyMotion`/`loadFeatures`. This is breaking for standalone Reorder users (drag/layout would silently stop working without loaded features) and needs a major-version plan plus a dev-mode "drag feature missing" invariant. Issues #2232/#2094 should stay open pointing at that.
- The warning fires once per Reorder component per render (no dedup in `motion-utils` `warning()`). If that proves noisy, dedup belongs in `motion-utils`, not here.
- Plan 018 (2D reorder) touches `Group.tsx`/`Item.tsx`; conflicts with this plan are JSDoc-only and trivial.
