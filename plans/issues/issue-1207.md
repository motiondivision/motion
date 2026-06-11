# Plan issue-1207: Make >20s springs actually finish (JSAnimation Infinity duration), then close #1207 with plan 031

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update (or add) this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/1207 --jq .state` → expect `open`. If closed, STOP.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/JSAnimation.ts packages/motion-dom/src/animation/generators/utils/calc-duration.ts`
>    — if either changed, compare the "Current state" excerpts; mismatch = STOP.
> 3. `grep -c "Math.min(dampedAngularFreq" packages/motion-dom/src/animation/generators/spring.ts`
>    → `1` = plan 031 NOT landed, `0` = landed. Both are fine for Steps 1–4; record it, it gates Step 5.

## Status

- **Classification**: FIX
- **Priority**: P1
- **Effort**: S
- **Risk**: MED (one-condition change in `tick()`, the hottest path in the library)
- **Depends on**: `plans/031-overdamped-spring-exponential-form.md` for *closing the issue* (Step 5 only); Steps 1–4 are independent and can land first
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1207

## Why this matters

Issue #1207 (2021): a slow overdamped spring (`stiffness: 4, damping: 35,
mass: 0.5`) "suddenly accelerates to snap to the end" mid-animation. The audit
found **two** defects behind this:

1. **The visual snap** — the overdamped branch caps `sinh`/`cosh` inputs at 300
   (`spring.ts:344`), killing the envelope cancellation at `t ≈ 300/ωd` (8.6s for
   this config; generator reads 98.9% at t=8700ms where exact physics says 63.0%).
   Owned by **plan 031**. Do NOT re-fix it here.
2. **A completion bug this plan fixes**: any generator whose natural settle
   exceeds 20s gets `calculatedDuration = Infinity` from `calcGeneratorDuration`,
   and `tick()` then *overrides the generator's own `done` flag* with
   `currentTime >= totalDuration` — never true for `Infinity`. The animation
   never finishes: `state` stays `"running"`, the driver never stops, `onComplete`
   never fires, the `finished` promise never resolves. Verified empirically at
   `42bfbe3ed` with a generator settling at 25s: still `"running"` after 60s.

Defect 2 is masked for #1207's config today only because defect 1 makes the
buggy spring "settle" early (8.75s). **Once 031 lands, this config genuinely
takes ~46–66s to settle, hits the Infinity path, and every such animation
hangs.** Land this before or with 031.

## Current state

- `packages/motion-dom/src/animation/generators/utils/calc-duration.ts:7-19` —
  `maxGeneratorDuration = 20_000`; samples `generator.next()` in 50ms steps and
  `return duration >= maxGeneratorDuration ? Infinity : duration` — **Infinity,
  not 20000**, when the cap is hit.
- `packages/motion-dom/src/animation/JSAnimation.ts:165-172` — that value becomes
  `this.calculatedDuration` and `this.totalDuration`.
- `packages/motion-dom/src/animation/JSAnimation.ts:321-328` — **the bug**:
  ```ts
  let { done } = state

  if (!isInDelayPhase && calculatedDuration !== null) {
      done =
          this.playbackSpeed >= 0
              ? this.currentTime >= totalDuration
              : this.currentTime <= 0
  }
  ```
- Tests live in `packages/motion-dom/src/animation/__tests__/JSAnimation.test.ts`
  (`noop` already imported there). **Warning**: `syncDriver` from `./utils` runs
  `while (isRunning)` in `start()` — driving a never-finishing animation with it
  is an infinite synchronous loop that hangs Jest. Use the bounded manual driver
  below.
- `JSAnimation` accepts `type` as a `GeneratorFactory` function or the string
  `"spring"` (`replaceTransitionType`, called at JSAnimation.ts:106).

## Commands you will need

| Purpose | Command (from repo root) | Expected |
|---------|--------------------------|----------|
| Target tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="animation/__tests__/JSAnimation"` | pass (after fix) |
| Full motion-dom suite | `npx jest --config packages/motion-dom/jest.config.json` | pass |
| framer-motion client | `cd packages/framer-motion && yarn test-client` | pass (known `use-velocity` flake) |
| Build | `yarn build` | exit 0 |
| Close issue (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/1207 -f state=closed -f state_reason=completed` | closed |

## Scope

**In scope** (only files you may modify):
- `packages/motion-dom/src/animation/JSAnimation.ts` (lines 321-328 condition only)
- `packages/motion-dom/src/animation/__tests__/JSAnimation.test.ts`

**Out of scope**:
- `spring.ts` — plan 031 owns the math fix.
- `calc-duration.ts` / `create-generator-easing.ts` — the 20s WAAPI/`linear()`
  truncation is a separate documented limitation (Maintenance notes).
- `repeat` with Infinity duration (`elapsed` becomes `0 * Infinity = NaN` at
  JSAnimation.ts:301) and `speed < 0` with Infinity — pre-existing, pathological,
  unreported. Note, don't fix.

## Git workflow

- Branch: `fix/1207-infinite-duration-completion` off `main`
- Two commits: (1) failing test, (2) fix + integration test, e.g.
  `Fix JSAnimation never finishing when generator duration exceeds 20s (#1207)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing test

Add to `JSAnimation.test.ts` inside `describe("JSAnimation", ...)`:

```ts
test("Finishes when generator settles after maxGeneratorDuration (#1207)", () => {
    // Settles at 25s — past the 20s cap, so calcGeneratorDuration returns Infinity
    const slowGenerator = () => ({
        calculatedDuration: null,
        next: (t: number) => ({
            done: t >= 25000,
            value: t >= 25000 ? 100 : (t / 25000) * 100,
        }),
    })

    let tick: (t: number) => void = noop
    let now = 0
    const driver = (update: (t: number) => void) => {
        tick = update
        return { start: noop, stop: noop, now: () => now }
    }

    let completed = false
    const animation = new JSAnimation({
        keyframes: [0, 100],
        type: slowGenerator as any,
        driver,
        onComplete: () => (completed = true),
    })

    for (now = 0; now <= 40000 && !completed; now += 100) tick(now)

    expect(completed).toBe(true)
    expect(animation.state).toBe("finished")
})
```

**Verify**: run the target tests → FAILS with `completed === false` /
`state === "running"` (this is the verified current behavior at `42bfbe3ed`).
If it passes against unmodified code, STOP — drift.

### Step 2: Fix the `done` override in `tick()`

At `JSAnimation.ts:323`, only let the time comparison override the generator's
`done` when the duration is finite:

```ts
if (
    !isInDelayPhase &&
    calculatedDuration !== null &&
    calculatedDuration !== Infinity
) {
```

(Not global `isFinite` — it coerces `null` to `0` → `true`.) Nothing else
changes: with Infinity, `done` keeps the generator's `state.done`; the existing
`isAnimationFinished` branch applies `getFinalKeyframe` and calls `finish()`.

**Verify**: Step 1's test passes; the full JSAnimation suite passes (finite-path
behavior untouched).

### Step 3: Add the #1207-config integration test

Same bounded-driver pattern; the reporter's exact spring:

```ts
test("Slow overdamped spring completes and reaches target (#1207)", () => {
    // driver/tick/now boilerplate as in Step 1
    let completed = false
    let latest = 0
    const animation = new JSAnimation({
        keyframes: [0, 1000],
        type: "spring",
        stiffness: 4,
        damping: 35,
        mass: 0.5,
        driver,
        onUpdate: (v: number) => (latest = v),
        onComplete: () => (completed = true),
    })

    for (now = 0; now <= 120000 && !completed; now += 50) tick(now)

    expect(completed).toBe(true)
    expect(animation.state).toBe("finished")
    expect(latest).toBe(1000)
})
```

Must pass in both 031-states: pre-031 the buggy spring settles ~8.75s (finite
path); post-031 it settles ~66s (defaults `restDelta: 0.5`/`restSpeed: 2` at
delta 1000), `calculatedDuration === Infinity`, and this test is the end-to-end
regression gate for #1207 (without Step 2 it fails with `completed === false`).

**Verify**: test passes; then full motion-dom suite and
`cd packages/framer-motion && yarn test-client` → pass.

### Step 4: Build gate

**Verify**: `yarn build` → exit 0, bundlesize green.

### Step 5: Gated issue close

Close #1207 as `completed` ONLY when BOTH:
1. This plan's row in `plans/issues/README.md` is **APPROVED**, AND
2. Plan 031's row in `plans/README.md` is **DONE** (the visual snap is the
   reported symptom; this plan alone doesn't fix it).

Then comment on #1207 (two-part fix: overdamped exponential form via 031 +
Infinity-duration completion here) and run the close command from the table.
Otherwise set this plan's row to BLOCKED with the missing precondition and stop.
(`gh pr edit` is broken on this repo — use `gh api -X PATCH` for PR metadata too.)

