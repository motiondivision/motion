# Plan issue-1630: Add an opt-in to run layout animations while an ancestor is being dragged

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the row for this issue in `plans/issues/README.md` (add
> one if missing).
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/projection/node/create-projection-node.ts packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts packages/framer-motion/src/motion/utils/use-visual-element.ts`
> If any in-scope file changed, compare the "Current state" excerpts against
> the live code; on a mismatch, treat as a STOP condition. Also confirm the
> issue is still open: `gh api repos/motiondivision/motion/issues/1630 --jq .state`
> → `open`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: maintainer API approval (Step 0); covers issue #2248 (see `plans/issues/issue-2248.md`)
- **Category**: feature
- **Classification**: FEATURE (maintainer confirmed current behavior is by design but the feature is desirable)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1630

## Why this matters

While a drag gesture is active, layout animations are blocked for the dragged
element **and its entire subtree**. The maintainer confirmed in the issue
(2022-08-16): "This is by design. Consider the `Reorder` component … But I can
see how in this case it would be desirable." Users with animating content
inside a draggable (issue #1630: infinite layout animation inside a slider)
or who trigger layout changes from `onDrag` (issue #2248) get an instant jump
instead of an animation. This plan ships an opt-in prop so the default
(Reorder-safe) behavior is unchanged.

## Current state

- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:138-141`
  — drag start blocks animations on the dragged node's projection:
  ```ts
  if (this.visualElement.projection) {
      this.visualElement.projection.isAnimationBlocked = true
      this.visualElement.projection.target = undefined
  }
  ```
  `cancel()` clears it at `VisualElementDragControls.ts:292-294`.
- `packages/motion-dom/src/projection/node/create-projection-node.ts:633-639`
  — blocking is inherited by the whole subtree:
  ```ts
  isTreeAnimationBlocked() {
      return (
          this.isAnimationBlocked ||
          (this.parent && this.parent.isTreeAnimationBlocked()) ||
          false
      )
  }
  ```
- `create-projection-node.ts:507-511` — the `didUpdate` listener bails before
  starting any layout animation:
  ```ts
  if (this.isTreeAnimationBlocked()) {
      this.target = undefined
      this.relativeTarget = undefined
      return
  }
  ```
- `create-projection-node.ts:2359-2364` — `ensureDraggedNodesSnapshotted`
  already ensures blocked nodes get measured; do not change it.
- Prop plumbing exemplar (`layoutRoot`): declared in
  `packages/motion-dom/src/node/types.ts:958` and
  `packages/motion-dom/src/projection/node/types.ts:194`, passed to projection
  options in `packages/framer-motion/src/motion/utils/use-visual-element.ts:195-233`
  (destructured from props, included in `projection.setOptions({...})`).
  Mirror this exact path for the new prop.

## Proposed API

`layoutWhileDrag?: boolean` (default `false` = current behavior). When `true`
on a `layout`/`layoutId` component, its layout animations are NOT suppressed
by an active drag on itself or any ancestor. Implementation is one check in
`isTreeAnimationBlocked()`:

```ts
isTreeAnimationBlocked() {
    if (this.options.layoutWhileDrag) return false
    ...existing body...
}
```

