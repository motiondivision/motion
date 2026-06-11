# Plan 030: Make `visualDuration` work without `bounce`/`duration`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/generators/spring.ts packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but coordinate with plans 031/033 — all three edit `spring.ts`; execute 030 → 031 → 033)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`visualDuration` is a headline public spring option (`transition={{ type: "spring", visualDuration: 0.5 }}`), but passing it **without** also passing `bounce` or `duration` has silently done nothing since the feature shipped (PR #2912, Nov 2024). The spring falls through to the default physics (stiffness 100 / damping 10) instead. Empirically verified against the built package: `spring({ keyframes: [0, 1], visualDuration: 0.5 })` settles at 1100ms — byte-identical to a no-options spring — while the honored configuration (adding `bounce: 0`) settles at 900ms. The existing unit test asserting 1100ms passes **vacuously**, because 1100ms also happens to be the default-physics settle time. The `spring(0.5)` shorthand is unaffected (it injects a default `bounce`), which is why this went unnoticed.

## Current state

- `packages/motion-dom/src/animation/generators/spring.ts` — the spring keyframe generator. The bug is the gate at lines 164–168 plus its use at lines 181–184:

```ts
// spring.ts:164-169
const durationKeys = ["duration", "bounce"]
const physicsKeys = ["stiffness", "damping", "mass"]

function isSpringType(options: SpringOptions, keys: string[]) {
    return keys.some((key) => (options as any)[key] !== undefined)
}
```

```ts
// spring.ts:180-191 (inside getSpringOptions)
    // stiffness/damping/mass overrides duration/bounce
    if (
        !isSpringType(options, physicsKeys) &&
        isSpringType(options, durationKeys)
    ) {
        // Time-defined springs should ignore inherited velocity.
        ...
        springOptions.velocity = 0

        if (options.visualDuration) {
```

A `visualDuration`-only options object fails `isSpringType(options, durationKeys)`, so the entire resolution block — including the `if (options.visualDuration)` branch that implements it — is skipped.

- `packages/motion-dom/src/animation/generators/__tests__/spring.test.ts` — the vacuously-passing test at lines 236–242:

```ts
describe("visualDuration", () => {
    test("returns correct duration", () => {
        const generator = spring({ keyframes: [0, 1], visualDuration: 0.5 })

        expect(calcGeneratorDuration(generator)).toBe(1100)
    })
```

- Repo conventions: no default exports, `interface` over `type`, prefer concise patterns (library bundle size matters). Tests in this file use plain Jest `expect`, no snapshots — match that style.
- The fix automatically covers every consumer: `useSpring`, `springValue`/`followValue`, `JSAnimation` (via `replaceTransitionType`), and the WAAPI path (`spring.applyToOptions` → `createGeneratorEasing` → same `getSpringOptions`).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Spring unit tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="generators/__tests__/spring"` | all pass (17 today; more after this plan) |
| Full motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json` | pass (ignore pre-existing SSR `TextEncoder` failures if any appear — they are known) |
| Build all packages | `yarn build` | exit 0, bundlesize checks pass |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/animation/generators/spring.ts`
- `packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`

**Out of scope** (do NOT touch, even though they look related):
- `packages/framer-motion/src/value/use-spring.ts` and `use-follow-value.ts` — they just forward options; no change needed.
- `packages/motion-dom/src/animation/generators/utils/create-generator-easing.ts` — the WAAPI path picks up the fix automatically.
- The `findSpring` function and the generator branches in `spring.ts` — plans 033 and 031 own those regions.
- Any documentation of option precedence — `mass`/`stiffness`/`damping` continuing to override `visualDuration` is existing, intended behavior.

## Git workflow

- Branch: `fix/spring-visual-duration-without-bounce` off `main`
- Single commit; message style from `git log`: short imperative summary, e.g. `Fix visualDuration being ignored without bounce/duration`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing test first

In `packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`, inside the existing `describe("visualDuration", ...)` block, add:

```ts
test("visualDuration works without bounce", () => {
    // A visualDuration-only spring must match the same spring with
    // an explicit bounce: 0, not fall back to default physics.
    expect(
        spring({ keyframes: [0, 1], visualDuration: 0.5 }).toString()
    ).toEqual(
        spring({ keyframes: [0, 1], visualDuration: 0.5, bounce: 0 }).toString()
    )
})
```

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="generators/__tests__/spring"` → the new test FAILS (the left side currently resolves to the 1100ms default spring, the right to a 900ms visualDuration spring). All other tests still pass. If the new test passes before any source change, STOP — the premise is wrong.

