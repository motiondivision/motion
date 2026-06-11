# Plan issue-2608: Answer "jump to a specific position in an animation sequence" — `controls.time` is settable — and close

> **Executor instructions**: Follow this plan step by step. If anything in
> "STOP conditions" occurs, stop and report. When done, update this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2608 --jq '.state'` → `open`
> (if closed, mark DONE and stop).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (comment + gated close; no code)
- **Depends on**: none
- **Category**: support
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2608

## Classification: SUPPORT / COVERED BY EXISTING API — answer and close (gated)

## Why this matters

2024 question (0 comments): "when click a button, I want to jump to a
specific position in a sequence and execute the rest from there." The
playback controls returned by `animate(sequence)` have supported exactly
this — a settable `time` — since timelines shipped. A worked answer closes
the issue.

## Current state (verified at 42bfbe3ed)

- `packages/framer-motion/src/animation/animate/index.ts:118-135` —
  `animate(sequence)` returns a `GroupAnimationWithThen` wrapping every
  animation in the sequence.
- `packages/motion-dom/src/animation/GroupAnimation.ts:54-62` —
  `get time()` / `set time(time: number)` distribute to all child
  animations: setting `controls.time = 2` seeks the whole sequence to 2s and
  it keeps playing from there (call `controls.play()` first if it was
  paused/finished).
- Sequences flatten every segment into one keyframe animation per
  subject/value with absolute offsets (`sequence/create.ts:384-456`), so
  seeking by time is exact and the "rest of the sequence" plays naturally.
- Known limitation worth stating honestly in the answer: **label → time
  lookup is not exposed**. `timeLabels` is internal to
  `createAnimationsFromSequence` (`sequence/create.ts:53`, `70-79`). Users
  who want to jump to a *label* must compute the time themselves today.

## Recommended answer (post as comment)

```jsx
const controls = animate(mySequence)

// later, e.g. in a click handler:
controls.time = 2.5   // seconds — jumps there and continues playing
// controls.pause() / controls.play() / controls.speed also available
```

Plus one sentence: if you need to jump to a named *label* rather than a
time, that lookup isn't exposed yet — open a focused feature request if so
(do NOT promise it).

## Steps

### Step 1: Verify the recipe

Check the existing sequence/controls tests cover settable time:
`grep -rn "\.time =" packages/framer-motion/src/animation/animate/__tests__/ packages/motion-dom/src/animation/__tests__/ | head`.
If a test setting `.time` on an `animate()` result exists, cite it.
Otherwise run a throwaway script/test (do not commit) asserting that after
`controls.time = X` on a sequence, sampled values correspond to position X.

### Step 2 (gate: `plans/issues/README.md` row APPROVED): Answer and close

Post the answer above on #2608 and close:
`gh api -X PATCH repos/motiondivision/motion/issues/2608 -f state=closed -f state_reason=completed`

## Done criteria

- [ ] Recipe verified (existing test cited or throwaway check run)
- [ ] Comment posted; issue closed (only with APPROVED row)
- [ ] `plans/issues/README.md` row updated
- [ ] No source files modified

## STOP conditions

- Row not APPROVED → mark row BLOCKED awaiting decision.
- Verification shows `set time` does not seek sequence animations correctly
  → report with details; this would be a real bug worth its own plan, do not
  answer-and-close.
