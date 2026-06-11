# Plan issue-2488: Verify width-changing states no longer corrupt drag constraints; close if fixed

> **Executor instructions**: This is a VERIFY-FIXED plan. The goal is to
> determine whether commits `801a699a5` + `a4df97a6c` (Feb 2026, ResizeObserver
> constraint recalculation) already fixed this report, using a reconstructed
> repro. Follow steps in order; honor STOP conditions; update this issue's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2488 --jq .state` → `open`.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/drag/`
>    — if `VisualElementDragControls.ts` changed, re-verify excerpts below.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (verification only; fixing is gated)
- **Depends on**: none
- **Category**: bug (verification)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2488

## Why this matters

Report (Jan 2024, framer-motion v10-era): with ref-based `dragConstraints`,
animation states that change the element's `width` make the *effective*
constraints differ from the specified ones. The CodeSandbox
(`framer-motion-drag-reset-attempt-forked-pcthq9`) is Cloudflare-blocked, so
the repro must be reconstructed from the description: a draggable box whose
`width` changes via animation states, inside a ref constraint container.

Since the report, the drag system gained exactly the machinery this bug was
missing:

- `801a699a5` (2026-02-01) "fix(drag): Update constraints when draggable
  element or container resizes" — adds ResizeObserver on both the draggable
  and the constraint container.
- `a4df97a6c` (2026-02-03) "fix(drag): Fix resize observer setup and
  constraint recalculation".

Current code (verified at `42bfbe3ed`,
`packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`):
`startResizeObservers` (lines 803–814) observes element + constraints
container and calls `scalePositionWithinConstraints()` (lines 589–659), which
strips the transform, re-measures layout, resets `this.constraints = false`
and re-resolves. So a width change from an animation state should now trigger
a full constraint recalculation.

This plan verifies that with a Cypress repro. If it reproduces anyway, it
escalates (likely culprits listed in STOP conditions).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress React 18 | CLAUDE.md recipe (dev/react Vite on random port) with `--spec cypress/integration/drag-constraints-width-state.ts` | see steps |
| Cypress React 19 | CLAUDE.md recipe (dev/react-19 + `cypress.react-19.json`) | same result as 18 |

## Scope

**In scope**:
- `dev/react/src/tests/drag-constraints-width-state.tsx` (create)
- `packages/framer-motion/cypress/integration/drag-constraints-width-state.ts` (create)
- A comment on the issue; close is gated.

**Out of scope** (without escalation): any change under
`packages/framer-motion/src/` or `packages/motion-dom/src/`.

## Steps

### Step 1: Reconstruct the repro as a Cypress test

Test page `dev/react/src/tests/drag-constraints-width-state.tsx` (exported
`App`), modeled on `dev/react/src/tests/drag-ref-constraints.tsx`:

- Constraint container: `ref`'d div, `position: relative`, 400×400, at a
  known page position.
- Draggable: `motion.div` with `drag`, `dragConstraints={containerRef}`,
  `dragElastic={0}`, `dragMomentum={false}`, and `animate` toggling between
  two states via a button: state A `{ width: 100 }`, state B `{ width: 250 }`
  (use `transition={{ duration: 0.1 }}` so the resize settles fast).
- Height fixed at 100.

Spec `packages/framer-motion/cypress/integration/drag-constraints-width-state.ts`
(model pointer sequences on
`cypress/integration/drag-ref-constraints-element-resize.ts`, which tests the
adjacent scenario):

1. Click the toggle (width 100 → 250), `.wait(300)` for resize + observer.
2. Drag the box hard toward the bottom-right (`pointerdown` →
   two `pointermove`s to e.g. 800,800 with `force: true` → `pointerup`).
3. Assert with `.then()` that the box's `getBoundingClientRect().right`
   equals the container's `.right` (±5) and `.bottom` equals container
   `.bottom` (±5) — i.e. full travel, no shrunken range.
4. Drag back to top-left, assert `left`/`top` align with container (±5).
5. Toggle back to width 100, repeat 2–4.

**Verify**: spec runs to completion on React 18 (pass or fail is the
*finding*, not an error). Capture output with `tail -60`.

### Step 2A: If the spec PASSES (expected) — confirm and gate-close

1. Re-run on React 19 → must also pass.
2. Commit the test page + spec on branch
   `test/issue-2488-drag-constraints-width-state` and open a PR labeling it a
   regression test for #2488, body noting it verifies the fix landed in
   `801a699a5`/`a4df97a6c`. (Per repo policy on speculative coverage: this is
   acceptable here because the test exercises a *landed* fix — it is a
   regression gate, not happy-path padding. If the maintainer prefers no new
   test, the PR can be closed; the verification finding stands.)
3. Comment on the issue via
   `gh api repos/motiondivision/motion/issues/2488/comments -f body=...`:
   explain it was verified fixed by the ResizeObserver constraint
   recalculation shipped Feb 2026 (v12.23+), name the commits, ask the
   reporter to retest on latest v12.
4. **Close gate**: only if this issue's row in `plans/issues/README.md` is
   `APPROVED`:
   `gh api -X PATCH repos/motiondivision/motion/issues/2488 -f state=closed -f state_reason=completed`.
   Otherwise leave open, mark row `BLOCKED (awaiting close approval)`.

### Step 2B: If the spec FAILS — STOP and report (escalation path)

Do not fix in this plan. Report findings with the failing assertion values.
For the report, note the prime suspects:

- `resolveConstraints()` caches ref constraints (`if (!this.constraints)`,
  `VisualElementDragControls.ts:351-354`) — a width *animation in progress*
  at drag start measures a transient width.
- `skipFirstCall` wrapper (lines 792–801) — the first resize after observer
  setup is deliberately ignored; a width change racing observer setup would
  be missed.
- `scalePositionWithinConstraints` re-measures with the transform stripped
  (lines 622–627) — interplay with an in-flight width animation.

## Done criteria

- [ ] Cypress spec exists and was run on React 18 AND 19, outcome recorded
- [ ] Outcome PASS → comment posted; close only if gate APPROVED; regression-test PR opened
- [ ] Outcome FAIL → STOP report filed with failing values; no source changes
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Spec fails (Step 2B — escalation, not improvisation).
- Spec is flaky (passes/fails across runs): re-run twice; if still flaky,
  report — the drag Cypress family has known flakes (see
  `plans/issues/README.md` cross-cutting facts) and a flaky verdict is not
  evidence either way.
- The repro reconstruction feels off (e.g. you believe the sandbox used
  variants + `whileTap` width changes): note the uncertainty in the issue
  comment and ask the reporter to confirm against latest v12 — do NOT iterate
  more than one extra page variant (repo rule: no repro → no fix).