## Test plan

- Step 1: failing test — Infinity-duration generator must finish (fails today for
  the right reason: the `done` override vs `Infinity`).
- Step 3: integration regression with the reporter's exact config.
- Load-bearing existing coverage that must stay green: `Correctly pauses` /
  `Correctly resumes` / repeat tests (all finite-duration), `spring.test.ts`.

## Done criteria

- [ ] Step 1 test failed before the fix (note it in the commit), passes after
- [ ] Step 3 test passes; both Jest suites and `yarn build` exit 0
- [ ] `git diff main --stat` touches only the two in-scope files
- [ ] Issue closed only under Step 5's double gate; README row updated

## STOP conditions

- Step 1's test passes against unmodified code.
- After Step 2 any existing JSAnimation/spring test fails — the change leaked
  into the finite path; do not "fix" tests to match.
- You find yourself editing `spring.ts` (plan 031's territory).
- Issue already closed at drift-check.

## Maintenance notes

- **Deliberately deferred**: springs settling slower than 20s are still
  hard-truncated on the WAAPI path (`createGeneratorEasing` clamps to
  `maxGeneratorDuration`; `ease(1)` lands at ~90% for this config and the final
  keyframe snaps the rest at t=20s). After 031 + this plan the JS path is fully
  correct; if browsers still show an end-of-animation snap on transform/opacity
  springs, fix `create-generator-easing.ts` / the WAAPI decision — file separately.
- The 2025 comment on #1207 about "time-based spring" jitter is NOT covered:
  duration-resolved springs are capped at 10s by `findSpring` and never hit this
  path. If it persists, it needs its own issue.
- Reviewer scrutiny: the `!== Infinity` form, and that repeat/reverse with
  Infinity remains explicitly out of scope.
