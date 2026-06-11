# Plan issue-2610: Verify useSpring cursor-follow no longer flies away on click (v11 regression), close

> **Executor instructions**: Follow step by step; run every verification
> command. If anything in "STOP conditions" occurs, stop and report. When
> done, update the status row for this plan in `plans/issues/README.md`
> (NOT `plans/README.md`).
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2610 --jq .state` → expect `"open"`. If closed, mark DONE and stop.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/value/follow-value.ts packages/framer-motion/src/value/use-spring.ts` — if changed, re-read those files before trusting the excerpts below; mismatch with the quoted code = STOP.

## Status

- **Classification**: VERIFY-FIXED
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (historical v11.0 regression; verify + close)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2610

## Verdict and evidence

Report (April 2024, v11.0): a `useMotionValue` + `useSpring` cursor-follower
(1) accelerates and "flies away" when clicking while moving the cursor, and
(2) is glitchy with devtools open. Both symptoms match the v11.0
implementation's velocity handling: each source change restarted a
`MainThreadAnimation` seeded with `value.getVelocity()` — a finite difference
over wall-clock timestamps. A click delivers extra event-loop turns /
coalesced pointer events, producing two `set()`s microseconds apart →
`Δv / tiny Δt` → enormous velocity → spring launched off-screen. Devtools
throttling produces irregular deltas → glitches.

`useSpring` has since been **rewritten** and this exact failure class fixed:

- `861f5dbad` (2026-01-19) — `useSpring` now delegates to `useFollowValue` →
  `attachFollow` (`packages/motion-dom/src/value/follow-value.ts`), driving a
  `JSAnimation`.
- `e93102089` (2026-03-04, "Fix laggy spring animations at high refresh rates
  (240hz)") — retargets use the spring generator's **analytical** velocity
  instead of the MotionValue's finite difference, and `scheduleAnimation` is a
  stable reference so the frame-loop Set dedupes multiple sets per frame —
  `follow-value.ts:103-105` and `:121-123`:
  ```ts
  const velocity = activeAnimation
      ? activeAnimation.getGeneratorVelocity()
      : value.getVelocity()
  ```
  ```ts
  // Use a stable function reference so the frame loop Set deduplicates
  // multiple calls within the same frame (e.g. rapid mouse events)
  ```
- `d1b51bd01` (2026-03-02, "Fix spring velocity loss on Chrome vsync-aligned
  mousemove interruption", fixes #3407) — samples generator velocity *before*
  stopping the interrupted animation; this is precisely the
  cursor-follow-interrupted-every-frame scenario.
- Retargets are batched per frame via `frame.postRender(scheduleAnimation)`
  (`follow-value.ts:136`), so a click+move burst of `set()`s collapses to one
  retarget with bounded analytical velocity.

The issue's CodeSandbox could not be fetched at planning time
(`https://codesandbox.io/api/v1/sandboxes/khssjf` → HTTP 403); the issue
body's steps 1-5 fully specify the repro and are used below.

**Honesty note**: the click-spike cannot be made to fail as a Jest test
against current code (the vulnerable code no longer exists, and pointer-event
timing is not reproducible in JSDOM). Per repo policy — no repro → no fix and
no speculative committed coverage — this plan verifies manually and via a
*scratch* simulation, commits **nothing**, and closes the issue gated on
approval. Real regression coverage for this class already exists:
`packages/motion-dom/src/value/__tests__/follow-value-framerate.test.ts`
(issues #3265/#3407).

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Existing spring gates | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="follow-value\|spring-value"` (repo root) | all pass |
| Dev server | `PORT=$((10000 + RANDOM % 50000)); cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT` | serves `http://localhost:$PORT` |

## Scope

**In scope**: a temporary manual-verification page `dev/react/src/tests/spring-cursor-2610.tsx` (DELETE before finishing — nothing is committed) and an optional scratch Jest file (also deleted).
**Out of scope**: any change under `packages/`. If verification fails, report — do not patch.

## Steps

### Step 1: Confirm existing automated gates pass

`npx jest --config packages/motion-dom/jest.config.json --testPathPattern="follow-value|spring-value"` → all pass.

### Step 2 (optional, scratch only): deterministic burst simulation

Create a scratch test modeled exactly on
`follow-value-framerate.test.ts` (copy its `processFrame` harness and
`MotionGlobalConfig.useManualTiming` setup/teardown): drive `source` along a
circle at 60fps for ~60 frames; every 10th frame call `source.set()` **twice**
(same timestamp — the click burst); assert `output.get()` never leaves the
circle's bounding box by more than ~2× its radius. Expected: passes. Delete
the scratch file afterwards (`git status` clean). If it FAILS → STOP condition.

### Step 3: Manual verification of the reported repro

Create `dev/react/src/tests/spring-cursor-2610.tsx` (temporary):

```tsx
import { motion, useMotionValue, useSpring } from "framer-motion"
import { useEffect } from "react"

export const App = () => {
    const x = useMotionValue(0)
    const y = useMotionValue(0)
    const springX = useSpring(x)
    const springY = useSpring(y)

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            x.set(e.clientX)
            y.set(e.clientY)
        }
        window.addEventListener("mousemove", onMove)
        return () => window.removeEventListener("mousemove", onMove)
    }, [])

    return (
        <motion.div
            style={{
                x: springX,
                y: springY,
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "red",
            }}
        />
    )
}
```

Start the dev server (command table) and open
`http://localhost:$PORT/?test=spring-cursor-2610` in a real browser (Chrome
preferred — the report was Chrome/Windows):

1. Move the cursor in circles while **spam-clicking** for ~10 seconds → the dot must keep tracking the cursor; no acceleration/fly-away (issue bug 1).
2. Open devtools, keep moving → motion remains smooth, no stutter beyond normal devtools overhead (issue bug 2 — judge leniently; "glitchy" was v11.0-specific).

Then DELETE `dev/react/src/tests/spring-cursor-2610.tsx` and stop the server.

**Verify**: `git status` → clean working tree.

### Step 4: Gated close

**Only after the row for this plan in `plans/issues/README.md` is marked
APPROVED**:

```bash
gh api repos/motiondivision/motion/issues/2610/comments -f body="Verified fixed on current motion@12. useSpring was rewritten since this report: spring retargets now reuse the running spring's analytical velocity instead of a finite-difference estimate, and rapid same-frame set() calls (the click+move burst that caused the fly-away) are deduplicated per frame. The cursor-follow repro from this issue tracks correctly while spam-clicking, including with devtools open. Covered by the spring frame-rate/interruption regression tests. Please open a new issue if you can still reproduce on motion@12."
gh api -X PATCH repos/motiondivision/motion/issues/2610 -f state=closed -f state_reason=completed
```

Otherwise set status `BLOCKED (awaiting approval)`.

## Done criteria

- [ ] Step 1 tests pass; Step 3 manual repro shows no fly-away on click-spam.
- [ ] No files committed; `git status` clean (scratch + dev page deleted).
- [ ] Issue closed only per the APPROVED gate; `plans/issues/README.md` row updated.

## STOP conditions

- Step 2's bounded-output simulation FAILS, or Step 3 reproduces fly-away/obvious glitching → the bug (or a new one) is live; reclassify as FIX, capture the failing simulation as the failing test, and report.
- Drift check shows `follow-value.ts` changed and the quoted velocity/dedup code is gone.
- The dev server page errors on load (report; do not debug unrelated dev-app issues beyond a restart).
