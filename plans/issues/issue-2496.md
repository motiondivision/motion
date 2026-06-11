# Plan issue-2496: Decide and (if approved) ship a manual frame-driving API for rAF-less environments

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2496 --jq '.state'` → `open`
>    (if closed, mark DONE and stop).
> 2. `git log --oneline 42bfbe3ed..HEAD -- packages/motion-dom/src/frameloop/`
>    — if anything landed here since planning (especially anything named
>    `renderFrame` / "manual"), re-verify the "Current state" excerpts; the
>    feature may have shipped. If `grep -rn "renderFrame" packages/motion-dom/src/index.ts`
>    matches, this is already done — skip to Step 5 (answer + close).

## Status

- **Priority**: P2
- **Effort**: M (decision is S; implementation is M)
- **Risk**: MED (touches the frameloop singleton every animation runs through)
- **Depends on**: none
- **Category**: direction / feature
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2496

## Classification: FEATURE — NEEDS-DECISION (maintainer previously built AND closed this himself)

## Why this matters

In environments where `requestAnimationFrame` never fires (WebXR immersive
sessions — the linked pmndrs/react-xr#180 case — and offline render pipelines
like Remotion), Motion animations simply stop. GSAP solved this with
`gsap.updateRoot()`. The reporter abandoned framer-motion for react-spring
over this. The primitives half-exist on main but there is **no public way to
drive a frame**, so the issue is real and open.

## History the executor must know

- **PR #3521** (the maintainer's own, created 2026-02-01, **closed unmerged
  2026-02-07 with no stated reason**) implemented exactly this:
  `renderFrame({ timestamp, frame, fps, delta })`, `setManualTiming(enabled)`,
  `isManualTiming()`, and a React `useManualFrame` hook. Branch still exists:
  `origin/claude/implement-motion-2496-V0NAo` (commits `b184e6e38`,
  `e9a877b27`). PR body said "Fixes #2496".
- That the maintainer closed his own complete implementation is a strong
  signal the API shape (likely the React hook / the `setManualTiming`
  wrapper / fps-frame conveniences) wasn't what he wanted — NOT that the
  problem is invalid. Do not blindly revive the whole PR.

## Current state (verified at 42bfbe3ed)

- `packages/motion-utils/src/global-config.ts:4` — `useManualTiming?: boolean`
  exists on `MotionGlobalConfig`.
- `packages/motion-dom/src/frameloop/batcher.ts:42-55` — `processBatch()`
  reads `state.timestamp` instead of `performance.now()` when
  `MotionGlobalConfig.useManualTiming` is set, and skips delta computation.
  But `processBatch` is **module-private**: the only way it runs is via the
  `scheduleNextBatch` callback.
- `packages/motion-dom/src/frameloop/frame.ts:9-11` — the singleton batcher is
  created with `typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : noop`.
  So with rAF absent (or present-but-never-firing, as in WebXR), frames never
  process, `useManualTiming` or not.
- `packages/motion-dom/src/index.ts:71-75` — `frameloop`, `batcher`,
  `microtask`, `sync-time` are all re-exported; `framer-motion/dom` is
  `export * from "motion-dom"` and the `motion` package re-exports that, so
  any new motion-dom export is automatically public everywhere.
- There is NO `renderFrame` anywhere on main:
  `grep -rn "renderFrame" packages/motion-dom/src` → no matches.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Inspect closed PR's diff | `git fetch origin claude/implement-motion-2496-V0NAo && git diff main...origin/claude/implement-motion-2496-V0NAo --stat` | file list of the prior attempt |
| Build all | `yarn build` (repo root) | exit 0 |
| motion-dom unit tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"` | pass |
| Close (only if APPROVED-CLOSE) | `gh api -X PATCH repos/motiondivision/motion/issues/2496 -f state=closed -f state_reason=not_planned` | state closed |

## Maintainer decision gate (BEFORE any code)

Present these options in this plan's row note in `plans/issues/README.md` and
wait for the maintainer to set the row to one of:

- **APPROVED (minimal)** — ship only a low-level `renderFrame(timestamp: number)`
  export from motion-dom (no React hook, no fps/frame conveniences, no
  `setManualTiming` wrapper — users set `MotionGlobalConfig.useManualTiming = true`
  themselves, which is already public via motion-utils). This is the GSAP
  `updateRoot` analog and the smallest possible API.