### Step 2: Fix the gate

In `packages/motion-dom/src/animation/generators/spring.ts` line 164, change:

```ts
const durationKeys = ["duration", "bounce"]
```

to:

```ts
const durationKeys = ["duration", "bounce", "visualDuration"]
```

No other source change. Inside the block, `if (options.visualDuration)` already routes to the visualDuration math; a `visualDuration`-only object now reaches it. Note this also means `visualDuration`-only springs now zero out inherited velocity (`springOptions.velocity = 0`) — that is intentional and matches how `visualDuration + bounce` already behaves today.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="generators/__tests__/spring"` → the new test from Step 1 passes; the pre-existing `returns correct duration` test now FAILS with `calcGeneratorDuration` returning 900 instead of 1100. That failure is expected — proceed to Step 3.

### Step 3: Re-point the vacuous test

Update the existing test at spring.test.ts:237–242: change the expectation from `toBe(1100)` to `toBe(900)`. Add a one-line comment explaining the value guards the honored visualDuration, e.g.:

```ts
test("returns correct duration", () => {
    const generator = spring({ keyframes: [0, 1], visualDuration: 0.5 })

    // 900ms is the settle time of the visualDuration-derived spring;
    // 1100ms would mean visualDuration was ignored (default physics).
    expect(calcGeneratorDuration(generator)).toBe(900)
})
```

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="generators/__tests__/spring"` → ALL tests pass.

### Step 4: Full verification

Run the full motion-dom suite, then build from the repo root.

**Verify**:
- `npx jest --config packages/motion-dom/jest.config.json` → pass.
- `yarn build` → exit 0, bundlesize checks pass (this change is ~1 word; budgets unaffected).
- `yarn lint` → exit 0.

If any framer-motion test elsewhere fails after `yarn build` + `yarn test`, inspect whether it was encoding the old (broken) behavior; if it asserts a specific duration/curve for a `visualDuration`-without-`bounce` spring, update it with a comment, otherwise STOP.

## Test plan

- New test: `visualDuration works without bounce` (Step 1) — the regression gate; fails on the bug, passes with the fix.
- Updated test: `returns correct duration` now expects 900ms (Step 3).
- Existing guards that must stay green: `correctly resolves shorthand` (visualDuration + bounce), `Spring defined with bounce and duration is same as just bounce`, `Time-defined spring ignores velocity`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="generators/__tests__/spring"` exits 0
- [ ] `npx jest --config packages/motion-dom/jest.config.json` exits 0
- [ ] `yarn build` exits 0
- [ ] `yarn lint` exits 0
- [ ] `grep -n 'durationKeys = \["duration", "bounce", "visualDuration"\]' packages/motion-dom/src/animation/generators/spring.ts` returns one match
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The new Step 1 test passes BEFORE the source change (the bug premise no longer holds — someone fixed it since `42bfbe3ed`).
- After the fix, `calcGeneratorDuration` for the visualDuration-only spring is neither 900 nor 1100 (the spring math changed underneath this plan — likely plans 031/033 landed first; re-derive the expected value by computing the same expression for the `bounce: 0` twin and confirm both sides are equal, then proceed only if the Step 1 equality test passes).
- Fixing fallout requires touching any file outside the in-scope list.

## Maintenance notes

- **This is a behavior change for affected users**: anyone passing `visualDuration` without `bounce` has been silently getting the default spring; after this they get what they asked for. Worth a changelog entry under fixes.
- Plans 031 (generator branch rewrite) and 033 (findSpring closed form) edit other regions of the same file; land this first — it is one line and rebases trivially.
- Reviewer should scrutinize: the `velocity = 0` zeroing now applying to visualDuration-only springs (intended; consistent with the visualDuration+bounce path).
- Edge deliberately unchanged: `visualDuration: 0` is falsy, so it falls through to `findSpring` duration resolution inside the block — identical to how `visualDuration: 0, bounce: x` behaves today.
