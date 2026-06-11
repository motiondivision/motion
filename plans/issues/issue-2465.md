# Plan issue-2465: Make shared layout animations work across page-relative and viewport-relative coordinate spaces

> **Executor instructions**: This is an investigation-then-design plan for a
> deep architectural bug — the maintainer's own umbrella issue. Follow the
> steps in order; the output of Phase 1 (fixtures + reproduction matrix)
> determines whether Phase 2 (fix) proceeds. Honor every STOP condition.
> When done, update the row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2465 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/projection/node/create-projection-node.ts packages/motion-dom/src/projection/node/HTMLProjectionNode.ts`
> Mismatch with excerpts = STOP (PRs #3748/#3749 land in this area).

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: none, but MUST NOT run concurrently with PR #3748 / PR #3749
  landing work (same file)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2465

## Why this matters

Filed by the maintainer to consolidate #1430, #1407, #1480, #2415 (all now
closed into this one): a shared layout animation between an element measured
in *page-relative* coordinates (normal flow) and one measured in
*viewport-relative* coordinates (`position: fixed` subtree) produces a wrong
animation whenever the page is scrolled — the delta between the two boxes is
off by exactly the scroll offset. This is the classic
"modal with layoutId opens from a card after scrolling" failure, one of the
most-reported layout-animation bug shapes. Issue #2434 is the same class
(see plans/issues/issue-2434.md).

## Current state (verified)

- `packages/motion-dom/src/projection/node/HTMLProjectionNode.ts:26-27` —
  fixed elements are detected and become scroll roots:
  ```ts
  checkIsScrollRoot: (instance) =>
      Boolean(window.getComputedStyle(instance).position === "fixed"),
  ```
- `packages/motion-dom/src/projection/node/create-projection-node.ts:1024-1043`
  — `measurePageBox()`: boxes are converted viewport→page by adding root
  scroll, EXCEPT when the node is/was inside a scroll root:
  ```ts
  const wasInScrollRoot = this.scroll?.wasRoot || this.path.some(checkNodeWasScrollRoot)
  if (!wasInScrollRoot) {
      const { scroll } = this.root
      if (scroll) { translateAxis(box.x, scroll.offset.x); ... }
  }
  ```
  So a fixed-subtree node's `measuredBox`/`layoutBox` is viewport-relative
  while a normal node's is page-relative. **Within one tree** this is
  consistent; the bug is in **shared stacks**: `NodeStack.promote()`
  (`packages/motion-dom/src/projection/shared/stack.ts:45-73`) copies
  `prevLead.snapshot` onto the new lead without any coordinate-space
  conversion, and `setAnimationOrigin`/`calcBoxDelta` then mix a
  viewport-space box with a page-space box. The error equals the root scroll
  offset at measurement time.
- Existing fixture coverage (`dev/html/public/projection/`): a healthy
  `fixed-*` family (`fixed-page-scroll.html`,
  `fixed-child-page-scroll-layout-change.html`, `fixed-child-to-static.html`,
  `fixed-child-from-static.html`, `sticky-shared-to-fixed-page-scroll-*.html`
  etc.) and a `shared-scroll-a-b*.html` family — but NO fixture that promotes
  a shared `layoutId` stack member from a page-flow element to a
  fixed-subtree element **with non-zero page scroll** (the `fixed-child-
  to/from-static` pair exists; check whether they scroll the page first —
  at planning time they appeared to cover the unscrolled case).
- Fixture harness: fixtures use `window.Animate.createNode`,
  `window.Assert.matchViewportBox`, flip `data-layout-correct="false"` on
  mismatch; the spec `packages/framer-motion/cypress/integration-html/projection.ts`
  visits each file from `cypress/fixtures/projection-tests.json` (regenerate
  with `node dev/inc/collect-html-tests.js`) and asserts no
  `[data-layout-correct="false"]`.

All four referenced issues are CLOSED but this umbrella stays open — assume
closed-as-consolidated, not fixed, until Phase 1 proves otherwise.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (root) | exit 0 |
| Collect fixtures | `node dev/inc/collect-html-tests.js` | json regenerated |
| Serve fixtures | `cd dev/html && yarn vite --port 8000` | serving (port 8000 is hardcoded in the spec) |
| Run suite | `cd packages/framer-motion && npx cypress run --config-file=cypress.html.json --spec cypress/integration-html/projection.ts` | per-fixture pass/fail |
| Single fixture in browser | open `http://localhost:8000/projection/<name>.html` | red boxes (`data-layout-correct="false"`) indicate failure |

## Scope

**In scope**:
- `dev/html/public/projection/shared-fixed-*.html` (new fixtures, Phase 1)
- Phase 2 (only after Phase 1 + checkpoint): `create-projection-node.ts`
  (measurement/snapshot/promote path), `stack.ts`, plus any new
  coordinate-space field on the measurement type
  (`packages/motion-dom/src/projection/node/types.ts`)

**Out of scope**:
- React-side code; drag; sticky handling
  (`21301dd3c`/`2e8bd45f0` already address sticky — do not re-touch)
- Issue #2434's CSS-containing-block quirk (fixed inside transformed
  ancestor) — browser behavior, not fixable here

