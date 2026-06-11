# Plan issue-1764: Attempt a deterministic repro of Reorder.Item drift when scaled via whileDrag; fix only if it reproduces, else close needs-repro

> **Executor instructions**: Follow this plan step by step; run every
> verification command. If a STOP condition occurs, stop and report.
> When done, update this plan's row in `plans/issues/README.md`.
> Repo policy applies hard here: **no repro → no fix, and no speculative
> "coverage" tests** (see memory note feedback_no_repro_no_pr).
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/1764 --jq .state` → `open` (if `closed`, mark DONE-ALREADY and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/components/Reorder packages/motion-dom/src/projection` — on changes to `delta-remove.ts`/`Item.tsx`, re-verify excerpts below.

## Status

- **Classification**: NEEDS-REPRO (repro attempt with a decision tree)
- **Priority**: P2
- **Effort**: M
- **Risk**: MED (layout-animation timing makes drift assertions flake-prone)
- **Depends on**: none (read `plans/issues/issue-2449.md` for cluster context; do NOT wait on it — this issue's mechanism is different)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1764

## Why this matters

#1764 (2022): a `Reorder.Item` scaled during `whileDrag` ends up with a
residual `translateX` after reordering — ~1px per reorder in the reporter's
sandbox, but reportedly ~10px increments accumulating past 100px in their
real app. Unlike the raw-CSS-scale cluster (#2449/#2750), `whileDrag` scale
IS a tracked motion value, so the projection system *does* see it — meaning
this is either (a) measurement error while the item is mid-scale-animation,
(b) the #3356 transform-origin blind spot (projection removes tracked scale
using `originX`/`originY` from `latestValues`, defaulting to 0.5; a CSS
`transform-origin` style is invisible, so boxes measured while scaled are
"unscaled" around the wrong point — a per-reorder constant error that
accumulates), or (c) sub-pixel rounding (the 1px sandbox case, arguably
ignorable). The sandbox (`7ol68d`) is Cloudflare-blocked for agents and is
4 years old. The only honest path is a fresh deterministic repro attempt with
a decision tree.

## Current state

- `packages/framer-motion/src/components/Reorder/Item.tsx:98–127` — Item is a
  draggable `layout` component with `dragSnapToOrigin`; after a reorder the
  swap is applied via `onReorder` and the layout animation moves rows.
- Drag origin compensation during layout change:
  `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:742–759`
  — on projection `didUpdate` with `hasLayoutChanged`, both `originPoint` and
  the axis motion value are shifted by `delta[axis].translate`. Any error in
  that delta (e.g. from de-scaling around the wrong origin) lands directly in
  the item's `x` and is never corrected, because `dragSnapToOrigin` animates
  back to the *shifted* origin. This is the prime suspect for accumulation.
- Scale removal during measurement:
  `packages/motion-dom/src/projection/geometry/delta-remove.ts` —
  `removeAxisTransforms`/`removeBoxTransforms` use `latestValues.originX/originY`
  with a 0.5 default; CSS `transform-origin` is invisible (established in the
  #3356 investigation — users must use `originX`/`originY` motion values).
  Verify this file's current shape before citing it in any fix.
- Repro ingredients from the issue: vertical Reorder list, items scaled via
  `whileDrag={{ scale: 1.0x }}`, repeated reorders, residual `translateX`
  that should be 0 once settled.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Server (React 18) | `PORT=$((10000 + RANDOM % 50000)); cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &` then `npx wait-on http://localhost:$PORT` | up |
| Spec | `cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/reorder-whiledrag-scale.ts` | see decision tree |
| React 19 | same with `dev/react-19` + `--config-file=cypress.react-19.json` | — |

Foreground Cypress only; capture with `tail -60`. Time-box the whole repro
phase to ~3 attempts per CLAUDE.md ("stop after 2-3 attempts" when an
environment refuses to reproduce).

## Scope

**In scope** (create/modify only):
- `dev/react/src/tests/reorder-whiledrag-scale.tsx` (create)
- `packages/framer-motion/cypress/integration/reorder-whiledrag-scale.ts` (create)
- `plans/issues/README.md` (status row)

**Out of scope** (without a confirmed repro):
- ANY change to `delta-remove.ts`, `Item.tsx`, `VisualElementDragControls.ts`,
  or projection source. If the repro confirms, STOP and report — the fix gets
  its own reviewed plan (it touches projection math that PR #3748/#3749 are
  actively reshaping).

## Steps

### Step 1: Build the repro fixture

Create `dev/react/src/tests/reorder-whiledrag-scale.tsx` (named `App` export):
vertical `Reorder.Group` (model on `dev/react/src/tests/drag-to-reorder.tsx`),
4 items of fixed height (e.g. 48px + 8px gap), each `Reorder.Item` with
`whileDrag={{ scale: 1.1 }}` and an `id` per item. Two URL params:

- `?origin=css` → items get CSS `style={{ transformOrigin: "top left" }}`
  (the #3356 blind-spot variant, predicted to drift).
- default → no transform-origin override (the sandbox variant, predicted ≤1px
  rounding drift).

**Verify**: `yarn build` exit 0; fixture loads (via Step 2's run).

### Step 2: Write the drift-detection spec and attempt the repro

Create `packages/framer-motion/cypress/integration/reorder-whiledrag-scale.ts`:

- One test per fixture mode. Each: perform 4 drag-reorder cycles (pointerdown
  on item A, move past threshold, move ~60px down to cross the next item's
  center, pointerup, `cy.wait(600)` for `dragSnapToOrigin` + layout animation
  to settle).
- After all cycles and a final `cy.wait(800)`, read each item's settled
  transform with `.then()` + `getComputedStyle(el).transform` and assert the
  residual translation is < 2px (parse the matrix; `none` passes). Use
  `.then()`, not `.should()` retries, for the drift measurement — but only
  after the settle wait.
- Also assert horizontal alignment: every item's `getBoundingClientRect().left`
  within 2px of the group's content left.

Run on React 18. **Decision tree**:

- **Both modes pass (no drift > 2px)** → not reproducible here; go to Step 4
  (needs-repro close path). Do not keep the new files in a PR ("no repro → no
  speculative coverage"); delete them or leave uncommitted.
- **`origin=css` drifts, default doesn't** → confirmed #3356 transform-origin
  limitation, not a new bug → go to Step 3 (support close path); keep the
  default-mode test only if it adds regression value, per maintainer review.
- **Default mode drifts > 2px** → REAL BUG CONFIRMED → STOP condition: report
  the failing spec + measurements (this becomes a FIX plan against
  `didUpdate` delta math / `delta-remove.ts`, to be sequenced with PR #3748/#3749).

**Verify**: a clean Cypress run with recorded outcomes for both modes (React 18; run React 19 only for whichever outcome you'll cite in the close).

### Step 3 (gated): Close as documented #3356 limitation (only if the css-origin branch hit)

**Gate: only if this plan's row in `plans/issues/README.md` is marked APPROVED.**

Comment: the drift comes from scaling around CSS `transform-origin`, which the
projection system cannot see; use `originX`/`originY` motion-value styles
instead of CSS `transform-origin` when combining `whileDrag` scale with
Reorder/layout animations (the #3356 resolution); the ≤1px residual in the
original sandbox is sub-pixel rounding.
Close: `gh api -X PATCH repos/motiondivision/motion/issues/1764 -f state=closed -f state_reason=not_planned`.

### Step 4 (gated): Close as needs-repro (only if nothing reproduced)

**Gate: only if this plan's row in `plans/issues/README.md` is marked APPROVED.**

Comment: describe the repro attempt (fixture shape, 4-cycle drift assertion,
<2px residual on current main), note the original sandbox is 4 years old and
inaccessible to automation, and ask for a fresh repro against the latest
release. Close: `gh api -X PATCH repos/motiondivision/motion/issues/1764 -f state=closed -f state_reason=not_planned`.

## Test plan

The spec in Step 2 IS the test plan; whether it ships depends on the decision
tree (a permanently-green speculative test must not land per repo policy).

## Done criteria

- [ ] Fixture + spec written; repro attempt executed with recorded outcome per mode
- [ ] Exactly one decision-tree branch followed; no projection/Reorder source touched
- [ ] Issue commented + closed only if README row APPROVED; otherwise row updated with the branch reached ("REPRO-CONFIRMED — needs fix plan" / "TRIAGED-3356 — awaiting close approval" / "NO-REPRO — awaiting close approval")

## STOP conditions

- Default-origin mode drifts > 2px (real bug) — report, do not fix here.
- Drift appears only on one React version — report both outputs, do not close.
- The spec itself is too flaky to give a stable verdict after 3 tuning
  attempts (adjust waits/distances, never tolerances above 2px) — report as
  inconclusive; do not close on a flaky green.

## Maintenance notes

- If this becomes a fix plan: the suspect surfaces are `didUpdate`'s
  `delta[axis].translate` compensation (`VisualElementDragControls.ts:742–759`)
  and origin handling in `removeAxisTransforms`; both are reshaped by the
  in-flight PR #3748/#3749 work — sequence accordingly.
- Cluster cross-reference: #2449/#2750 (raw CSS parent scale) are a different
  mechanism with their own plans; don't merge the closes.