- **APPROVED-AS-3521** — revive the full PR #3521 surface.
- **APPROVED-CLOSE** — close #2496 as not_planned with an explanation
  (e.g. "use the WAAPI path / this is served by X").
- **REJECTED** — leave open, do nothing.

Do not proceed past Step 1 without one of these.

## Steps

### Step 1: Recon the prior attempt

`git fetch origin claude/implement-motion-2496-V0NAo` then read
`git show b184e6e38` in full. Record in your report: how it exposed
`processBatch` (it must have added a public hook on the batcher), how it
suppressed the keepAlive self-rescheduling loop under manual timing
(`batcher.ts:70-73` `if (runNextFrame && allowKeepAlive) scheduleNextBatch(processBatch)`
— under manual driving this must not double-schedule), and what it did about
`sync-time.ts` (`time.now()` already respects `useManualTiming`, line 22).
Update the README row note with a 3-line summary. **Wait for the gate.**

### Step 2 (gate: APPROVED minimal or AS-3521): Failing test first

In `packages/motion-dom/src/frameloop/__tests__/` add a test (model after the
existing tests in that directory): set
`MotionGlobalConfig.useManualTiming = true`, schedule a `frame.update`
callback, call the new `renderFrame(100)`, assert the callback ran with
`frameData.timestamp === 100`; call `renderFrame(116)`, assert
`frameData.delta` is sensible per the chosen design. Reset
`MotionGlobalConfig.useManualTiming = false` in `afterEach` (the config and
`frameData` are module-level singletons — test pollution here breaks
unrelated suites; see the same pattern handled in existing frameloop tests).
Test must fail with "renderFrame is not exported" — that is acceptable here
ONLY because this is a feature, not a bug fix.

### Step 3: Implement

Minimal shape (adjust to AS-3521 if that's the approval):

- `batcher.ts`: return `processBatch` (or a `tick(timestamp)` that sets
  `state.timestamp` then runs `processBatch`) from `createRenderBatcher`, and
  guard the keepAlive re-schedule so manual timing never self-schedules.
- New `packages/motion-dom/src/frameloop/render-frame.ts` exporting
  `renderFrame(timestamp: number)` bound to the singleton from `frame.ts`.
- Export from `packages/motion-dom/src/index.ts` (near the other frameloop
  exports, lines 71-75). No framer-motion change needed (re-export chain).

Keep it byte-light (repo code style: this ships to end users).

### Step 4: Verify

`yarn build` → exit 0. Frameloop Jest suite passes including the new test.
Run the full motion-dom suite once:
`npx jest --config packages/motion-dom/jest.config.json` → no new failures
(pre-existing failures listed in repo memory notes don't count — record any
you see in the report).

### Step 5: Answer the issue

Comment on #2496 with the shipped API + a WebXR-loop usage snippet
(`session.requestAnimationFrame(t => { renderFrame(t); ... })`), or — if the
gate was APPROVED-CLOSE — the maintainer-provided rationale. Close:
`gh api -X PATCH repos/motiondivision/motion/issues/2496 -f state=closed -f state_reason=completed`
(use `not_planned` for the close-without-shipping path). Only with an
APPROVED row.

## Done criteria

- [ ] Maintainer decision recorded in `plans/issues/README.md` row
- [ ] If approved: new export builds, new test passes, no new suite failures
- [ ] Issue #2496 answered and closed per the gate
- [ ] Row updated

## STOP conditions

- Row not APPROVED → stop after Step 1.
- The prior-attempt branch is unreadable/deleted → report; reconstruct from
  the PR #3521 files API (`gh api repos/motiondivision/motion/pulls/3521/files`).
- Implementation requires changing `processBatch` semantics for the normal
  rAF path (any diff in behavior when `useManualTiming` is false) → STOP;
  the frameloop is the hottest path in the library.

## Maintenance notes

- The Remotion integration work (external `plus` repo) wants this same
  primitive; whatever shape ships here should be checked against that
  consumer before release.
- If plan 012 (mark-dirty/pull derivation graph) ever reshapes the frameloop,
  `renderFrame` is the manual entry point that must keep working.
