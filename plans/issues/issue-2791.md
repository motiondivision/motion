# Plan issue-2791: Reproduce-or-close NaN when spring-animating polygon points (defer to plan 032)

> **Executor instructions**: This issue already has a full investigation plan:
> `plans/032-spring-complex-value-nan-investigation.md`. Execute THAT plan; this
> file only records the triage classification, planner findings that 032 predates,
> and the gated close path. Update the status row for this plan in
> `plans/issues/README.md` (NOT `plans/README.md`) when done.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2791 --jq .state` → expect `"open"`. If closed, mark DONE and stop.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/utils/mix packages/motion-dom/src/animation/JSAnimation.ts packages/motion-dom/src/value/index.ts` — on any change, re-verify the excerpts below before acting; mismatch = STOP.

## Status

- **Classification**: NEEDS-REPRO
- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (investigation-gated; repo policy: no repro → no fix)
- **Depends on**: plans/032-spring-complex-value-nan-investigation.md (execution vehicle)
- **Category**: bug (unconfirmed mechanism)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2791

## Why this matters / verdict

Spring-animating a `<polygon>`'s `points` reportedly writes NaN point lists (Sep 2024,
framer-motion 11.x). The mechanism could NOT be pinned statically at `42bfbe3ed`, and the
reproduction is unreachable, so per repo policy this is NEEDS-REPRO: run plan 032's
reproduce-first ladder; if no layer fails, close gated.

## Planner findings (new since plan 032 was written — feed into its Steps 1–3)

- **Repro fetch already attempted and failed**: `https://codesandbox.io/api/v1/sandboxes/5mwd29`
  → HTTP 403; `https://codesandbox.io/p/sandbox/pensive-khayyam-5mwd29` → blank page (JS app).
  The issue body contains no code, only the link. Plan 032 Step 1's "STOP and ask" branch is the
  likely entry state — ask the operator/reporter for the polygon JSX + exact `points` strings.
- **The leading "mismatched token count + spring overshoot" hypothesis was tested and does NOT
  produce NaN.** Against the built package at `42bfbe3ed`:
  - `mixComplex("0,0 10,10 20,20", "0,0 100,100")(1.2)` → `"0,0 118,118"` (origin longer:
    extrapolates finitely; `matchOrder` in `packages/motion-dom/src/utils/mix/complex.ts:79-98`
    pads with `?? 0`).
  - `mixComplex("0,0 10,10", "0,0 100,100 200,200")(0.5)` → `"0,0 100,100 200,200"` (origin
    shorter: `canInterpolate` fails at `complex.ts:107-110`, falls to `mixImmediate`, which is
    `(p) => (p > 0 ? b : a)` — `packages/motion-dom/src/utils/mix/immediate.ts:1-3` — an instant
    flip plus the "too different to mix" warning, never NaN).
- **New candidate to probe while reproducing — bogus string velocity**:
  `isFloat` (`packages/motion-dom/src/value/index.ts:43-45`) is `!isNaN(parseFloat(value))`, and
  `parseFloat("100,100 150,25 …")` → `100`, so `canTrackVelocity` is TRUE for points strings.
  `getVelocity()` (`value/index.ts:406-428`) then computes a finite-but-meaningless velocity from
  the first coordinate, which is passed into the `[0,100]` progress spring created in
  `JSAnimation.initAnimation` (`packages/motion-dom/src/animation/JSAnimation.ts:131-141`). That
  explains spring-specific violent overshoot, but is still finite — NOT proven to be the NaN
  source. Check what velocity reaches the spring in the live repro.
- The reporter's separate "expected number, 'undefined'" (non-spring) suggests the string
  `"undefined"` reaching the DOM attribute — also unexplained; capture it in the repro too.

## Steps

### Step 1: Execute plan 032

Run `plans/032-spring-complex-value-nan-investigation.md` end-to-end with the findings above.
Concretely: skip re-testing the two mixer cases listed above (already negative); start its
Step 2 repro matrix at the JSAnimation/Cypress layers and add a velocity probe
(`onUpdate` + log `motionValue.getVelocity()` before the animation starts).

**Verify**: plan 032 exits with either (a) a failing test + diagnosed root cause + fix, or
(b) its documented "needs repro" exit after honest attempts at all layers.

### Step 2 (only on exit (b)): gated close

ONLY after the row for this plan in `plans/issues/README.md` is marked APPROVED:

```
gh api repos/motiondivision/motion/issues/2791/comments -f body="We attempted to reproduce this against current main and couldn't trigger NaN output from the complex-value mixer, including with mismatched point counts and spring overshoot (progress > 1), and the original CodeSandbox is no longer accessible. If you can still reproduce on motion@12, please share the polygon's exact points keyframes and transition so we can reopen — happy to dig in with a working repro."
gh api -X PATCH repos/motiondivision/motion/issues/2791 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2791 --jq .state` → `"closed"`.
(If plan 032 instead lands a fix, close with `-f state_reason=completed` after merge — same
APPROVED gate. `gh pr edit` is broken on this repo; use `gh api -X PATCH` for PR edits.)

## Done criteria

- [ ] Plan 032 executed to one of its two exits; its row AND this plan's row updated in the
      respective READMEs (032 → `plans/README.md`, this → `plans/issues/README.md`)
- [ ] No fix or test landed without a test that failed on the bug first (repo policy)
- [ ] Any close/comment action happened only under the APPROVED gate

## STOP conditions

- Plan 032's excerpts no longer match the live code (drift).
- You are tempted to land "defensive" NaN guards or happy-path tests without a failing repro —
  policy forbids it; take exit (b) instead.
- The sandbox becomes fetchable and reveals 3+ keyframes with spring: that hits the
  prod-silent two-keyframe truncation (`JSAnimation.ts:120-129`) — report, don't improvise.
