# Plan issue-2317: Verify "transitionEnd applied early when animation interrupted" is fixed in v12, prove it with tests, and close

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2317 --jq '.state'` → `open`
>    (if closed, mark DONE and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/ packages/motion-dom/src/value/index.ts`
>    — drift in `JSAnimation.ts`, `NativeAnimation.ts`,
>    `AsyncMotionValueAnimation.ts`, or
>    `interfaces/visual-element-target.ts` ⇒ re-verify the excerpts below.

## Status

- **Priority**: P2 (long-tail bug, 5 "still happening" comments through
  v11.0.7 / 2024-04; analysis says fixed by the v12 animation rewrite — needs
  proof, not assumption)
- **Effort**: M (Cypress test is the real gate; WAAPI is the affected path)
- **Risk**: LOW (test-only if verification holds)
- **Depends on**: none
- **Category**: bug / verify-fixed
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2317

## Classification: VERIFY-FIXED (expected) — regression-test then close; flips to FIX if the Cypress test fails

## Why this matters

Since 10.6.0 (the release that introduced WAAPI acceleration), interrupting
an animation that declares `transitionEnd` applied the `transitionEnd` values
*immediately* instead of discarding them — e.g. `transitionEnd: { display:
"none" }` hid the element mid-animation. Expected (and 10.5.0) behavior:
`transitionEnd` applies only when the transition completes. Reporters
confirmed through v11.0.7. The codebase has since been rewritten
(motion-dom `JSAnimation`/`NativeAnimation`); static analysis below says the
interrupt path can no longer trigger `transitionEnd` — but per repo policy
this needs a repro-shaped test before closing, and the affected path is
WAAPI, which JSDOM cannot exercise — **the regression gate must be Cypress**.

The reporter's CodeSandbox (`xgczyd`) is Cloudflare-blocked to fetch, but the
issue states it is the docs' own `transitionEnd` example (toggle
`animate={{ opacity: 0/1, transitionEnd: { display: "none"/... } }}` and
interrupt by toggling back mid-animation), so the repro is reconstructible.

## Current state — why this is expected fixed (verified at 42bfbe3ed)

- `transitionEnd` application site:
  `packages/motion-dom/src/animation/interfaces/visual-element-target.ts:159-170`
  ```ts
  if (transitionEnd) {
      const applyTransitionEnd = () =>
          frame.update(() => { transitionEnd && setTarget(visualElement, transitionEnd) })
      if (animations.length) {
          Promise.all(animations).then(applyTransitionEnd)
      } else {
          applyTransitionEnd()
      }
  }
  ```
- Interruption path: a new animation on a value calls `MotionValue.start`,
  which calls `this.stop()` first
  (`packages/motion-dom/src/value/index.ts:442-443`, stop at 465-467 →
  `this.animation.stop()`).
- Neither stop path settles the `finished` promise:
  - `JSAnimation.stop` (`packages/motion-dom/src/animation/JSAnimation.ts:488-498`)
    → `teardown()` + `onStop`; `notifyFinished()` is only called from
    `finish()` (lines 509-515).
  - `NativeAnimation.stop` (`packages/motion-dom/src/animation/NativeAnimation.ts:153-168`)
    → commit styles + `cancel()`; its `finished` is the inherited
    `WithPromise` promise (`utils/WithPromise.ts`), resolved ONLY in the
    `onfinish` handler (`NativeAnimation.ts:95-123`). It is NOT the native
    WAAPI `animation.finished` (which would *reject* on cancel).
  - `AsyncMotionValueAnimation.stop` (lines 286-293) just delegates; its
    `then()` is `this.finished.finally(onResolve)` (lines 209-211) — with
    promises that stay pending on interrupt, `finally` never runs.
- Therefore `Promise.all(animations)` stays pending forever on interrupt and
  `applyTransitionEnd` never fires — the 10.5.0 behavior. The new
  animation's own `transitionEnd` (if any) applies on ITS completion.
