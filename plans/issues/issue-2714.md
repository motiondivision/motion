# Plan issue-2714: Close "stop/start of repeating animation loses original cycle" as by-design

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` (NOT
> `plans/README.md`) when done.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2714 --jq .state` → expect `"open"`. If closed, mark DONE and stop.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/keyframes/KeyframesResolver.ts packages/motion-dom/src/animation/JSAnimation.ts` — on change, re-verify the excerpts below; mismatch = STOP.

## Status

- **Classification**: INVALID/SUPPORT (documented keyframe-resolution behavior, not a bug)
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support/close
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2714

## Verdict: by design — explain + close (gated)

Report: `rotate: 360` with `repeat: Infinity`, stopped at 180° (on hover) and restarted, loops
180→360 forever instead of resuming the 0→360 cycle. This is exactly how keyframe resolution
is designed to work:

- **Stopping kills the animation; starting creates a NEW animation whose initial keyframe is
  resolved from the value's CURRENT state.**
  `packages/motion-dom/src/animation/keyframes/KeyframesResolver.ts:164-173`:

```ts
        // If initial keyframe is null we need to read it from the DOM
        if (unresolvedKeyframes[0] === null) {
            const currentValue = motionValue?.get()
            ...
            if (currentValue !== undefined) {
                unresolvedKeyframes[0] = currentValue
            }
```

  So the new animation's keyframes resolve to `[180, 360]`.
- **`repeat` repeats the RESOLVED keyframes**, not some remembered original cycle:
  `packages/motion-dom/src/animation/JSAnimation.ts:252-271` derives iteration progress purely
  from `currentTime / resolvedDuration` over the generator built from those resolved keyframes —
  hence 180→360, 180→360, … Same mechanism explains the reporter's translateX/Y observation.
- **The supported way to get the wanted behavior is pause/play of the SAME animation**, which
  verifiably preserves the repeat phase: `pause()` stores `holdTime = this.currentTime`
  (`JSAnimation.ts:478-482`) and `play()` restores `this.startTime = now - this.holdTime`
  (`JSAnimation.ts:457-458`), so the absolute `currentTime` — and with it the iteration math at
  lines 252-271 — continues exactly where it left off, wrapping 0→360 correctly.

No code change is appropriate: resolving `rotate: 360` from the current value is load-bearing,
long-documented behavior (wildcard/implied-initial keyframes), and "remember the previous
animation's origin" would be a breaking semantic change, not a fix.

## Steps

### Step 1: Approval gate

Open `plans/issues/README.md` and find/add the row for issue-2714. ONLY proceed to Step 2 after
the row for this plan is marked APPROVED; otherwise set it to NEEDS-DECISION and stop.

### Step 2: Comment + close

```
gh api repos/motiondivision/motion/issues/2714/comments -f body="This is expected keyframe-resolution behavior rather than a bug. Stopping an animation ends it; when you later re-trigger animate={{ rotate: 360 }}, Motion creates a brand-new animation and resolves its initial keyframe from the value's current state (180), so with repeat: Infinity the resolved 180→360 segment is what repeats. Two ways to get the behavior you want: (1) keep one animation alive and use playback controls — pause()/play() (e.g. via useAnimate or the controls returned by animate()) preserves the animation's exact position in the repeat cycle, so it resumes at 180, completes to 360 and wraps to 0 as expected; or (2) use explicit keyframes, rotate: [0, 360], if a restart-from-0 loop is acceptable. Closing as working-as-designed — happy to revisit if pause/play doesn't cover your use case."
gh api -X PATCH repos/motiondivision/motion/issues/2714 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2714 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned` — only under the APPROVED gate
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- The drift check shows `KeyframesResolver.readKeyframes` or the `play()/pause()` holdTime logic
  changed since `42bfbe3ed` — re-derive the verdict before commenting.
- You are tempted to "fix" keyframe resolution to remember prior origins — that's a breaking
  design change; report instead.
- Note: `gh pr edit` is broken on this repo; if any PR metadata edit is ever needed here, use
  `gh api -X PATCH repos/motiondivision/motion/pulls/<n>`.
