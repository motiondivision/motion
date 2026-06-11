# Plan 031: Fix overdamped spring snap (issue #1207) via exponential form + unify per-tick position/velocity computation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/generators/spring.ts packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`
> Plan 030 is expected to have landed first (it adds one entry to `durationKeys`
> and edits the visualDuration tests — that drift is fine). Any OTHER drift in
> the branch structure at lines 282–445: compare against the "Current state"
> excerpts; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (hottest code path in the library; math-sensitive)
- **Depends on**: 030 (soft — same file, land 030 first; trivial rebase otherwise)
- **Category**: bug + perf + size
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

Open issue [#1207](https://github.com/motiondivision/motion/issues/1207) (2021): slow overdamped springs visibly **snap to the target mid-animation**. Root cause, proven numerically with the reporter's exact config (`stiffness: 4, damping: 35, mass: 0.5`, range 0→1000): the overdamped branch caps `sinh`/`cosh` inputs at 300 to avoid `Infinity` (`Math.min(dampedAngularFreq * t, 300)`, spring.ts:344). Mathematically, the decaying envelope `e^(-ζω₀t)` is *cancelled* by the growing `sinh`/`cosh` terms; freezing them at the cap kills that cancellation, so the envelope sweeps the value to the target over ~100ms. Measured: at t=8594ms the generator matches the exact physics (625.49 of 1000); at t=8700ms the generator reads 988.87 while the true spring is at 630.01.

The fix is to rewrite the overdamped solution in exponential form — `x(t) = target − (c_slow·e^(λ_slow·t) + c_fast·e^(λ_fast·t))` with both λ < 0 — which is algebraically identical, can never overflow, and removes the cap entirely. While restructuring, unify each branch into a single `update(t)` that computes position and velocity from one set of `Math.exp/sin/cos` calls: this extends the existing underdamped hot-path optimization (commit `ee9578794`) to critically-damped and overdamped springs, deletes the duplicated math between `next()` and the closures, and shrinks the module (a verified prototype of the dedupe alone measured −224 B min / −49 B gzip on the compiled module; this design is smaller still).

## Current state

All in `packages/motion-dom/src/animation/generators/spring.ts`. The region to replace is lines 282–426 (from `let resolveSpring` through the end of `next`). Key excerpts as they exist today:

```ts
// spring.ts:282-289
    let resolveSpring: (v: number) => number
    let resolveVelocity: (t: number) => number

    // Underdamped coefficients, hoisted for use in the inlined next() hot path
    let angularFreq: number
    let A: number
    let sinCoeff: number
    let cosCoeff: number
```

```ts
// spring.ts:335-375 — the overdamped branch with the cap (the #1207 bug)
    } else {
        // Overdamped spring
        const dampedAngularFreq =
            undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1)

        resolveSpring = (t: number) => {
            const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t)

            // When performing sinh or cosh values can hit Infinity so we cap them here
            const freqForT = Math.min(dampedAngularFreq * t, 300)
            ...
```

```ts
// spring.ts:377-426 — generator with duplicated underdamped math inlined in next()
    const generator = {
        calculatedDuration: isResolvedFromDuration ? duration || null : null,
        velocity: (t: number) => secondsToMilliseconds(resolveVelocity(t)),
        next: (t: number) => {
            if (!isResolvedFromDuration && dampingRatio < 1) {
                const envelope = Math.exp(
                    -dampingRatio * undampedAngularFreq * t
                )
                const sin = Math.sin(angularFreq * t)
                const cos = Math.cos(angularFreq * t)
                ...
```

Existing tests that pin behavior (`packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`):
- `Overdamped spring` (line 77) and `Velocity passed to overdamped spring` (line 109) — settle before the cap region; must pass unchanged.
- `Overdamped spring with very high stiffness/damping` (lines 94–108) — `stiffness: 1000000, damping: 10000000` expects `[100, 1000]` after one 200ms step. **This expectation encodes the bug**: with ζ = 5000, the cap triggers at t ≈ 0.06ms and snaps the value instantly. The physically correct spring creeps with time constant `damping/stiffness = 10s`. This test MUST be rewritten (Step 4).
- `toString → returns correct string` (line 255) — exact `linear(...)` strings for underdamped/duration/visualDuration springs; must pass unchanged (none are overdamped).

Units convention (keep it): `undampedAngularFreq` is per-millisecond (`millisecondsToSeconds(Math.sqrt(stiffness / mass))`, line 263); the velocity closures return px/ms and call sites convert with `secondsToMilliseconds(...)` before comparing to `restSpeed` (which is per-second).

Code style: this is a shipped library — prioritize small output bytes; prefer `const` arrow closures; no default exports.

## The math (derivation the executor must implement, not re-derive)

For ζ > 1, with D = `initialDelta`, V = `initialVelocity + ζω₀D`, ω_d = `ω₀√(ζ²−1)`:

The current sinh/cosh solution expands exactly to:

- `λ_slow = ω_d − ζω₀` — **compute it as `-ω₀ / (ζ + √(ζ²−1))`** (algebraically equal; the subtraction form catastrophically cancels at large ζ, e.g. ζ = 5000)
- `λ_fast = −ω₀(ζ + √(ζ²−1))`
- `c_slow = (V + ω_d·D) / (2ω_d)`
- `c_fast = D − c_slow`
- Position: `x(t) = target − (c_slow·e^(λ_slow·t) + c_fast·e^(λ_fast·t))`
- Velocity (px/ms): `v(t) = −(c_slow·λ_slow·e^(λ_slow·t) + c_fast·λ_fast·e^(λ_fast·t))`

Both λ are strictly negative, so `e^(λt) ∈ (0, 1]` for t ≥ 0 — no overflow, no cap.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Spring unit tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="generators/__tests__/spring"` | all pass |
| Full motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json` | pass |
| framer-motion client tests | `cd packages/framer-motion && yarn test-client` | pass (pre-existing `use-velocity` flake is known — ignore only that) |
| Build all packages | `yarn build` | exit 0, bundlesize checks pass |
| Module size measurement | `npx terser packages/motion-dom/lib/animation/generators/spring.js -c -m \| wc -c` (after build) | smaller than the pre-change baseline — record both numbers |

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/animation/generators/spring.ts` (lines ~282–426 region only)
- `packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`

**Out of scope** (do NOT touch, even though they look related):
- `findSpring` / `approximateRoot` / `getSpringOptions` / `durationKeys` in the same file — plans 030/033 own those.
- `packages/motion-dom/src/animation/generators/utils/calc-duration.ts` — the 20s `maxGeneratorDuration` cap on WAAPI easing generation is a separate, pre-existing limitation (see Maintenance notes).
- `packages/motion-dom/src/animation/JSAnimation.ts`.

## Git workflow

- Branch: `fix/overdamped-spring-snap-1207` off `main`
- Two commits: (1) failing tests, (2) implementation. Message style: short imperative, e.g. `Fix overdamped springs snapping to target (#1207)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing regression test for #1207

Add to `spring.test.ts` (inside `describe("spring", ...)`):

```ts
test("Overdamped spring does not snap to target mid-animation (#1207)", () => {
    const generator = spring({
        keyframes: [0, 1000],
        stiffness: 4,
        damping: 35,
        mass: 0.5,
    })

    // Exact solution at these times: ~625 at 8594ms, ~630 at 8700ms.
    // The sinh/cosh cap bug made the value lurch to ~989 by 8700ms.
    expect(generator.next(8594).value).toBeCloseTo(625.5, 0)
    expect(generator.next(8700).value).toBeCloseTo(630, 0)
    expect(generator.next(10000).value).toBeCloseTo(681.2, 0)
})
```

**Verify**: run the spring tests → this test FAILS at the 8700ms assertion (current value ≈ 988.87) and the 10000ms assertion (current value = 1000). The 8594ms assertion passes (pre-cap region). If it does not fail this way, STOP.

### Step 2: Add pre-cap equivalence pins for the regions that must NOT change

Add (same describe block):

```ts
test("Overdamped spring pre-cap values are preserved", () => {
    const generator = spring({
        keyframes: [0, 1000],
        stiffness: 4,
        damping: 35,
        mass: 0.5,
    })
    // Values produced by the current implementation in its correct
    // (pre-cap) region — the rewrite must reproduce them.
    expect(generator.next(5000).value).toBeCloseTo(434.88, 1)
    expect(generator.next(8000).value).toBeCloseTo(599.14, 1)
    expect(generator.velocity(5000)).toBeCloseTo(
        spring({
            keyframes: [0, 1000],
            stiffness: 4,
            damping: 35,
            mass: 0.5,
        }).velocity(5000),
        5
    )
})
```

(The velocity self-comparison is a placeholder until the rewrite; replace per Step 5.) Before the rewrite, capture the actual velocity number: add a temporary `console.log(generator.velocity(5000))`, run once, record the value, then hard-code it with `toBeCloseTo(<value>, 1)` and delete the log. The position values above were verified against the analytic solution during planning.

**Verify**: spring tests → this test PASSES against current code (it pins correct behavior).

### Step 3: Rewrite the branch region

Replace spring.ts lines 282–426 (from `let resolveSpring` through the closing of `next:`, keeping `toString` and `toTransition` untouched) with the unified structure:

```ts
    let latest = origin
    let latestVelocity = 0

    /**
     * Each branch computes position and velocity (px/ms) for time t from a
     * single set of Math.exp/sin/cos calls — this runs once per frame on the
     * animation hot path.
     */
    let update: (t: number) => void

    if (dampingRatio < 1) {
        const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio)
        const A =
            (initialVelocity +
                dampingRatio * undampedAngularFreq * initialDelta) /
            angularFreq
        const sinCoeff =
            dampingRatio * undampedAngularFreq * A + initialDelta * angularFreq
        const cosCoeff =
            dampingRatio * undampedAngularFreq * initialDelta - A * angularFreq

        // Underdamped spring
        update = (t: number) => {
            const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t)
            const sin = Math.sin(angularFreq * t)
            const cos = Math.cos(angularFreq * t)

            latest = target - envelope * (A * sin + initialDelta * cos)
            latestVelocity = envelope * (sinCoeff * sin + cosCoeff * cos)
        }
    } else if (dampingRatio === 1) {
        // Critically damped spring
        const C = initialVelocity + undampedAngularFreq * initialDelta

        update = (t: number) => {
            const envelope = Math.exp(-undampedAngularFreq * t)

            latest = target - envelope * (initialDelta + C * t)
            latestVelocity =
                envelope * (undampedAngularFreq * C * t - initialVelocity)
        }
    } else {
        // Overdamped branch — final form given in full below
    }
```

The overdamped branch (the bug fix itself):

```ts
    } else {
        // Overdamped spring — exponential form (no sinh/cosh, no overflow cap)
        const discriminant = Math.sqrt(dampingRatio * dampingRatio - 1)
        const dampedAngularFreq = undampedAngularFreq * discriminant
        // Equal to dampedAngularFreq - dampingRatio * undampedAngularFreq,
        // computed without catastrophic cancellation at large ratios
        const lambdaSlow = -undampedAngularFreq / (dampingRatio + discriminant)
        const lambdaFast = -undampedAngularFreq * (dampingRatio + discriminant)
        const cSlow =
            (initialVelocity +
                dampingRatio * undampedAngularFreq * initialDelta +
                dampedAngularFreq * initialDelta) /
            (2 * dampedAngularFreq)
        const cFast = initialDelta - cSlow

        update = (t: number) => {
            const eSlow = Math.exp(lambdaSlow * t)
            const eFast = Math.exp(lambdaFast * t)

            latest = target - (cSlow * eSlow + cFast * eFast)
            latestVelocity = -(
                cSlow * lambdaSlow * eSlow +
                cFast * lambdaFast * eFast
            )
        }
    }
```

Then the generator object becomes:

```ts
    const generator = {
        calculatedDuration: isResolvedFromDuration ? duration || null : null,
        velocity: (t: number) => {
            update(t)
            return secondsToMilliseconds(latestVelocity)
        },
        next: (t: number) => {
            update(t)

            if (!isResolvedFromDuration) {
                state.done =
                    Math.abs(secondsToMilliseconds(latestVelocity)) <=
                        restSpeed! && Math.abs(target - latest) <= restDelta!
            } else {
                state.done = t >= duration!
            }

            state.value = state.done ? target : latest
            return state
        },
        toString: ... // unchanged
        toTransition: () => {}, // unchanged
    }
```

Delete the now-unused `resolveSpring`/`resolveVelocity` declarations, the hoisted `angularFreq/A/sinCoeff/cosCoeff` lets, and all the old branch bodies. The hoisted-comment block goes too.

**Verify**: `npx tsc -p packages/motion-dom` typechecks (or just run the build in Step 6) and the spring test suite → Step 1's test now PASSES, Step 2's pins PASS, `Overdamped spring`, `Velocity passed to overdamped spring`, all underdamped/critical/velocity/toString tests PASS. The only acceptable failure at this point is `Overdamped spring with very high stiffness/damping` — handled next.

### Step 4: Rewrite the extreme-config test

The old expectation (`[100, 1000]` after 200ms for `stiffness: 1e6, damping: 1e7`) encoded the snap bug — the physically correct spring creeps toward the target over ~70s. Replace the test body (spring.test.ts:94–108) with assertions for what the cap was actually protecting against — overflow/NaN — plus correct creep behavior:

```ts
test("Overdamped spring with very high stiffness/damping stays finite and monotonic", () => {
    const generator = spring({
        keyframes: [100, 1000],
        stiffness: 1000000,
        damping: 10000000,
        restDelta: 1,
        restSpeed: 10,
    })

    let prev = 100
    for (let t = 0; t <= 60000; t += 200) {
        const value = generator.next(t).value as number
        expect(Number.isFinite(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(prev - 1e-6)
        expect(value).toBeLessThanOrEqual(1000)
        prev = value
    }
    // Time constant is damping/stiffness = 10s: ~63% of the way at t=10s
    expect(generator.next(10000).value).toBeGreaterThan(600)
})
```

Note: `next()` is stateful only in `state.done`; calling it with increasing t as above matches real usage. `Number.isFinite` catches both NaN and Infinity.

**Verify**: full spring suite passes.

### Step 5: Finalize the velocity pin in Step 2's test

Replace the placeholder self-comparison with the recorded numeric value from Step 2 if not already done.

**Verify**: spring suite passes.

### Step 6: Full verification + size measurement

**Verify**:
- `npx jest --config packages/motion-dom/jest.config.json` → pass.
- `yarn build` → exit 0, bundlesize checks pass.
- `cd packages/framer-motion && yarn test-client` → pass (springs are exercised broadly here; any failure in animation tests means behavioral drift — STOP and compare values).
- Size: `npx terser packages/motion-dom/lib/animation/generators/spring.js -c -m | wc -c` → record; baseline at `42bfbe3ed` was **4407 bytes min (1681 gzip)**. Expect a decrease (prototype of a weaker version of this design measured 4183/1632). Report both numbers in your completion summary. A small increase is a STOP condition (the design should only shrink the module).

## Test plan

- New: `#1207` regression test (Step 1) — fails on the cap snap, passes with exponential form.
- New: pre-cap equivalence pins for overdamped position + velocity (Step 2).
- Rewritten: extreme stiffness/damping test asserting finite/monotonic/correct-creep (Step 4).
- Unchanged and load-bearing: all underdamped/critically-damped tests, `Velocity passed to *` tests (they compare velocity-vs-no-velocity curves and would catch coefficient sign errors), `toString` exact-string test (catches any underdamped numeric drift), visualDuration tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Spring suite + full motion-dom suite exit 0
- [ ] `cd packages/framer-motion && yarn test-client` exits 0
- [ ] `yarn build` exits 0 (bundlesize gates green)
- [ ] `grep -n "sinh\|cosh\|Math.min(dampedAngularFreq" packages/motion-dom/src/animation/generators/spring.ts` returns no matches
- [ ] Minified module size ≤ 4407 bytes (measured per Step 6) and the number is reported
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's test does not fail in the described way against unmodified code.
- After Step 3, any underdamped/critically-damped test or the `toString` exact-string test fails — those paths must be bit-identical; a failure means the restructure changed shared code it shouldn't have.
- Step 2's pre-cap pins fail by more than the `toBeCloseTo` tolerance — the exponential coefficients are wrong; do not loosen tolerances to pass.
- The minified module grows.
- You find yourself wanting to modify `JSAnimation.ts`, `calc-duration.ts`, or the `findSpring` region.

## Maintenance notes

- **Pre-existing, deliberately untouched**: springs that settle slower than 20s still get truncated on the WAAPI/`linear()` easing path (`maxGeneratorDuration` in `calc-duration.ts`, and `toString()`); and slower than 10s in `pregenerateKeyframes`. After this fix, very slow overdamped springs animate correctly on the JS path but will still hard-stop at 20s if WAAPI-accelerated. If #1207-style configs remain visibly truncated in browsers, that cap is the next thing to look at — file it separately.
- Reviewer should scrutinize: the stable `lambdaSlow` form (the naive `dampedAngularFreq - dampingRatio * undampedAngularFreq` is exactly the cancellation trap), and that `velocity()` units stayed px/ms → converted by `secondsToMilliseconds` at both call sites.
- Plan 033 (findSpring closed form) edits a different region of this file; whichever lands second rebases trivially but must re-run the full spring suite.
- The `update(t)` contract (sets `latest`/`latestVelocity` module-locals) is single-threaded per-generator state; if a future feature needs random-access reads of position AND velocity at different times in one tick, revisit.
