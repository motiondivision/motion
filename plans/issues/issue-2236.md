# Plan issue-2236: Fix snap-to-cursor offset for draggables inside position:sticky containers

> **Executor instructions**: Follow this plan step by step. Build the failing
> Cypress test FIRST. The root-cause analysis below is grounded in the code
> but the sticky scenario could not be run during planning (CodeSandbox
> blocked) — treat it as a strong hypothesis and verify via the test. Honor
> STOP conditions. Update this issue's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2236 --jq .state` → `open`.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
>    On changes, re-verify excerpts. If the drag engine moved to motion-dom
>    (plans 019/020), STOP and re-localize.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: soft: plans/issues/issue-2024.md (same "stale measurement
  after scroll" family; coordinate fixes should not conflict)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2236

## Why this matters

Reporter: a draggable inside a `position: sticky` container snaps to the
cursor correctly until the container "sticks"; after that, snap-to-cursor is
vertically offset and the element no longer follows the cursor. The sandbox
(`jfrhvq`) is Cloudflare-blocked, but the description plus video pin the
scenario precisely: `dragControls.start(event, { snapToCursor: true })` (the
only "snap to cursor on click" path) + sticky ancestor + window scroll.
Comments link #1535 (same family) and a layout-shift variant. Sticky/fixed
positioning is generally invisible to the projection system, but
snap-to-cursor specifically can be fixed locally by not trusting a stale
mount-time measurement.

## Current state

- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
  - `snapToCursor(point)` (lines 558–582): uses
    `projection.layout.layoutBox[axis]` and sets
    `axisValue.set(point[axis] - mixNumber(min, max, 0.5) + current)`.
    `point` is **page-space** (`pageX/pageY`, from
    `packages/framer-motion/src/events/event-info.ts:8-15`). The formula
    assumes `layoutBox` is the element's CURRENT page box including the
    current transform (see the comment at lines 571–576).
  - The layout it reads is measured at listener setup time:
    `addListeners()` lines 723–728 — `projection.updateLayout()` only `if (projection && !projection.layout)`, then never refreshed at gesture
    start. `start()`'s `onSessionStart` (lines 110–115) calls
    `snapToCursor` immediately with no re-measure.
- Why sticky breaks it: a page box = viewport box + root scroll
  (`packages/motion-dom/src/projection/node/create-projection-node.ts:1024-1043`).
  For a normal element this is scroll-invariant, so the mount-time
  measurement stays valid. For a STUCK sticky element the viewport box is
  scroll-invariant instead, so its true page box changes with every scrolled
  pixel past the stick point — the mount-time `projection.layout` is stale by
  exactly `scrollY - stickPoint`, matching the reported symptom (vertical
  offset that appears only after sticking).
- Pattern for the fix already exists in this file: `resolveRefConstraints()`
  lines 423–426 clears `projection.root.scroll` and calls
  `projection.root.updateScroll()` to bypass the per-animationId scroll cache
  (commit `cfccb0300`).
- Existing test page exemplar for external-trigger snap-to-cursor:
  `dev/react/src/tests/drag-snap-to-cursor.tsx` (uses
  `dragControls.start(e, { snapToCursor: true })` from a separate
  pointer-down pad).

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress React 18/19 | CLAUDE.md recipe, `--spec cypress/integration/drag-snap-to-cursor-sticky.ts` | pass after fix |
| Jest drag | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` | all pass |

## Scope

**In scope**:
- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
  (`snapToCursor` and/or `onSessionStart` only)
- `dev/react/src/tests/drag-snap-to-cursor-sticky.tsx` (create)
- `packages/framer-motion/cypress/integration/drag-snap-to-cursor-sticky.ts` (create)

**Out of scope**:
- Making the projection system model sticky/fixed positioning generally
  (constraints, layout animations under sticky) — that is a projection-level
  project; note remaining gaps in the PR body instead.
- `PanSession`, momentum, constraint resolution.

## Git workflow

- Branch: `fix/issue-2236-snap-to-cursor-sticky`
- PR via `gh pr create`; body edits via `gh api -X PATCH .../pulls/<n>`.

## Steps

### Step 1: Failing Cypress test

Page `dev/react/src/tests/drag-snap-to-cursor-sticky.tsx` (export `App`),
modeled on `drag-snap-to-cursor.tsx`:

- Body content 3000px tall.
- A spacer of 300px, then a sticky wrapper:
  `<div style={{ position: "sticky", top: 0, height: 200 }}>` containing
  - a 200×200 pointer pad (`id="trigger"`) with
    `onPointerDown={(e) => dragControls.start(e, { snapToCursor: true })}`
  - `<motion.div data-testid="draggable" drag dragControls={dragControls} dragListener={false} dragMomentum={false} style={{ width: 50, height: 50 }} />`
- Read `?scroll=` from the URL and `window.scrollTo(0, scroll)` in a
  `useLayoutEffect` (same pattern as
  `dev/react/src/tests/drag-ref-constraints-absolute-scrolled.tsx:16-21`).

Spec `packages/framer-motion/cypress/integration/drag-snap-to-cursor-sticky.ts`:

1. `cy.viewport(1000, 800).visit("?test=drag-snap-to-cursor-sticky&scroll=600").wait(300)` — wrapper is stuck (scroll 600 > 300 stick point).
2. `cy.window().then((win) => expect(win.scrollY).to.eq(600))`.
3. Trigger `pointerdown` on `#trigger` at a known position; Cypress
   coordinates are element-relative — compute and also pass explicit
   `clientX/clientY` AND `pageX/pageY` (`pageY = clientY + 600`) in the
   trigger options: `cy.get("#trigger").trigger("pointerdown", { clientX: 150, clientY: 100, pageX: 150, pageY: 700, force: true })`.
   (jQuery-triggered PointerEvents in Cypress take coordinates verbatim —
   set both pairs explicitly so `pageY` is realistic.)
4. Follow with a small `pointermove` (+5,+5, same coordinate discipline) and
   `pointerup`, `.wait(200)`.
5. Assert with `.then()`: the draggable's
   `getBoundingClientRect()` center ≈ (155, 105) in client space (±10).
   Before the fix, expect the y-center to be off by ~600 minus the stick
   distance (record the actual delta).

**Verify**: spec FAILS at `42bfbe3ed` with a vertical offset. If it does not
fail: first check the trigger's `pageY` actually reached the handler
(`console.log` in the page's onPointerDown); try 2–3 variants (e.g. scroll
amount, sticky offset), then STOP per the no-repro rule — and say whether
the synthetic-event coordinate plumbing or the sticky behavior in
Electron/Chromium is the blocker (try `--browser chrome`).

### Step 2: Re-measure before snapping

In `VisualElementDragControls.ts`, at the top of `snapToCursor` (before the
`eachAxis` loop) refresh the measurement so `projection.layout` reflects the
element's CURRENT page box:

```ts
const { projection } = this.visualElement
if (projection) {
    if (projection.root) {
        projection.root.scroll = undefined
        projection.root.updateScroll()
    }
    projection.updateLayout()
}
```

Rationale: `updateLayout()` re-runs `measure(false)`
(`create-projection-node.ts:926`), producing a transform-inclusive,
current-scroll page box — exactly what the existing `+ current` formula
assumes. The root-scroll cache-clear mirrors `resolveRefConstraints()`
(lines 423–426).

Note `updateLayout()` fires the `"measure"` event (line 931), which re-runs
`measureDragConstraints` → `resolveRefConstraints()` — for a sticky-stuck
element this also FRESHENS ref constraints, which is desirable; but watch
Step 3's regression suite for double-resolution side effects.

**Verify**: `yarn build` → exit 0; Step 1 spec passes on React 18.

### Step 3: Regression pass

**Verify**:
- New spec on React 19 → passes.
- Existing Cypress: `drag-snap-to-cursor` has no spec (page only), so run
  `drag.ts`, `drag-ref-constraints-absolute-scrolled.ts`,
  `drag-ref-constraints-element-resize.ts`, `drag-tabs.ts` on React 18 →
  pass (re-run once on flake; twice-failing = real, STOP).
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` → all pass.

## Test plan

- New Cypress spec: snap-to-cursor accuracy when sticky container is stuck
  (the bug) AND when not scrolled (`&scroll=0` second test in same spec —
  guards against regressing the normal path). React 18 + 19.

## Done criteria

- [ ] New spec (stuck + unstuck cases) passes React 18 + 19; stuck case
      failed before the fix
- [ ] Existing drag Cypress specs + Jest drag suite pass
- [ ] Only in-scope files modified
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 1 cannot produce a failing test (see Step 1 escape).
- The fix requires modeling sticky inside projection
  (`create-projection-node.ts`) — out of scope, report.
- `updateLayout()` in `snapToCursor` breaks a layout-animation Cypress spec
  (`layout.ts` family) — report with the failing spec; an alternative is
  measuring locally (getBoundingClientRect + live scroll) without writing to
  `projection.layout`, but that diverges from the `+ current` formula's
  assumptions, so it needs maintainer eyes.

## Maintenance notes

- This fixes snap-to-cursor only. Drag CONSTRAINTS under sticky remain
  approximate (stale until next "measure"); the general sticky/fixed story
  belongs to the projection system — record as a known limitation in the PR.
- Plans 019–021 port this file; the re-measure-on-snap behavior must port
  with it (it is also the right behavior for the vanilla `drag()` of plan
  020).
