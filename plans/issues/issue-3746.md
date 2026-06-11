# Plan issue-3746: Fix AnimatePresence enter/exit tracking under React.StrictMode

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update (or add) this plan's row in
> `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/3746 --jq .state` → expect `open`.
> Then re-read the "Current state" excerpts against the live files; on a
> mismatch, treat as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches AnimatePresence child-diffing; large existing test surface)
- **Depends on**: none (but see "Relationship to PR #3707" below)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/3746

## Why this matters

Reported 2026-06-08 against motion 12.40.0 (current release) + React 19.2 —
this is a live bug on today's code, not a stale 2023 report. Under
`<React.StrictMode>` (the default in new Vite/Next apps, dev-only), children
whose key exists in BOTH the previous and next dataset are sometimes treated as
freshly entering: they disappear/reappear instead of animating, and their
`initial` values are re-applied. Behavior is non-deterministic across page
refreshes — classic StrictMode double-invocation interaction. Removing
StrictMode fixes it, which confirms the bug is in AnimatePresence's tracking,
not user code.

## Current state

- `packages/framer-motion/src/components/AnimatePresence/index.tsx` — the whole
  diffing/tracking implementation. Key regions (verify these before starting):
  - Lines 99–100: dual state
    ```tsx
    const [diffedChildren, setDiffedChildren] = useState(presentChildren)
    const [renderedChildren, setRenderedChildren] = useState(presentChildren)
    ```
  - Lines 125–158: **render-phase** diffing — when `presentChildren !== diffedChildren`
    it computes `exitingChildren`, calls `setRenderedChildren(...)` +
    `setDiffedChildren(...)` during render, then `return null` (line 157).
    StrictMode double-invokes render functions, so this block runs twice per
    update in dev.
  - Lines 102–121: `useIsomorphicLayoutEffect` that maintains the
    `exitComplete` map (`useConstant(() => new Map())`, line 88) and the
    `exitingComponents` ref Set (line 93). StrictMode runs mount effects
    twice (mount → cleanup → mount); there is no cleanup function here, so any
    bookkeeping done on the first pass survives.
  - Lines 188–213: `onExit` — when every exit completes it calls
    `setRenderedChildren(pendingPresentChildren.current)` and `onExitComplete`.
  - Line 76: `const isInitialRender = useRef(true)`, set false in the layout
    effect (line 103).
- Issue repro (CodeSandbox `ltnhl7` — **Cloudflare-blocked from the planning
  environment**, retry once with WebFetch; the description below is sufficient
  to reconstruct): a bar-chart with two datasets sharing some keys; a "Switch
  dataset" button. First switch animates correctly; the *second* switch makes a
  persisting bar (key in both datasets) unmount/remount and replay
  `initial` (width animates from 0).
- Prior StrictMode work (read these commits before theorizing):
  `adcf96dae` "Fix opacity animation broken with React StrictMode" (12.36.0),
  `4fc422465` "Fix variant propagation for Suspense-mounted children after
  StrictMode remount", `47859e8c6` (PR #3181, unmount strict mode). Run
  `git show adcf96dae --stat` etc.
- Existing test exemplars: `packages/framer-motion/src/components/AnimatePresence/__tests__/AnimatePresence.test.tsx`
  (e.g. "Fast animations with wait render the child content correctly" at
  line 412 and its "(strict mode disabled)" twin at line 449 — note the suite
  already renders some tests inside StrictMode; copy whichever wrapper pattern
  those use). Cypress exemplar: test page `dev/react/src/tests/strict-mode-opacity.tsx`
  + spec `packages/framer-motion/cypress/integration/strict-mode-opacity.ts`.

### Relationship to PR #3707

Open PR #3707 (plan `plans/issues/pr-3707.md`) fixes "stuck exit when the only
motion child unmounts mid-exit" (#3243) by changing `PresenceChild.tsx`
register/cleanup. Different symptom, possibly adjacent code. Do NOT duplicate
its change; if your root cause lands in `PresenceChild` register/cleanup, check
that PR's diff first (`gh pr diff 3707`) and STOP if they collide.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence"` (repo root) | pass (pre-existing SSR TextEncoder + use-velocity failures elsewhere are known; ignore only those) |
| Cypress | CLAUDE.md § "Running Cypress tests locally" — run both React 18 and React 19 recipes | both pass |
| Issue state | `gh api repos/motiondivision/motion/issues/3746 --jq .state` | `open` |

## Scope

