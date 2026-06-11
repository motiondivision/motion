# Plan issue-1747: Confirm the hold-then-flick velocity fix covers the touch flick deceleration report, then close

> **Executor instructions**: Follow this plan step by step; run every
> verification command. If a STOP condition occurs, stop and report.
> When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/1747 --jq .state` → `open` (if `closed`, mark DONE-ALREADY and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/pan/PanSession.ts packages/framer-motion/cypress/integration/drag-momentum.ts` — if `PanSession.ts` changed, re-verify the excerpt below.

## Status

- **Classification**: VERIFY-FIXED
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (verification only)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1747

## Why this matters

Issue #1747 (2022, touch devices): a fast flick from standstill produced an
inertia animation that "abruptly decelerates" — i.e. far less momentum than
the same flick performed while the element was already moving. That is the
signature of velocity dilution: `getVelocity` averaged the flick against the
stale pointer-down origin point sitting in history from before the hold.
Commit `9f228395e` (2026-02-04, "fix(drag): Fix slow flick velocity and
momentum carry-over after catch-and-release") added a guard that skips the
stale pointer-down point exactly for hold-then-flick gestures, plus a Cypress
regression spec (`drag-momentum.ts`, "Fast flick after hold produces
momentum"). The drag audit (2026-06-11, see `plans/README.md` "From the drag
audit") already concluded: re-investigate #1747 only with a fresh repro
against current main. This plan runs the regression gate and closes the issue
pending maintainer approval.

## Current state

- `packages/framer-motion/src/gestures/pan/PanSession.ts:399–413` — the guard:
  ```ts
  /**
   * If the selected point is the pointer-down origin (history[0]),
   * there are better movement points available, and the time gap
   * is suspiciously large (>2x timeDelta), use the next point instead.
   * This prevents stale pointer-down points from diluting velocity
   * in hold-then-flick gestures.
   */
  if (
      timestampedPoint === history[0] &&
      history.length > 2 && ...
  ```
- `packages/framer-motion/cypress/integration/drag-momentum.ts` (63 lines) — two tests: hold-then-flick momentum, and catch-and-release stop. Fixture: `dev/react/src/tests/drag-momentum.tsx`.
- The issue's CodeSandbox (`bju9ik`) is Cloudflare-blocked for agents; the repro description in the issue body (flick from standstill vs flick while moving) maps 1:1 to the fixed scenario.
- Plan `plans/021-drag-gesture-qol-improvements.md` covers a *different* inertia item (`bounce: false` hard-stop for `dragElastic: false`); it does not overlap this issue and deliberately leaves `PanSession` untouched.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Server (React 18) | `PORT=$((10000 + RANDOM % 50000)); cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &` then `npx wait-on http://localhost:$PORT` | up |
| Spec | `cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/drag-momentum.ts` | 2 passing |
| React 19 | same with `dev/react-19` + `--config-file=cypress.react-19.json` | 2 passing |

## Scope

**In scope**: `plans/issues/README.md` (status row), the GitHub comment/close.
**Out of scope**: any source or test change. If the spec fails, STOP.

## Steps

### Step 1: Run the regression spec on both React versions

`yarn build`, then run `drag-momentum.ts` on React 18 and React 19 per the
commands above (foreground; capture with `tail -60`).

**Verify**: both runs → 2 passing, 0 failing.

### Step 2 (gated): Comment and close

**Gate: only if this plan's row in `plans/issues/README.md` is marked APPROVED.**

Comment via `gh api repos/motiondivision/motion/issues/1747/comments -f body="..."`:
the abrupt-deceleration-after-standstill-flick symptom was caused by stale
pointer-down points diluting the release velocity and was fixed in
`9f228395e` (shipped in 12.x, 2026-02); a Cypress regression test
(`drag-momentum.ts`) pins the behavior; ask the reporter to retest on the
latest release and re-open with a fresh repro if it persists on a real touch
device.

Close: `gh api -X PATCH repos/motiondivision/motion/issues/1747 -f state=closed -f state_reason=completed`.

## Done criteria

- [ ] `drag-momentum.ts` passes on React 18 AND React 19
- [ ] No source/test files modified (`git status` clean apart from plans/issues/README.md)
- [ ] Issue commented + closed only if README row APPROVED; otherwise row set to "VERIFIED — awaiting close approval"

## STOP conditions

- Either Cypress run fails — the fix has regressed; report output, do not patch.
- `PanSession.ts:399–413` guard no longer present (drift) — re-investigate before claiming fixed.

## Maintenance notes

- The synthetic Cypress flick approximates touch; if a fresh touch-device
  repro arrives post-close, the next investigation should start from real
  `pointerType: "touch"` event timings (coalesced events on iOS Safari can
  thin the history), not from the generator math in
  `packages/motion-dom/src/animation/generators/inertia.ts`.