This single check covers both reported scenarios: a `layout` child inside a
dragged parent (#1630, blocked via the parent walk) and the dragged element
itself (#2248, blocked via its own `isAnimationBlocked`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="drag"` | pass (ignore pre-existing TextEncoder SSR failures) |
| Cypress (React 18) | see block below | spec passes |
| Cypress (React 19) | see block below | spec passes |
| Lint | `yarn lint` | exit 0 |

Cypress (run BOTH React versions — CI requires it):

```bash
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/layout-while-drag.ts
kill $DEV_PID
# React 19: same, from dev/react-19, add --config-file=cypress.react-19.json
```

Run Cypress in the foreground; capture output with `tail -60` on the first run.

## Scope

**In scope**:
- `packages/motion-dom/src/projection/node/create-projection-node.ts` (the
  `isTreeAnimationBlocked` early-return only)
- `packages/motion-dom/src/projection/node/types.ts` (add `layoutWhileDrag` to options)
- `packages/motion-dom/src/node/types.ts` (prop declaration + JSDoc, next to `layoutRoot` at :958)
- `packages/framer-motion/src/motion/utils/use-visual-element.ts` (plumb prop into `setOptions`)
- `dev/react/src/tests/layout-while-drag.tsx` (create)
- `packages/framer-motion/cypress/integration/layout-while-drag.ts` (create)
- `plans/issues/README.md` (status row)

**Out of scope**:
- `VisualElementDragControls.ts` — do NOT stop setting `isAnimationBlocked`;
  the flag still drives `ensureDraggedNodesSnapshotted` and Reorder behavior.
- Any change to default behavior (Reorder depends on blocking; the
  `drag-layout-reorder-strict` spec is the regression gate).
- `Reorder/*` components.

## Git workflow

- Branch: `fix/issue-1630-layout-while-drag`
- Commit style: short imperative subjects (match `git log --oneline`), end with
  the Claude co-author trailer per repo instructions.
- Open a PR with `gh pr create` referencing #1630 and #2248. Do not use
  `gh pr edit` (broken on this repo — use `gh api -X PATCH repos/motiondivision/motion/pulls/<n>` if edits are needed).

## Steps

### Step 0: Decision gate — API name and feature approval

Do not implement until the maintainer has set this plan's row in
`plans/issues/README.md` to `APPROVED` (confirming both that the feature is
wanted and the prop name `layoutWhileDrag`). The 2022 maintainer comment
signals openness, not approval. If the row is absent or not APPROVED, STOP and
report.

### Step 1: Failing Cypress test (write it against main first)

Create `dev/react/src/tests/layout-while-drag.tsx` exporting `App`:
- A draggable parent: `<motion.div drag id="parent">` (~300×300, position fixed
  away from edges).
- Inside it, a child `<motion.div layout layoutWhileDrag id="child">` whose
  position is toggled by parent flex `justifyContent: flex-start ↔ flex-end`
  driven by component state.
- Read URL params (`new URLSearchParams(window.location.search)`): when
  `?optIn=false`, omit `layoutWhileDrag` (for the regression case).
- In `onDragStart`, schedule `setTimeout(() => setToggled(true), 200)` so the
  layout change happens mid-drag without needing a click.
- Use `transition={{ layout: { type: "tween", ease: "linear", duration: 10 } }}`
  so mid-animation values are proportionally checkable (per repo testing
  conventions).

Create `packages/framer-motion/cypress/integration/layout-while-drag.ts`
modeled on `packages/framer-motion/cypress/integration/drag-layout-reorder-strict.ts`
(pointer-event sequencing for an in-progress drag — pointerdown + several
pointermoves, no pointerup):

1. **Opt-in case** (`?test=layout-while-drag`): start a drag, hold (no
   pointerup), wait ~1200ms (toggle at 200ms + ~1s into the 10s tween), then in
   a `.then()` (NOT `.should()`) read the child's computed transform. Expect a
   non-identity translate strictly between origin and target (i.e. the child is
   animating). On unfixed main this fails: the tree is animation-blocked, the
   child jumps, computed transform is `none`/identity.
2. **Regression case** (`?test=layout-while-drag&optIn=false`): same sequence,
   expect the child to have jumped (transform `none`/identity at the new
   layout) — current behavior preserved.

**Verify**: run the spec against unmodified main → case 1 fails, case 2
passes. This is the "failing test first" gate; record the failure output.

### Step 2: Implement the prop

1. `packages/motion-dom/src/projection/node/types.ts` — add
   `layoutWhileDrag?: boolean` to the options interface next to `layoutRoot`
   (:194).
2. `packages/motion-dom/src/node/types.ts` — add the public prop with JSDoc
   (next to `layoutRoot` at :958), documenting default `false` and the
   Reorder rationale for the default.
3. `packages/framer-motion/src/motion/utils/use-visual-element.ts` — add
   `layoutWhileDrag` to the destructure (~:197-206) and to `setOptions`
   (~:215-233), exactly as `layoutRoot` is handled.
4. `create-projection-node.ts` `isTreeAnimationBlocked()` (:633) — add
   `if (this.options.layoutWhileDrag) return false` as the first line.
   Keep the byte cost minimal (this ships to users).

**Verify**: `yarn build` → exit 0.

### Step 3: Run the new spec on both React versions

Commands above. **Verify**: both cases pass on React 18 AND React 19.

### Step 4: Regression gates

- `cypress run ... --spec cypress/integration/drag-layout-reorder-strict.ts` → passes
  (Reorder-during-drag behavior unchanged; this spec is known-flaky per
  `plans/issues/README.md` — re-run once on failure; same failure twice = STOP).
- `cypress run ... --spec cypress/integration/drag-nested.ts` → passes (also flaky-listed; same rule).
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="drag|layout"` → no new failures.

## Done criteria

- [ ] `yarn build` exits 0; `yarn lint` exits 0
- [ ] New spec passes on React 18 and React 19; opt-in case verified failing pre-fix
- [ ] `drag-layout-reorder-strict.ts` and `drag-nested.ts` pass
- [ ] No behavior change without the prop (regression case in spec)
- [ ] PR open referencing #1630 and #2248; `plans/issues/README.md` row updated

## STOP conditions

- Step 0 gate not APPROVED.
- PR #3748 or #3749 has merged and `create-projection-node.ts` or the
  VisualElement options plumbing no longer matches the excerpts (both PRs
  reshape projection/render internals) — re-ground before editing.
- The opt-in case still fails after Step 2: likely the child's layout change
  is also gated elsewhere (e.g. `willUpdate` never ran because the parent
  memoized). Investigate `ensureDraggedNodesSnapshotted` interplay once; if
  unresolved, report rather than widening the change.
- `drag-layout-reorder-strict.ts` fails twice in a row after the change.

## Maintenance notes

- Issue #2248 must be commented/closed together with this PR (see
  `plans/issues/issue-2248.md`) — its scenario (layout change from `onDrag` on
  the dragged element itself) should be added as a third Cypress case if cheap.
- Plans 019–021 (drag engine port to motion-dom) will move
  `VisualElementDragControls.ts`; this plan deliberately doesn't touch it, so
  there is no conflict, but the new prop's JSDoc should be carried into the
  vanilla `drag()` options when plan 020 lands.
- Document `layoutWhileDrag` on motion.dev (docs live outside this repo — note
  in the PR body for the maintainer).