- Related but distinct fix already on main: `c429439c5` (v12.31.3) fixed
  stale `transitionEnd` ordering for *instant* (empty-`animations`) variant
  switches (#1668) — the `frame.update` re-assert comment at
  `visual-element-target.ts:95-99` is part of that. It does not cover the
  mid-flight WAAPI interrupt this issue is about, hence the test below.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Jest (JS path) | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="animate-prop"` | pass |
| Build | `yarn build` (repo root, before Cypress) | exit 0 |
| Cypress React 18 | see CLAUDE.md "Running Cypress tests locally" (start Vite directly on a random port, then `cypress run --headed --spec cypress/integration/transition-end-interrupt.ts`) | pass |
| Cypress React 19 | same with `cypress.react-19.json` + dev/react-19 | pass |
| Close (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2317 -f state=closed -f state_reason=completed` | closed |

## Steps

### Step 1: Jest test for the JS-animation path

In `packages/framer-motion/src/motion/__tests__/animate-prop.test.tsx`
(model after "uses transitionEnd on subsequent renders", line 104): render
`<motion.div initial={{ x: 0 }} animate={{ x: 100, transitionEnd: { display: "none" } }} transition={{ duration: 10, ease: "linear" }} />`,
re-render after a few frames with `animate={{ x: 50 }}` (interrupt), wait a
few more frames (`nextFrame` helper from CLAUDE.md), assert
`element.style.display !== "none"`. Expected: PASSES on main (JS path never
had/no longer has the bug in JSDOM). This is a regression guard, not the
proof — say so in its comment.

### Step 2: Cypress test for the WAAPI path (the real gate)

1. Test page `dev/react/src/tests/transition-end-interrupt.tsx` exporting
   `App`: a button toggling `isVisible`; a `motion.div` with
   `animate={{ opacity: isVisible ? 1 : 0, transitionEnd: { display: isVisible ? "block" : "none" } }}`
   `transition={{ duration: 10, ease: "linear" }}` (long+linear per CLAUDE.md
   so mid-animation state is detectable). Opacity is a compositor prop —
   this runs on WAAPI in Cypress.
2. Spec `packages/framer-motion/cypress/integration/transition-end-interrupt.ts`:
   start hide (toggle off), `cy.wait(500)` (5% through), toggle back on
   (interrupt), then with `.then()` (NOT `.should()`, per CLAUDE.md) assert
   `getComputedStyle(el).display !== "none"` immediately after the interrupt
   AND ~1s later (catches both instant and microtask-deferred application).
   Optionally assert `el.getAnimations().length > 0` to prove the WAAPI path
   is actually exercised (opacity is compositor — allowed per CLAUDE.md).
3. Run against React 18 AND React 19 per CLAUDE.md (both must pass; run
   Cypress in the foreground; capture output with `tail -60` on first run).

**Expected: PASSES on main.** If it FAILS → the bug is alive; see STOP
conditions (this plan then flips to FIX and the prime suspect is
`AsyncMotionValueAnimation.then`'s `.finally` interacting with whichever
promise rejected/resolved — capture which).

### Step 3 (gate: `plans/issues/README.md` row APPROVED): Close

Open a PR with the two tests (title: regression tests for #2317; note the
environment caveat honestly — the Jest test covers the JS fallback, Cypress
covers WAAPI; don't overstate Electron limits per repo feedback notes).
Comment on #2317: fixed by the v12 animation engine rewrite (interrupted
animations no longer settle their finished promise —
`visual-element-target.ts` only applies `transitionEnd` after `Promise.all`
of those promises), regression tests added, please reopen with a repro
against v12 if still seen. Close as completed.

## Done criteria

- [ ] Jest test added and passing
- [ ] Cypress spec passing on React 18 and React 19
- [ ] PR opened with both tests
- [ ] Issue commented + closed (only with APPROVED row)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- **Cypress test fails on main** → the bug is NOT fixed: stop, report the
  failing output + which promise path fired `applyTransitionEnd` (instrument
  `visual-element-target.ts:160` locally if needed). Do not design a fix
  inside this plan's scope without reporting first; the likely fix shape is
  gating `applyTransitionEnd` on real completion (e.g. tracking
  stopped/cancelled state), and it must come with this same test failing
  first.
- Row not APPROVED → finish Steps 1-2, push nothing to the issue; mark row
  BLOCKED awaiting decision.
- Cypress passes on one React version and fails on the other → investigate
  per CLAUDE.md; do not skip.

## Maintenance notes

- `AsyncMotionValueAnimation.then()` using `.finally(onResolve)` (line
  209-211) means *any* settlement — including future code that rejects
  `finished` on cancel — would resurrect this bug. If animation promise
  semantics ever change (e.g. adopting native WAAPI `finished`), re-run this
  plan's Cypress spec first.