**In scope**:
- `packages/framer-motion/src/components/AnimatePresence/index.tsx`
- `packages/framer-motion/src/components/AnimatePresence/PresenceChild.tsx` (only if root cause is there — see PR #3707 note)
- `packages/framer-motion/src/components/AnimatePresence/__tests__/AnimatePresence.test.tsx` (new test)
- `dev/react/src/tests/animate-presence-strict-dataset.tsx` + `packages/framer-motion/cypress/integration/animate-presence-strict-dataset.ts` (create, only if Jest cannot reproduce)
- `CHANGELOG.md` (entry matching existing "### Fixed" style)

**Out of scope**: PopChild.tsx; the projection system; any rewrite of the
diffing algorithm; PR #3707's diff.

## Git workflow

Branch `fix/issue-3746-strictmode-presence` off `main`. Commit style: short
imperative, e.g. `Fix AnimatePresence enter/exit tracking under StrictMode`
(match `git log --oneline -10`). Open PR via `gh pr create` (note: `gh pr edit`
is broken on this repo — for body edits use
`gh api -X PATCH repos/motiondivision/motion/pulls/<n> -f body=...`).

## Steps

### Step 1: Reproduce in Jest (failing test first)

Add to `AnimatePresence.test.tsx` a test wrapped in `<React.StrictMode>`:

- Datasets: A = keys `["a","b","c"]`, B = keys `["b","c","d"]` (keys b/c
  persist). Children: `motion.div` with `initial={{ opacity: 0 }}`,
  `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}`, short duration.
- Render A → rerender B → wait for exit of "a" to complete (use the
  `nextFrame`/`act` patterns from neighboring tests) → rerender A again.
- Assert, for the persisting key "b": (1) the DOM node is the same instance
  across the switch (capture `container.querySelector` reference before/after,
  or mount-count via a `useEffect(() => count++, [])` child), and (2) its
  opacity was not reset to the `initial` value (`expect(element).toHaveStyle("opacity: 1")`
  immediately after the switch).
- The issue says behavior is intermittent. If a single pass doesn't fail,
  loop the switch 3–5 times inside the test. Mirror the issue's "second
  switch" emphasis: the first switch working is expected.

**Verify**: the new test FAILS on unmodified main, for the reported reason
(remount / initial re-applied) — not for a setup error. Then confirm the same
test passes with the StrictMode wrapper removed (proves it's StrictMode-specific).

### Step 2: If Jest cannot reproduce after 2–3 honest variations, escalate to Cypress

JSDOM + React dev StrictMode does simulate double-render and double-effects,
so Jest *should* reproduce; but per CLAUDE.md, do not burn more than 2–3
attempts. Create `dev/react/src/tests/animate-presence-strict-dataset.tsx`
(model on `strict-mode-opacity.tsx`: `StrictMode` wrapper, named `App` export)
implementing the dataset-switch repro, plus a spec asserting the persisting
element's node identity / no width-from-0 replay across the second switch.
Run via the CLAUDE.md Cypress recipe (React 18 AND 19).

**Verify**: spec fails on unmodified main.

### Step 3: Diagnose

With a failing test in hand, instrument and check these hypotheses in order
(do not pre-commit to one):

1. The render-phase block (lines 125–158) running twice under StrictMode with
   `presentChildren !== diffedChildren` true both times — does the second pass
   see stale `renderedChildren` and double-insert exiting children, or splice
   at wrong indices (line 137 `nextChildren.splice(i, 0, child)`)?
2. `exitComplete` map entries surviving the StrictMode double layout effect
   (lines 102–121 have no cleanup) so a key that re-enters is still marked
   exiting; line 117–118 should delete it — verify it actually runs for
   persisting keys on the second switch.
3. `onExit` (lines 188–213) firing during/after a StrictMode re-render with a
   stale `pendingPresentChildren.current`, causing `setRenderedChildren` to
   commit an old child list (which would unmount-and-remount persisting
   children whose *element identity* differs).

### Step 4: Fix minimally

Smallest change in `index.tsx` that makes Step 1/2's test pass. Likely shapes:
add cleanup to the layout effect, make the render-phase diff idempotent under
double-invocation, or guard `onExit`'s commit against stale pending children.
Do NOT restructure the dual-state design.

**Verify**: new test passes; full
`--testPathPattern="AnimatePresence"` suite passes; if Step 2 ran, both
React 18 and React 19 Cypress runs pass.

### Step 5: Regression sweep + changelog

Run the full framer-motion Jest suite and the presence-related Cypress specs
(`animate-presence-*.ts`, `strict-mode-opacity.ts`) on React 18 + 19. Add a
CHANGELOG entry under a new `## Unreleased` → `### Fixed` heading.

## Test plan

- New Jest test (Step 1) — the regression gate: StrictMode + persisting keys
  across dataset switches, asserting no remount and no initial-replay.
- Optional Cypress page/spec (Step 2) if JSDOM can't show it.
- Pattern source: `AnimatePresence.test.tsx` lines 412–486 (wait-mode
  fast-switch pair with/without strict mode).

## Done criteria

- [ ] New test fails on main, passes with fix (both states demonstrated in PR description)
- [ ] `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence"` exits 0
- [ ] Cypress presence specs pass on React 18 and React 19 (CLAUDE.md recipe)
- [ ] `yarn build` exits 0; CHANGELOG entry added
- [ ] No files outside Scope modified (`git status`)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Cannot make any test fail after Step 1 (2–3 variations) AND Step 2 (2–3
  variations): per repo policy (no repro → no fix), comment on the issue asking
  the reporter for a self-contained repro (note CodeSandbox was inaccessible),
  set the README row to BLOCKED(needs-repro), and stop. Do NOT land
  speculative changes or happy-path tests.
- Root cause turns out to be in `PresenceChild` register/cleanup overlapping
  PR #3707's diff — stop and report; #3707 should land first.
- The fix breaks any existing AnimatePresence test twice in a row after a
  reasonable adjustment.
- Excerpts in "Current state" no longer match `index.tsx`.

## Maintenance notes

- Any future change to the render-phase diff (lines 125–158) must be re-tested
  under StrictMode; this is the second StrictMode bug in this component family
  (after adcf96dae). Consider a `describe` block that re-runs key presence
  tests inside StrictMode wholesale (deferred — out of this plan's scope).