## Steps

### Phase 1 — Reproduction matrix (always do this)

#### Step 1: Read the existing fixed fixtures

Read `dev/html/public/projection/fixed-child-to-static.html`,
`fixed-child-from-static.html`, `fixed-page-scroll.html`, and
`shared-scroll-a-b.html` to learn the harness idioms (scroll setup uses a
`#trigger-overflow` element + `window.scrollTo`).

#### Step 2: Write four new fixtures

Model on `shared-promote-new.html` (shared `layoutId` promote: element A
exists → create element B with same layoutId → `root.didUpdate()` → assert
B's projected box matches A's origin via `matchViewportBox`). New matrix —
in each, `window.scrollTo(0, 200)` BEFORE the promote, with a
`#trigger-overflow` div to enable scrolling:

1. `shared-fixed-from-static-page-scroll.html` — A static in flow, B inside
   `position: fixed` container (promote A→B).
2. `shared-fixed-to-static-page-scroll.html` — A in fixed container, B static
   (promote A→B).
3. `shared-fixed-element-page-scroll.html` — B itself `position: fixed`
   (scroll root is the element, not an ancestor).
4. `shared-fixed-from-static-no-scroll.html` — control at scrollY=0 (expected
   to pass even today).

Assertion: after `didUpdate`, on the first animation frame the projected box
of B must match A's pre-promote viewport box (use the pattern from
`shared-promote-new.html`'s `frame.postRender` + `matchViewportBox` with the
captured bbox). The expected failure mode on main: off by exactly 200px in y.

**Verify**: `node dev/inc/collect-html-tests.js && yarn build`, run the
suite. Record pass/fail per fixture. Expectation from code reading: 1–3 FAIL,
4 passes. If ALL pass, the bug class is fixed on main → reclassify
VERIFY-FIXED: rename fixtures to keep them as regression coverage, open a PR
with fixtures only, and recommend closing #2465 (gated — see Done criteria).

#### Step 3 (checkpoint): report matrix

Write the matrix into the PR/branch notes. If any fixture fails, proceed to
Phase 2.

### Phase 2 — Fix design (only on confirmed repro)

Direction (validate, don't assume): tag each measurement with its coordinate
space and convert at the shared boundary.

1. In `measure()`/`measurePageBox()` (lines 999-1043), record on the returned
   measurement object (the `{ animationId, measuredBox, layoutBox, ... }`
   literal at 1015-1021) whether the box is viewport-relative
   (`wasInScrollRoot`) and the root scroll offset at measurement time
   (`this.root.scroll?.offset` copied by value).
2. In `NodeStack.promote()` (stack.ts:64-68) — or better, where the new lead
   consumes `snapshot` in `setAnimationOrigin`/`resolveTargetDelta`
   (create-projection-node.ts:1590+, 1196-1335) — when
   `snapshot.space !== thisNode.space`, translate the snapshot box by
   ±(root scroll at snapshot time) so both boxes are in the consumer's space.
3. Interrupted-scroll case: if the user scrolls DURING the animation, fixed
   elements stay put while page elements move; do not chase this in v1 —
   note it as a known limitation in the PR.

Each sub-step gate: the Phase 1 fixtures flip to green one by one; the whole
projection suite stays green (especially `fixed-*`, `sticky-*`,
`shared-scroll-*`, and `element-page-scroll-non-zero.html`).

## Test plan

- Phase 1 fixtures are the failing-first tests and become the permanent
  regression gates.
- Full HTML projection suite green after Phase 2.
- Optional React-level Cypress test (modal-from-card after scroll) only if
  Phase 2 lands; model on `layout-shared.ts`.

## Done criteria

- [ ] Reproduction matrix recorded (fixture name → pass/fail on main)
- [ ] If reproduced: fix lands with all 4 fixtures green + full suite green
- [ ] If NOT reproduced: fixtures merged as regression coverage; close
      recommendation posted on the issue — actual closing ONLY after the
      `plans/issues/README.md` row for this plan is set to APPROVED-CLOSE
      (close via `gh api -X PATCH repos/motiondivision/motion/issues/2465 -f state=closed -f state_reason=completed`)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- PR #3748 or #3749 merged since `42bfbe3ed` and `create-projection-node.ts`
  excerpt line numbers no longer match → STOP and re-plan against the new
  code before Phase 2 (Phase 1 fixtures remain valid regardless).
- Phase 2 sub-step makes a previously-green `fixed-*`/`sticky-*` fixture red
  twice in a row → the space-tagging model is wrong for that case; report.
- Phase 2 estimated diff exceeds ~150 lines in `create-projection-node.ts` —
  this needs maintainer design review first; report with the matrix and a
  written proposal instead of landing code.

## Maintenance notes

- This plan supersedes individual work on #2434 (and the closed #1430/#1407/
  #1480/#2415); link the matrix in any comment there.
- The `scroll.wasRoot` snapshotting (`removeElementScroll`,
  lines 1045-1076) is the subtle prior art — whoever reviews should check the
  new space tag agrees with `wasRoot` semantics for nested scroll roots.
- Known deferred limitation: scrolling *during* a cross-space animation.
