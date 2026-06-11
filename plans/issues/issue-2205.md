# Plan issue-2205: Answer "inject a callback into an animate sequence" — shipped as function segments in v12.31.1 — and close

> **Executor instructions**: Follow this plan step by step. If anything in
> "STOP conditions" occurs, stop and report. When done, update this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2205 --jq '.state'` → `open`
> (if closed, mark DONE and stop).

## Status

- **Priority**: P2 (5 comments, recurring asks through 2025)
- **Effort**: S
- **Risk**: LOW (comment + gated close; no code)
- **Depends on**: none
- **Category**: support / verify-fixed
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2205

## Classification: VERIFY-FIXED — feature shipped after the issue was filed; answer and close (gated)

## Why this matters

The 2023 request — `animate([[...anim1], [...anim2], [() => { /* do
something */ }, { at: '<' }]])` — was implemented on main in 2026 and the
issue was never closed. The thread also contains two secondary asks
(per-segment `onComplete`; sequence-level `onComplete`) that current API
answers. Closing with the exact syntax + version resolves a 5-comment
thread.

## Current state (verified at 42bfbe3ed)

- Commit `0d7a2b7db` "Adding support for callbacks in animation sequences"
  (2026-02-03), first released in **v12.31.1** (`git tag --contains 0d7a2b7db`).
- Types: `packages/framer-motion/src/animation/sequence/types.ts:92-101` —
  `SequenceProgressCallback = (value: any) => void` and `FunctionSegment`
  (`[callback]`, `[callback, options]`, `[callback, keyframes, options]`),
  part of the `Segment` union (line 112).
- Implementation: `packages/framer-motion/src/animation/animate/sequence.ts:23-37`
  — function segments are pre-processed into a `motionValue(0)` segment
  animating `[0, 1]` (or the user-supplied keyframes) with the callback
  subscribed via `mv.on("change", callback)`. So the callback receives the
  animated progress value every frame during its window of the timeline,
  honoring `at`, `duration`, easing, etc.
- This also addresses the maintainer's own scrub-direction concern from the
  thread (2024-01-05): the callback receives a continuous value, so callers
  can detect direction themselves rather than needing
  `{ forwards, backwards }` one-shot semantics.
- Secondary asks in comments:
  - Per-segment lifecycle callbacks are deliberately rejected at the type
    level — `types.ts:12-23` (`LifecycleCallbacks` omitted from segment
    transition options, commit `47cf13955`) because segments are
    consolidated into one animation per subject.
  - Sequence-level completion exists: `SequenceOptions.onComplete`
    (`types.ts:122`, wired in `animate/index.ts:119-124`, commit
    `21869e9a3`) — this answers Curve's 2025-01-02 comment.
  - One-shot triggers at a point in the timeline: use a zero/short-duration
    function segment, or guard inside the callback (`if (v === 1) ...`).

## Steps

### Step 1: Verify with the existing test suite

`npx jest --config packages/framer-motion/jest.config.json --testPathPattern="sequence"`
→ passes. Confirm a test exercising function segments exists:
`grep -rn "typeof segment\[0\]\|function segment\|() =>" packages/framer-motion/src/animation/sequence/__tests__/index.test.ts | head`
and/or `git show 0d7a2b7db --stat` (the commit includes tests). If no test
covers `[callback, { at: ... }]` placement, run a throwaway check (do not
commit) before answering.

### Step 2 (gate: `plans/issues/README.md` row APPROVED): Answer and close

Comment on #2205: the requested syntax works as written since v12.31.1
(`motion@12.31.1`), with a short example mirroring the issue's own snippet,
plus the `SequenceOptions.onComplete` answer for the thread's follow-up ask
and the note that per-segment `onComplete` is intentionally unsupported
(segments merge into one animation per subject). Close:
`gh api -X PATCH repos/motiondivision/motion/issues/2205 -f state=closed -f state_reason=completed`

## Done criteria

- [ ] Sequence suite green; function-segment coverage confirmed or spot-checked
- [ ] Comment posted with version + example; issue closed as completed (only with APPROVED row)
- [ ] `plans/issues/README.md` row updated
- [ ] No source files modified

## STOP conditions

- Row not APPROVED → mark row BLOCKED awaiting decision.
- Function segments fail the spot-check (callback not called, or `at`
  ignored) → real regression; report with the failing case instead of
  closing.
