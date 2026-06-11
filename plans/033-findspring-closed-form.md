# Plan 033: Replace findSpring's Newton-Raphson solver with the exact closed form (~−1kB min)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/generators/spring.ts packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`
> Plans 030 (one-line `durationKeys` change) and 031 (generator-branch rewrite,
> lines 282–426) are expected to land before this one — that drift is fine and
> does not touch this plan's region (lines 50–162). Any OTHER drift in
> `findSpring`/`approximateRoot`/`getSpringOptions`: compare against "Current
> state"; on mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches duration-resolved spring feel; gated by equivalence tolerance)
- **Depends on**: 030 and 031 (soft — same file; land them first to avoid rebase churn)
- **Category**: perf/size (tech-debt)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`findSpring` converts `duration`+`bounce` spring options into stiffness/damping using a 12-iteration Newton-Raphson root-finder with hand-ported envelope/derivative functions — **~1.1 kB minified / ~360 B gzip** of the spring module's 4.4 kB / 1.7 kB (measured with terser on the compiled module at `42bfbe3ed`). The iteration machinery exists to handle nonzero initial velocity, but the only call site hardcodes `velocity: 0` (`findSpring({ ...options, velocity: 0 })`, a deliberate change — time-defined springs ignore inherited velocity). With velocity pinned to zero, the root has an **exact closed form**, verified numerically during planning:

- Underdamped (ζ < 1): solve `safeMin = (ζ/√(1−ζ²))·e^(−ζωT)` → `ω = ln(ζ / (safeMin·√(1−ζ²))) / (ζT)`
- Critically damped (ζ = 1): solve `e^(−u)(u+1) = safeMin` for `u = ωT` → constant `u ≈ 9.2334134764516` → `ω = u/T`

