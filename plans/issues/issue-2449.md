# Plan issue-2449: Prove `correctParentTransform` makes Reorder work inside a CSS-scaled parent, pin it with a Cypress test, then close as documented limitation + supported workaround

> **Executor instructions**: Follow this plan step by step; run every
> verification command. If a STOP condition occurs, stop and report.
> When done, update this plan's row in `plans/issues/README.md`.
> This is the **anchor plan for the scaled-parent cluster** (#2449, #2750,
> #1764 each have their own plan file; execute this one first).
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2449 --jq .state` → `open` (if `closed`, mark DONE-ALREADY and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/utils/transform-rotated-parent.ts packages/framer-motion/src/components/Reorder packages/framer-motion/src/gestures/drag` — on changes, re-verify the excerpts below.

## Status

- **Classification**: INVALID/SUPPORT (documented limitation; supported helper exists) + regression test
- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (test-only change); the *deep* fix is explicitly out of scope
- **Depends on**: none (but see Maintenance notes re PR #3748/#3749)
- **Category**: bug / tests / docs
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2449

## Why this matters

Reorder inside an ancestor with raw CSS `transform: scale()` breaks: the
dragged item translates faster/slower than the cursor and reorder thresholds
fire at wrong positions. Root cause is structural: the projection system only
sees **tracked motion values** — raw CSS transforms on ancestors are
invisible to `hasTransform`/`treeScale`, so layout boxes are measured in
screen (scaled) space while the drag offset motion value lives in local
(unscaled) space (same blind spot as #3356). Two prior fix attempts were
closed unmerged (PR #3502 scaled the reorder offset by `treeScale` — which
can't see raw CSS scale anyway; PR #3704 fixed the separate `scale: "100%"`
NaN bug #2857). Making the projection engine aware of raw CSS transforms is a
deep change that would collide with the in-flight rewrites (PR #3748
LayoutAnimationBuilder, PR #3749 effects/VisualElement unification), so it is
deliberately **not** attempted here.

What changed since the issue was filed: main now ships a public helper
`correctParentTransform(ref)` (PR #3624, fixing #3132 for plain drag) that
feeds `MotionConfig transformPagePoint` an inverse of the parent's computed
transform. Because `transformPagePoint` is applied to BOTH pan-session pointer
points and projection viewport measurements, it should make Reorder's
gesture offsets and measured boxes consistent again. This plan proves that
with a Cypress test, and closes #2449 with the documented workaround.

## Current state

- The coordinate mismatch, concretely:
  - `packages/framer-motion/src/components/Reorder/Item.tsx:105–110` — `onDrag` reads `offset = point[axis].get()` (local px) and calls `updateOrder(value, offset, velocity[axis])`.
  - `packages/framer-motion/src/components/Reorder/utils/check-reorder.ts:24–29` — compares `item.layout.max + offset > nextItemCenter`, where `layout` came from `onLayoutMeasure` → projection measurement in page space (scaled by any raw CSS ancestor scale). Mixed coordinate spaces ⇒ wrong thresholds.
  - Drag itself: `VisualElementDragControls.updateAxis` (`packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:319–338`) adds page-space pointer offsets to a local-space motion value ⇒ 1/scale tracking error (this half was #3132).
- The supported correction:
  - `packages/framer-motion/src/utils/transform-rotated-parent.ts:34–57` — `correctParentTransform(parentRef)` returns a `TransformPoint` that maps page points through the inverse of the parent's computed matrix. Exported from `framer-motion/src/index.ts` (public).
  - `transformPagePoint` reaches the pan session (`VisualElementDragControls.ts:255`) AND projection measurement (`motion-dom/src/render/VisualElement.ts:695–699` → `measureInstanceViewportBox(this.current, this.props)`; HTML implementation passes `props.transformPagePoint` into `measureViewportBox`, `motion-dom/src/projection/utils/measure.ts:8–15`). So boxes and pointer offsets land in the same (local) space.
- Existing exemplar proving the pattern for plain drag: `dev/react/src/tests/drag-scaled-parent.tsx` + `packages/framer-motion/cypress/integration/drag-scaled-parent.ts` (parent `scale(0.5)`/`scale(2)`, `transformOrigin: top left`, asserts cursor tracking within ±20px).
- The issue's CodeSandbox is Cloudflare-blocked for agents; the repro is fully described: the framer-motion drag-to-reorder list demo nested in an element with `transform: scale(...)`.
- Reorder fixture to model the list on: `dev/react/src/tests/drag-to-reorder.tsx` + spec `cypress/integration/drag-to-reorder.ts`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Server (React 18) | `PORT=$((10000 + RANDOM % 50000)); cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &` then `npx wait-on http://localhost:$PORT` | up |
| Spec | `cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/reorder-scaled-parent.ts` | pass |
| React 19 | same with `dev/react-19` + `--config-file=cypress.react-19.json` | pass |

Foreground Cypress only; capture output with `tail -60`.

## Scope

**In scope** (create/modify only):
- `dev/react/src/tests/reorder-scaled-parent.tsx` (create)
- `packages/framer-motion/cypress/integration/reorder-scaled-parent.ts` (create)
- `plans/issues/README.md` (status row)

**Out of scope**:
- Any change to projection, drag, or Reorder source. The "make it work
  without the helper" fix is a projection-engine design problem gated behind
  PR #3748/#3749 — record it, don't attempt it.
- Resurrecting PR #3502's `treeScale` offset scaling (rejected approach; treeScale can't see raw CSS scale).

## Steps

### Step 1: Build the fixture

Create `dev/react/src/tests/reorder-scaled-parent.tsx` exporting named `App`:

- Outer `div` with `ref={parentRef}`, `transform: scale(s)` where `s` comes
  from `?scale=` URL param (default `0.5`), `transformOrigin: "top left"`,
  fixed width/height (model on `drag-scaled-parent.tsx:8–24`).
- A `?corrected=` URL param: when `"true"`, wrap the list in
  `<MotionConfig transformPagePoint={correctParentTransform(parentRef)}>`;
  when absent, render without it. This lets one fixture demonstrate both the
  broken baseline and the corrected behavior.
- Inside: `Reorder.Group axis="y"` over 4 items (`values` in `useState`),
  each `Reorder.Item` ~50px tall with `id`/`data-testid` per item, modeled on
  `dev/react/src/tests/drag-to-reorder.tsx`.

**Verify**: `yarn build` exits 0; page renders at `?test=reorder-scaled-parent&corrected=true` (confirmed implicitly by Step 2's run).

### Step 2: Write the spec — corrected mode must track and reorder correctly

Create `packages/framer-motion/cypress/integration/reorder-scaled-parent.ts` with two tests:

1. **Cursor tracking (corrected)**: visit `?test=reorder-scaled-parent&corrected=true&scale=0.5`; pointerdown on item 1, move past threshold, then move +100px screen-Y; with `.then()` assert the item's `getBoundingClientRect().top` moved ≈100px screen px (±20) — i.e. it follows the cursor (model assertions on `drag-scaled-parent.ts:13–30`).
2. **Reorder fires correctly (corrected)**: drag item 1 down far enough to cross item 2's center (remember: screen distance = local distance × 0.5 — drag well past, e.g. 80 screen px for 50px local rows), release, then assert the DOM order swapped (model on `drag-to-reorder.ts`'s order assertions) and that the released item settles aligned with the others (`translateX`/`translateY` ≈ 0 via computed style after `cy.wait(500)`).

Optionally add a third, **baseline documentation test** marked with a comment
(not an assertion of brokenness that would flake): skip it if it can't be made
deterministic — the corrected-mode tests are the regression gate.

Run on React 18 AND React 19.

**Verify**: spec passes on both. If the corrected-mode tests FAIL, that is a
STOP condition — the helper does not cover Reorder and this issue needs a
real fix plan instead of a support close.

### Step 3 (gated): Comment and close

**Gate: only if this plan's row in `plans/issues/README.md` is marked APPROVED.**

Comment via `gh api repos/motiondivision/motion/issues/2449/comments -f body="..."`:
- Raw CSS transforms on ancestors are invisible to the projection/drag
  measurement system by design (it tracks motion values, not computed
  styles) — this is a documented limitation.
- The supported pattern, now covered by a regression test, is:
  ```jsx
  const ref = useRef(null)
  <div ref={ref} style={{ transform: "scale(0.5)" }}>
    <MotionConfig transformPagePoint={correctParentTransform(ref)}>
      <Reorder.Group ...>...</Reorder.Group>
    </MotionConfig>
  </div>
  ```
  (`correctParentTransform` is exported from `framer-motion`/`motion/react`, shipped since the #3132 fix.)
- Native engine awareness of raw CSS transforms is tracked as a design item
  gated behind the in-flight projection rewrites.

Close: `gh api -X PATCH repos/motiondivision/motion/issues/2449 -f state=closed -f state_reason=not_planned`.

## Test plan

- New `reorder-scaled-parent.ts`: corrected-mode cursor tracking + corrected-mode reorder/settle. These pin the supported workaround so future drag/projection refactors (plans 019–021, PR #3748/#3749) can't silently break it.
- Existing `drag-scaled-parent.ts` and `drag-to-reorder.ts` must stay green (run them once alongside).

## Done criteria

- [ ] New fixture + spec exist; spec passes on React 18 AND React 19
- [ ] `drag-scaled-parent.ts` + `drag-to-reorder.ts` still pass (React 18 run)
- [ ] No source files modified (`git status`)
- [ ] Issue commented + closed only if README row APPROVED; otherwise row set to "VERIFIED-WORKAROUND — awaiting close approval"
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Corrected-mode tests fail after 2–3 honest attempts (tune drag distances,
  not assertions): the helper does NOT cover Reorder — report with Cypress
  output; the cluster then needs a projection-level fix plan, which must be
  written against the post-#3748/#3749 architecture, not improvised now.
- `correctParentTransform` no longer exported (drift).
- You find yourself editing `check-reorder.ts`, `Item.tsx`, or projection
  source to make the test pass — out of scope, stop.

## Maintenance notes

- Sibling plans: `issue-2750.md` (animated scale + transform-origin variant —
  depends on this plan's fixture) and `issue-1764.md` (whileDrag scale on the
  item itself — different mechanism, needs repro).
- The real fix direction, when unblocked: have measurement read computed
  ancestor transforms (or document `transformPagePoint` auto-wiring) inside
  the shared projection tree that PR #3748 introduces. Record in any follow-up
  that PR #3502's approach (scale offsets by `treeScale`) was rejected.
- Docs site (motion.dev) lives outside this repo; the closing comment is the
  discoverable documentation until a docs PR exists.
