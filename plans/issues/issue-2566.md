# Plan issue-2566: Answer "animate from previous value to new value" — already served by `animate(motionValue, target)` — and close

> **Executor instructions**: Follow this plan step by step. If anything in
> "STOP conditions" occurs, stop and report. When done, update this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2566 --jq '.state'` → `open`
> (if closed, mark DONE and stop).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (comment + gated close; no code)
- **Depends on**: none
- **Category**: support
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2566

## Classification: SUPPORT / COVERED BY EXISTING API — answer and close (gated)

## Why this matters

2023-era feature request (0 comments): the reporter wants
`value.set(EXAMPLE_VALUE)` to *animate* from the current value to the new
value instead of jumping. This has been a first-class capability of the
imperative `animate()` function the whole time: `animate(motionValue, target)`
animates from the value's current state. Closing with a concrete recipe
resolves the issue without API work.

## Current state (verified at 42bfbe3ed)

- `packages/framer-motion/src/animation/animate/index.ts:46-67` — `animate()`
  overloads accept `MotionValue<string>` / `MotionValue<number>` (and raw
  values) with keyframes + `ValueAnimationTransition` options.
- `packages/framer-motion/src/animation/animate/subject.ts:28-37` —
  `isSingleValue` routes `MotionValue` subjects to `animateSingleValue`,
  which starts from the value's current value when given a single target
  (single-keyframe targets get a `null` "current value" placeholder
  prepended — same mechanism as sequences, `sequence/create.ts:195-196`).
- The reporter's exact scenario also works inside the change handler:
  ```js
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
      value.set(latest)            // tracked: follow scroll directly
  })
  // on other pages:
  animate(value, 1, { duration: 0.5 })  // animated: tween from current → 1
  ```
- For continuously-smoothed following there is also `useSpring(source)` /
  `springValue(source)` (public via the motion-dom re-export chain,
  `packages/framer-motion/src/dom.ts:1`).

## Steps

### Step 1: Sanity-check the recipe (no repo changes)

Run a quick Node check against the built library or write a throwaway Jest
test (do NOT commit it) asserting `animate(motionValue(0), 1, { duration: 0.1 })`
interpolates intermediate values via `value.on("change", ...)`. Expected:
monotonically increasing samples between 0 and 1 — exactly the
`0 → 0.17 → 0.44 → … → EXAMPLE_VALUE` sequence the reporter asked for.
(There are existing equivalent tests in
`packages/framer-motion/src/animation/animate/__tests__/` — finding one that
already covers this is an acceptable substitute; cite it in the comment.)

### Step 2 (gate: `plans/issues/README.md` row APPROVED): Answer and close

Comment on #2566 with the recipe above (both the `animate(value, target)`
call and the `useSpring` alternative), note it works in the versions current
at the time of the issue as well as v12, then close:
`gh api -X PATCH repos/motiondivision/motion/issues/2566 -f state=closed -f state_reason=completed`

## Done criteria

- [ ] Recipe verified (test run or existing test cited)
- [ ] Comment posted; issue closed as completed (only with APPROVED row)
- [ ] `plans/issues/README.md` row updated
- [ ] No source files modified (`git status` clean)

## STOP conditions

- Row not APPROVED → post nothing; mark row BLOCKED awaiting decision.
- Step 1 shows `animate(value, target)` does NOT animate from current value
  → this plan's premise is wrong; report with the failing sample, do not
  comment on the issue.
