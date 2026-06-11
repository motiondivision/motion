# Plan issue-2494: Verify >20s sequences are no longer truncated, pin with a regression test, close as fixed

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2494 --jq .state` → expect `open`. If closed, STOP.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/animation/sequence/create.ts`
>    — on drift, re-check "Current state"; mismatch = STOP.

## Status

- **Classification**: VERIFY-FIXED
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (adds one passing regression test; no production code change)
- **Depends on**: none
- **Category**: bug (historical) / tests
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2494

## Why this matters

Reported Jan 2024 against **framer-motion 10.18.0** (repro repo
`Rkaede/poopity-scoop`, fetched during planning): a ~23.9s `animate(sequence)`
timeline, scrubbed via `controls.time = audio.currentTime`, "bugs out" once time
passes 20s — including scrubbing back. Every segment animates
`{ scale: [1, 1.3, 1], backgroundColor: <hex> }` with
`{ at: <5.27..23.7>, type: "spring", duration: 0.2 }`.

**Root cause (historical, verified by reading the `v10.18.0` tag)**: in
`v10.18.0:packages/framer-motion/src/animation/animators/waapi/create-accelerated-animation.ts`,
`backgroundColor` was in `acceleratedValues` and `requiresPregeneratedKeyframes()`
forced whole-timeline sampling with a hard bail:
`const maxDuration = 20_000` / `while (!state.done && t < maxDuration)` — every
backgroundColor WAAPI animation in a >20s sequence was silently cut at 20s.
That path no longer exists at `42bfbe3ed`: `background-color` is commented out of
`packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts`, the
pregeneration loop has no modern equivalent (`grep -rn "pregenerateKeyframes"
packages/*/src --include="*.ts"` matches only the unused definition), and WAAPI
easing now uses uncapped `linear()` strings (`waapi/easing/map-easing.ts`).

## Current state

`packages/framer-motion/src/animation/sequence/create.ts` has no 20s clamp:
`totalDuration = Math.max(targetTime, totalDuration)` (line 323) and the
per-value transition gets the full length (lines 448-454):

```ts
definition.transition[key] = {
    ...remainingDefaultTransition,
    duration: totalDuration,
    ease: valueEasing,
    times: valueOffset,
    ...sequenceTransition,
}
```

Test-design notes: 3-keyframe segments (`[1, 1.3, 1]`) skip spring conversion
(`numKeyframes <= 2 && createGenerator` guard, line 138); 2-keyframe spring
segments go through `createGeneratorEasing` (line 163) — a `duration: 0.2`
spring resolves finitely (the 20s `maxGeneratorDuration` clamp there only bites
non-settling springs; that pathology is owned by `plans/issues/issue-1207.md` /
plan 031). Exemplar tests:
`packages/framer-motion/src/animation/sequence/__tests__/index.test.ts`
(imports `createAnimationsFromSequence` from `../create`); sampling exemplar:
`JSAnimation.test.ts:866` ("Correctly samples with custom negative elapsed").

## Commands you will need

| Purpose | Command (from repo root) | Expected |
|---|---|---|
| Sequence tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="sequence"` | pass |
| Close issue (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2494 -f state=closed -f state_reason=completed` | closed |

## Scope

**In scope**: `packages/framer-motion/src/animation/sequence/__tests__/index.test.ts` (one new test).
**Out of scope**: any production code; the `createGeneratorEasing` 20s clamp; the removed WAAPI path (JSDOM can't run it anyway).

## Steps

### Step 1: Add the regression test

```ts
test("Sequences longer than 20s are not truncated (#2494)", () => {
    const mv = motionValue(1)
    const animations = createAnimationsFromSequence(
        [
            [mv, [1, 1.3, 1], { at: 5, type: "spring", duration: 0.2 }],
            [mv, [1, 1.3, 1], { at: 22.8, type: "spring", duration: 0.2 }],
        ],
        undefined,
        undefined,
        { spring }
    )

    const { duration, times } = animations.get(mv)!.transition.default
    // Full length preserved — a 20s cap would clamp this to 20
    expect(duration).toBeCloseTo(23)
    expect(times![times!.length - 1]).toBe(1)
    expect(times![times!.length - 2]).toBeCloseTo(22.9 / 23, 4)
})
```

Then, same test, sample the definition past 20s through the real JS playback
path: build a `JSAnimation` from it (`keyframes: ...keyframes.default`,
`duration` converted to ms, `times`, `ease`; all keyframes are numeric here —
the last segment ends exactly at `totalDuration` so no trailing `null` wildcard
is appended) and assert `animation.sample(22900).value` is mid-flight (≈1.2,
between 1 and 1.3) and `animation.sample(20000).value` is 1 (resting between
segments). If any generated keyframe is `null`, STOP — structural assumptions
changed.

**Verify**: sequence suite passes including the new test. If the new test
FAILS, the bug is live — STOP and report (this becomes a FIX plan; do NOT close).

### Step 2: Gated comment + close

ONLY after this plan's row in `plans/issues/README.md` is marked **APPROVED**:
comment on #2494 (truncation came from v10's accelerated-animation keyframe
pregeneration `maxDuration = 20_000` bail, removed in the v11/v12 pipeline;
>20s sequences now play/scrub correctly and a regression test pins it), then run
the close command. If not APPROVED, set the row to
BLOCKED("awaiting close approval") and stop.

## Done criteria

- [ ] New test passes; full sequence suite green
- [ ] No production files modified (`git status`)
- [ ] Close performed only under an APPROVED row; README row updated

## STOP conditions

- The new test fails (live bug — report the failing values; do NOT close).
- Generated keyframes/times don't match the traced structure (create.ts drifted).
- Issue already closed at drift-check.

## Maintenance notes

- Residual relative: a 2-keyframe *non-settling* spring segment (>20s physics
  config) still hard-cuts at 20s via `createGeneratorEasing` — same
  `maxGeneratorDuration` family as issue-1207's notes. Unreported for sequences;
  revisit only on report.
- If sequence scrubbing bugs resurface in browsers (not JSDOM), suspect the
  `linear()` easing string size for long durations (`generateLinearEasing` emits
  duration/10ms points, ~2400 at 24s) — needs an E2E (CLAUDE.md Cypress recipe).
