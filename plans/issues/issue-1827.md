# Plan issue-1827: Verify ref-based dragConstraints now track post-render size changes, add a state-driven-resize regression test, then close

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/1827 --jq .state` → `open` (if `closed`, mark this plan DONE-ALREADY and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts packages/framer-motion/cypress/integration/ dev/react/src/tests/` — if `VisualElementDragControls.ts` changed, re-verify the "Current state" excerpts before proceeding; on a mismatch, STOP.

## Status

- **Classification**: VERIFY-FIXED
- **Priority**: P1 (9 comments, recurring "any fix?" pings through 2025)
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / tests
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1827

## Why this matters

Issue #1827 (2022): with `dragConstraints` set to a React ref, the draggable
area was computed once from the initial render and never updated when the
draggable element (or constraints container) changed size afterwards. It is
the most-subscribed open drag issue (9 comments, workarounds via `key`
remounting). Since it was filed, main gained a ResizeObserver-driven
constraint recalculation (PR #3690, commits `801a699a5` + `a4df97a6c`,
regression test `ef448a8d5` for #2903/#2458) and a root-scroll refresh before
ref-constraint measurement (`cfccb0300`, #2829). The core repro is almost
certainly fixed, but there is no regression test for the *React-state-driven*
resize variant that #1827 actually reported (existing fixtures resize via
motion values or imperative DOM mutation). This plan verifies, adds that
test, and closes the issue with an accurate breakdown of which commenter
variants are fixed and which belong to the scaled-drag cluster.

## Current state

- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
  - `resolveConstraints()` runs at every drag start (`onStart` calls it, line 136). For ref constraints it reuses the cache: lines 351–354:
    ```ts
    if (dragConstraints && isRefObject(dragConstraints)) {
        if (!this.constraints) {
            this.constraints = this.resolveRefConstraints()
        }
    ```
  - But `addListeners()` (lines 699–728) installs a ResizeObserver on **both** the draggable element and the constraints element via `startResizeObservers` (lines 803–814); on resize it calls `scalePositionWithinConstraints()` (lines 589–659), which resets `this.constraints = false` and re-resolves with a fresh layout measurement.
  - A window-resize listener does the same (lines 734–736).
  - `resolveRefConstraints()` refreshes root scroll before measuring (lines 423–426, from `cfccb0300`).
- Existing fixtures/specs covering adjacent scenarios (use as structural models):
  - `dev/react/src/tests/drag-ref-constraints-element-resize.tsx` + `packages/framer-motion/cypress/integration/drag-ref-constraints-element-resize.ts` — draggable resized via **motion values** (issue #2458).
  - `dev/react/src/tests/drag-ref-constraints-resize-handle.tsx` + spec — imperative DOM mutation resize (issue #2903).
- The original CodeSandbox (`7ixkj0`, and `phn2mh` from o-alexandrov's comment) is Cloudflare-blocked for agents; the issue body + comments fully describe the repro: a button changes the draggable's size after first render; the drag range must change accordingly.
- Commenter variants to triage in the closing comment:
  1. **Size change via state/props** (reporter, abn5x, vogone1) — should be fixed by the ResizeObserver path (verified in Step 2/3).
  2. **`scale` on the draggable or an ancestor** (vavra7, kvnzrch) — transform changes do NOT fire ResizeObserver and raw CSS scale is invisible to projection; this is the scaled-drag cluster (see `plans/issues/issue-2449.md`); not fixed here, point them at `correctParentTransform`.
  3. **`dragConstraints` switching `false → {top: 200}`** (o-alexandrov) — plain-object constraints are recomputed at every drag start (`resolveConstraints`, lines 356–360), so this should already work; spot-check in Step 3.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build (repo root) | `yarn build` | exit 0 |
| Dev server (React 18) | `PORT=$((10000 + RANDOM % 50000)); cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &` then `npx wait-on http://localhost:$PORT` | server up |
| Cypress (React 18) | `cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/<spec>.ts` | all pass |
| Dev server (React 19) | same pattern from `dev/react-19`, fresh `$PORT` | server up |
| Cypress (React 19) | add `--config-file=cypress.react-19.json` | all pass |

Run Cypress in the foreground (never background). Capture output with `tail -60`.

## Scope

**In scope** (the only files you may create/modify):
- `dev/react/src/tests/drag-ref-constraints-rerender-resize.tsx` (create)
- `packages/framer-motion/cypress/integration/drag-ref-constraints-rerender-resize.ts` (create)
- `plans/issues/README.md` (your status row)

**Out of scope**:
- `VisualElementDragControls.ts` — this is a verification plan; if verification fails, STOP, do not patch.
- The scale variants — tracked by `plans/issues/issue-2449.md` / `issue-2750.md` / `issue-1764.md`.

## Steps

### Step 1: Run the existing adjacent specs to confirm the machinery works on main

`yarn build`, start the React 18 server, then run:
`cypress run --headed --config baseUrl=http://localhost:$PORT --spec "cypress/integration/drag-ref-constraints-element-resize.ts,cypress/integration/drag-ref-constraints-resize-handle.ts"`

**Verify**: both specs pass. If either fails, STOP (main has regressed; the issue is not fixed).

### Step 2: Add a fixture matching the #1827 repro (state-driven size change)

Create `dev/react/src/tests/drag-ref-constraints-rerender-resize.tsx` exporting named `App`:
a 500×500 `div` with `ref={constraintsRef}` (position: relative), containing a
`motion.div` with `drag`, `dragConstraints={constraintsRef}`, `dragElastic={0}`,
`dragMomentum={false}`, and `width/height` from `useState` (initially 100,
toggled to 300 by a `<button id="resize-trigger">` that calls `setState`). The
size must flow through React state into the `style` prop (NOT motion values —
that's what distinguishes this from `drag-ref-constraints-element-resize.tsx`).
Model the markup and ids on `dev/react/src/tests/drag-ref-constraints-element-resize.tsx`.

**Verify**: page loads at `http://localhost:$PORT/?test=drag-ref-constraints-rerender-resize` (curl returns 200 or check via the Cypress run in Step 3).

### Step 3: Add the spec and confirm it passes

Create `packages/framer-motion/cypress/integration/drag-ref-constraints-rerender-resize.ts`, modeled on `drag-ref-constraints-element-resize.ts`:

1. Before resize: drag the box far right/down (e.g. pointer delta 600px) → `getBoundingClientRect().right` clamps to ≤ ~500 (container edge), i.e. travel ≈ 400px.
2. Click `#resize-trigger`, `cy.wait(200)` (let ResizeObserver + `scalePositionWithinConstraints` run).
3. Drag far right again → box right edge still clamps to ≤ ~500; with the box now 300px wide, its `left` can be at most ~200. Assert `left` ≤ 210 after an oversized drag. Without the ResizeObserver fix this fails (the old cached constraints allow 400px of travel → `left` ≈ 400).
4. Use `.then()` for measurements where mid-state matters; allow a few px tolerance.

Run on React 18, then repeat server+run on React 19 (`cypress.react-19.json`). Both MUST pass (CI runs both).

**Verify**: spec passes on React 18 AND React 19.

### Step 4 (gated): Comment and close

**Gate: only execute this step if this plan's row in `plans/issues/README.md` is marked APPROVED by the maintainer.**

Post a comment via `gh api repos/motiondivision/motion/issues/1827/comments -f body="..."` summarizing:
- Fixed on main by the ResizeObserver constraint recalculation (PR #3690) + scroll refresh (#2829 fix); regression test added (name the new spec).
- The `scale`-related reports in this thread (vavra7, kvnzrch) are a different mechanism (transforms don't fire ResizeObserver; raw CSS scale is invisible to the projection system) — point to `correctParentTransform` + `MotionConfig transformPagePoint` and the scaled-drag tracking issue.
- Ask reporters to retest on the latest release.

Then close: `gh api -X PATCH repos/motiondivision/motion/issues/1827 -f state=closed -f state_reason=completed`.
(Do NOT use `gh issue close`/`gh pr edit` — Projects Classic GraphQL deprecation breaks some `gh` subcommands on this repo.)

## Test plan

- New: `drag-ref-constraints-rerender-resize` (state-driven resize → constraints update). This is the regression gate for #1827's exact repro.
- Existing: `drag-ref-constraints-element-resize`, `drag-ref-constraints-resize-handle` must stay green.

## Done criteria

- [ ] Existing two ref-constraints resize specs pass on React 18
- [ ] New fixture + spec exist; spec passes on React 18 AND React 19
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] Issue commented + closed **only if** README row says APPROVED; otherwise row updated to "VERIFIED — awaiting close approval"
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 1 or Step 3 fails: the bug (or a regression) is live on main — report with the Cypress output (`tail -60`), do not attempt a fix under this plan.
- The new test passes trivially even when you sabotage it (e.g. assert travel of 400px also passes) — your assertions aren't binding; fix the test, don't loosen tolerances past ±15px.
- `VisualElementDragControls.ts` excerpts don't match (drift).

## Maintenance notes

- If plan 019 (`plans/019-port-drag-pan-engine-to-motion-dom.md`) lands first, the drag engine file moves to motion-dom; the line references here go stale but the behavior contract (ResizeObserver recalcs ref constraints) is what the new spec pins.
- The scale variants stay open via the issue-2449/2750/1764 plans; do not promise a fix for them in the closing comment.
