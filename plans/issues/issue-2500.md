# Plan issue-2500: Verify pause/play-with-delay jump is fixed, pin with regression tests, close as fixed

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2500 --jq .state` → expect `open`. If closed, STOP.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/JSAnimation.ts`
>    — on drift, compare the "Current state" excerpts; mismatch = STOP.

## Status

- **Classification**: VERIFY-FIXED
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (adds two passing regression tests; no production code change)
- **Depends on**: none
- **Category**: bug (historical) / tests
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2500

## Why this matters

Reported Jan 2024 (framer-motion v10/v11 era): with `useAnimate` +
`AnimationPlaybackControls`, `pause()` then `play()` on an animation created
with `delay > 0` makes it "jump back in time rather than strictly pausing and
resuming".

**Root cause (historical, verified by reading old tags)**: through `v12.0.0`
(`MainThreadAnimation.ts:485-492`), `pause()` did `this.holdTime =
this.currentTime ?? 0`, where `currentTime` had been mutated by the previous
`tick()` to the **delay-subtracted** value. `play()` computed
`startTime = now - holdTime`, treating `holdTime` as **delay-inclusive** raw
time — so every pause→play cycle rewound the animation by `delay` ms (same shape
in `v10.18.0`, `animators/js/index.ts:358-361`).

**Fix**: commit `48d3169c7` ("Refactor animation APIs", first in
`v12.7.5-alpha.0`) made `pause()` recompute the raw clock first. Verified
empirically at `42bfbe3ed` (`delay: 1000, duration: 2000`, manual driver): pause
at value 25 → resumes at 25, completes on schedule; pausing mid-delay also
resumes correctly. The WAAPI path (`NativeAnimation.pause/play`,
`packages/motion-dom/src/animation/NativeAnimation.ts:128-141`) delegates to the
native `Animation`, which handles delay itself. No Jest coverage combines
pause/play with delay (existing `Correctly pauses`/`Correctly resumes`,
`JSAnimation.test.ts:975-1025`, use no delay) — this plan pins it.

## Current state

`packages/motion-dom/src/animation/JSAnimation.ts`:

```ts
// JSAnimation.ts:478-482
pause() {
    this.state = "paused"
    this.updateTime(time.now())   // recomputes delay-INCLUSIVE raw time from startTime
    this.holdTime = this.currentTime
}
```

```ts
// JSAnimation.ts:457-458 (inside play()) — consistent with the above
} else if (this.holdTime !== null) {
    this.startTime = now - this.holdTime
```

`tick()` subtracts delay after `updateTime`, per frame (JSAnimation.ts:236-242).

## Commands you will need

| Purpose | Command (from repo root) | Expected |
|---|---|---|
| JSAnimation tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="animation/__tests__/JSAnimation"` | pass |
| Close issue (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2500 -f state=closed -f state_reason=completed` | closed |

## Scope

**In scope**: `packages/motion-dom/src/animation/__tests__/JSAnimation.test.ts` (two new tests).
**Out of scope**: any production code; the `time` getter's transient
delay-inclusive readout right after `pause()` (Maintenance notes); WAAPI
controls (native behavior, untestable in JSDOM).

## Steps

### Step 1: Add the two regression tests

Model on "Correctly resumes" (`JSAnimation.test.ts:1000`): `syncDriver(20)`,
`animateValue`, pause/play by `onUpdate` call count, resolve via `onComplete`.
Both expected arrays were **validated against `42bfbe3ed` during planning** by
replaying exact `syncDriver(20)` semantics; on any pre-`48d3169c7` build they
fail by rewinding `delay` ms after `play()`.

Test A — `"Resuming after pause respects delay (#2500)"`:
`keyframes: [0, 100], duration: 100, delay: 100, ease: "linear"`;
`animation.pause()` when `output.length === 8`, `animation.play()` when
`output.length === 12`; on complete expect:

```ts
expect(output).toEqual([0, 0, 0, 0, 0, 0, 20, 40, 40, 40, 40, 40, 60, 80, 100])
```

(6 delay frames → animate to 40 → hold through pause → resume 60→100, no rewind.)

Test B — `"Resuming after pause during the delay phase respects delay (#2500)"`:
same options; `pause()` at `output.length === 3`, `play()` at
`output.length === 7`; expect:

```ts
expect(output).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20, 40, 60, 80, 100])
```

**Verify**: JSAnimation suite passes including both new tests. If either FAILS,
the bug is live/regressed — STOP, report the actual array, do NOT close.

### Step 2: Gated comment + close

ONLY after this plan's row in `plans/issues/README.md` is marked **APPROVED**:
comment on #2500 (rewind came from `pause()` storing delay-exclusive
`currentTime` as the hold time while `play()` treated it as delay-inclusive;
fixed by `48d3169c7`, released v12.7.5; now pinned by regression tests;
upgrading to a current release resolves it), then run the close command. If not
APPROVED, set the row to BLOCKED("awaiting close approval") and stop.

## Done criteria

- [ ] Both tests pass; full JSAnimation suite green
- [ ] No production files modified (`git status`)
- [ ] Close performed only under an APPROVED row; README row updated

## STOP conditions

- Either new test fails — live bug; becomes a FIX investigation, report back.
- The `pause()`/`play()` excerpts no longer match the working tree.
- Issue already closed at drift-check.

## Maintenance notes

- Known residual inconsistency (unreported — do NOT fix here): the `time` getter
  returns delay-inclusive time between `pause()` and the next `tick()` (e.g.
  `1.5`) but delay-exclusive after a tick (`0.5`), while the `time` setter stores
  `holdTime` as delay-inclusive — a `controls.time = controls.time` round-trip
  while paused can shift playback by `delay`. If reported, normalize
  `currentTime` bookkeeping to one convention inside `JSAnimation`.
- These tests are the only pause/resume × delay coverage; keep them green when
  the delay-rebase logic in `tick()` (lines 236-247) is next touched.