Across a grid of durations 10ms–10s × bounce 0–0.95, the closed form agrees with the Newton-Raphson output within **0.17% relative stiffness** (worst case at bounce=0; the closed form is the *exact* root — the difference is NR truncation error, since NR's derivative at ζ=1 converges slowly). This is below visual perceptibility, but it IS a numeric change to duration-spring curves, so this plan carries hard equivalence gates and snapshot scrutiny.

This was originally scoped as a doc-only spike on the assumption the replacement would change feel; the velocity-is-always-zero discovery upgrades it to an implementation plan. **If the equivalence gates fail, fall back to producing the comparison doc** (STOP conditions).

## Current state

All in `packages/motion-dom/src/animation/generators/spring.ts`, lines 50–162 at `42bfbe3ed`:

```ts
// spring.ts:50-52
function calcAngularFreq(undampedFreq: number, dampingRatio: number) {
    return undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio)
}

// spring.ts:54-65
const rootIterations = 12
function approximateRoot(
    envelope: (num: number) => number,
    derivative: (num: number) => number,
    initialGuess: number
): number { ... }

// spring.ts:70
const safeMin = 0.001

// spring.ts:72-162 — findSpring: warning, clamps, envelope/derivative pairs for
// underdamped and critically-damped cases, NR iteration, isNaN fallback
```

The single call site (spring.ts:207, inside `getSpringOptions`):

```ts
const derived = findSpring({ ...options, velocity: 0 })
```

`findSpring` returns `{ stiffness, damping, duration }` where `stiffness = ω²·mass`, `damping = ζ·2·√(mass·stiffness)`, duration in ms. Note `mass` defaults to 1 and physics keys override duration keys upstream, but `findSpring` still reads `mass` from options — preserve that. Note: `calcAngularFreq` is ALSO used by the generator branches (after plan 031 it remains used in the underdamped branch) — keep the function, only `approximateRoot` and the envelope/derivative machinery go.

The `isNaN(undampedFreq)` fallback (spring.ts:148-153, returns default stiffness/damping) exists because NR can diverge; the closed form cannot produce NaN given the existing clamps (ζ ∈ [0.05, 1], T ∈ [0.01, 10], log argument > 1) — the fallback becomes dead code and should be removed.

Pinned behavior in `__tests__/spring.test.ts`:
- `Spring defined with bounce and duration is same as just bounce` (line 127)
- `Time-defined spring ignores velocity` (line 144), `Time-defined spring with velocity does not wildly oscillate` (line 161)
- `toString → returns correct string` (line 255) — contains an exact `linear(...)` string for `duration: 800, bounce: 0.25`: **the load-bearing equivalence check**. Values are rounded to 4 decimals; 0.17% worst-case drift may flip late decimals, mostly at bounce 0.
- visualDuration tests (updated by plan 030) do NOT go through `findSpring` — different branch.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Spring unit tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="generators/__tests__/spring"` | all pass |
| Full motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json` | pass |
| framer-motion client tests | `cd packages/framer-motion && yarn test-client` | pass |
| Build | `yarn build` | exit 0, bundlesize gates pass |
| Size measurement | `npx terser packages/motion-dom/lib/animation/generators/spring.js -c -m \| wc -c` (after build) | substantially below baseline (4407 B at `42bfbe3ed`; ~4180 B expected after plan 031) |

## Scope

**In scope**:
- `packages/motion-dom/src/animation/generators/spring.ts` — lines 50–162 region only (`approximateRoot`, `findSpring` internals, `rootIterations`, `safeMin` usage)
- `packages/motion-dom/src/animation/generators/__tests__/spring.test.ts` — equivalence test additions; snapshot-string updates ONLY under the rule in Step 4

**Out of scope** (do NOT touch):
- `getSpringOptions`, `durationKeys`, the generator branches, `toString` — owned by plans 030/031.
- `calcAngularFreq` — still used by the underdamped generator branch.
- The `warning(duration <= 10s)` call and the existing clamps — keep them verbatim.
- Any change to the `velocity: 0` hardcoding at the call site — it is the precondition making this exact.

## Git workflow

- Branch: `refactor/findspring-closed-form`
- Commit 1: equivalence pins; commit 2: replacement. Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Pin current behavior with a tolerance-based equivalence test

Add to `spring.test.ts`:

```ts
describe("duration-based spring resolution", () => {
    test("derived stiffness matches expected values", () => {
        // Pins findSpring output across the option grid. Tolerance is 0.2%
        // relative: the closed-form replacement is the exact root of the same
        // envelope equation; Newton-Raphson carries up to ~0.17% truncation
        // error at bounce=0. Values must NOT drift more than that.
        const grid: Array<[number, number]> = [
            [100, 0], [100, 0.25], [100, 0.5], [100, 0.9],
            [800, 0], [800, 0.25], [800, 0.5], [800, 0.9],
            [3000, 0], [3000, 0.25], [3000, 0.5], [3000, 0.9],
            [10000, 0], [10000, 0.25], [10000, 0.5], [10000, 0.9],
        ]
        for (const [duration, bounce] of grid) {
            const generator = spring({ keyframes: [0, 100], duration, bounce })
            expect(generator.next(duration / 2).value).toBeCloseTo(
                EXPECTED[`${duration}-${bounce}`],
                1
            )
        }
    })
})
```

Populate `EXPECTED` by running the grid against the CURRENT code first (temporary `console.log`, then hard-code; the planner's verified approach). Mid-animation sampling at `duration/2` is deliberately the most drift-sensitive single probe (per CLAUDE.md's mid-animation testing guidance).

**Verify**: test passes against unmodified code.

### Step 2: Replace the solver

In `spring.ts`, delete `approximateRoot` and `rootIterations`, and rewrite `findSpring` keeping its exact signature, warning, clamps, and return shape:

```ts
function findSpring({
    duration = springDefaults.duration,
    bounce = springDefaults.bounce,
    mass = springDefaults.mass,
}: SpringOptions) {
    warning(
        duration <= secondsToMilliseconds(springDefaults.maxDuration),
        "Spring duration must be 10 seconds or less",
        "spring-duration-limit"
    )

    let dampingRatio = clamp(
        springDefaults.minDamping,
        springDefaults.maxDamping,
        1 - bounce
    )
    const durationSeconds = clamp(
        springDefaults.minDuration,
        springDefaults.maxDuration,
        millisecondsToSeconds(duration)
    )

    /**
     * Closed-form root of the settle envelope (velocity is always zero here —
     * see the findSpring call site). For the underdamped case solve
     * safeMin = (ζ/√(1−ζ²))·e^(−ζωT) for ω; for the critically damped case
     * e^(−ωT)(ωT+1) = safeMin has the constant root ωT ≈ 9.2334.
     */
    const undampedFreq =
        dampingRatio < 1
            ? Math.log(
                  dampingRatio /
                      (safeMin * Math.sqrt(1 - dampingRatio * dampingRatio))
              ) /
              (dampingRatio * durationSeconds)
            : 9.2334134764516 / durationSeconds

    const stiffness = undampedFreq * undampedFreq * mass
    return {
        stiffness,
        damping: dampingRatio * 2 * Math.sqrt(mass * stiffness),
        duration: secondsToMilliseconds(durationSeconds),
    }
}
```

Notes:
- Drop the `velocity` param entirely (the call site may keep passing it; it's ignored — alternatively remove `velocity: 0` at the call site ONLY if plan 030/031 haven't put that line in motion; otherwise leave the call site alone).
- The `isNaN` fallback is removed — it is unreachable with the closed form (log argument is ≥ `0.05/(0.001·1)` = 50 at the ζ clamp floor... at ζ=0.05: `0.05/(0.001·0.99875)` ≈ 50 > 1, and at ζ→1⁻ the argument grows; T ∈ [0.01, 10] keeps the quotient finite).
- Keep `let dampingRatio` as `const` if nothing reassigns it after the clamp (style: prefer const).

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="generators/__tests__/spring"` → Step 1's equivalence grid passes within tolerance. The `Spring defined with bounce and duration is same as just bounce`, `Time-defined spring *` tests pass unchanged.

### Step 3: Handle the exact-string toString test

Run the full spring suite. The `toString → returns correct string` test's `durationSpring` string (`duration: 800, bounce: 0.25`) may differ in late decimals.

Rule: if the string changed, regenerate it (log the new `toString()` output, paste it in) **only after** confirming Step 1's tolerance test passes — the tolerance test is the semantic gate; the string is a pin, not a spec. Add a comment above the updated string: `// Regenerated for the closed-form findSpring (plan 033); curve change ≤0.2% vs Newton-Raphson.` If `physicsSpring` or `visualDurationSpring` strings changed, that's a STOP (those paths must not be affected).

**Verify**: full spring suite passes.

### Step 4: Full verification + size measurement

**Verify**:
- `npx jest --config packages/motion-dom/jest.config.json` → pass.
- `cd packages/framer-motion && yarn test-client` → pass. Any failing test that pins a duration-spring curve: apply the Step 3 rule (tolerance first, then regenerate, with comment). Any failing test on physics/visualDuration springs: STOP.
- `yarn build` → exit 0.
- `npx terser packages/motion-dom/lib/animation/generators/spring.js -c -m | wc -c` → expect roughly **900–1100 bytes below** the pre-change measurement (take a baseline measurement before Step 2 on the built main). Report before/after min and gzip (`... | gzip -c | wc -c`) numbers.
- Optionally suggest (do not apply) tightened `bundlesize` budgets in the completion report.

## Test plan

- New: 16-point duration×bounce equivalence grid with 0.2%-class tolerance (Step 1) — written against OLD code, must pass against NEW code. This is the contract that "no feel change" holds.
- Updated (conditionally): `durationSpring` exact string (Step 3 rule).
- Unchanged: every other spring test, including velocity-ignoring tests for time-defined springs.

## Done criteria

ALL must hold:

- [ ] Spring suite + full motion-dom suite exit 0
- [ ] `cd packages/framer-motion && yarn test-client` exits 0
- [ ] `yarn build` exits 0
- [ ] `grep -n "approximateRoot\|rootIterations" packages/motion-dom/src/animation/generators/spring.ts` returns no matches
- [ ] Minified module ≥800 bytes smaller than the immediately-prior baseline; numbers reported
- [ ] Step 1's equivalence test passed against BOTH old and new code (state this explicitly)
- [ ] No out-of-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any grid point in Step 1's test diverges beyond its `toBeCloseTo` precision after the replacement — do NOT widen the tolerance; the premise (NR truncation ≤ ~0.17%) would be wrong. Fall back: keep the code unchanged and write `plans/033-findspring-closed-form-FINDINGS.md` documenting the measured divergence grid — that doc is the original spike deliverable and a valid completion.
- The `physicsSpring` or `visualDurationSpring` toString strings change — closed form must only affect duration-resolved springs.
- `getSpringOptions` no longer calls `findSpring({ ...options, velocity: 0 })` (the velocity-zero precondition was removed by drift) — the closed form is then invalid for nonzero velocity.
- Size reduction is under 500 bytes min — the win didn't materialize; report instead of landing.

## Maintenance notes

- **The closed form is only valid because velocity is hardcoded to 0** at the call site. If duration-resolved springs ever need to honor initial velocity again, the root-finder (or a velocity-aware closed form) must come back — leave the derivation comment in the code so this is discoverable.
- The critical-damping constant `9.2334134764516` is the root of `e^(−u)(u+1) = 0.001` (`safeMin`); if `safeMin` ever changes, this constant must be re-derived (Newton iteration on that scalar equation, or solve once in a REPL).
- Reviewer should scrutinize: that clamps and the 10s warning survived verbatim; the comment explaining the constant; the equivalence-test methodology (old-code-pinned, not new-code-pinned).
- Changelog: note as internal refactor; duration+bounce spring curves may shift imperceptibly (≤0.2% stiffness, now exact rather than approximated).
