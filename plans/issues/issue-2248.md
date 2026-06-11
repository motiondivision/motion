# Plan issue-2248: Resolve "`onDrag` layout transition doesn't fire" via the issue-1630 opt-in

> **Executor instructions**: This is a pointer plan — the work lives in
> `plans/issues/issue-1630.md`. Execute that plan first; this file only adds
> the #2248-specific test case and the issue bookkeeping. Honor the STOP
> conditions in both files. When done, update this issue's row in
> `plans/issues/README.md`.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2248 --jq .state`
> → `open`. Then run issue-1630's drift check — same in-scope files.

## Status

- **Priority**: P3
- **Effort**: S (incremental on issue-1630)
- **Risk**: LOW
- **Depends on**: `plans/issues/issue-1630.md` (hard — same root cause, same fix)
- **Category**: bug (behavior regression vs v1, but mechanism is by-design since v2)
- **Classification**: FEATURE-duplicate — same root cause as #1630
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2248

## Root cause (verified at `42bfbe3ed`)

Reporter: in v1, triggering a layout change from `onDrag` animated the element
back; since v2 it "jumps to the end". With `onDragEnd` it animates. Both
CodeSandbox repros (4x2n7j, wjlr7r) are Cloudflare-blocked at planning time,
but the mechanism is fully explained by code:

- Drag start sets `projection.isAnimationBlocked = true`
  (`packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:138-141`).
- Any layout update while blocked bails out and clears targets
  (`packages/motion-dom/src/projection/node/create-projection-node.ts:507-511`,
  guarded by `isTreeAnimationBlocked()` at :633-639) → instant jump.
- `onDragEnd` works because `stop()` calls `cancel()` (which clears
  `isAnimationBlocked` at `VisualElementDragControls.ts:292-294`) **before**
  `onDragEnd` fires via `frame.postRender`
  (`VisualElementDragControls.ts:267-282`). `onDrag` fires while the drag — and
  the block — is still active (`VisualElementDragControls.ts:222-224`).

This is the same deliberate blocking the maintainer called "by design" on
issue #1630 (2022-08-16 comment), and the same opt-in (`layoutWhileDrag`)
resolves it: with the prop on the dragged element, `isTreeAnimationBlocked()`
returns false and the `didUpdate` animation path runs even mid-drag.

## Steps

### Step 1: Execute `plans/issues/issue-1630.md`

Including its Step 0 decision gate (maintainer APPROVED row). Do not start
this plan if that gate is not passed.

### Step 2: Add the #2248 scenario as a Cypress case

Extend `dev/react/src/tests/layout-while-drag.tsx` /
`cypress/integration/layout-while-drag.ts` (created by issue-1630 Step 1) with
a case where the **dragged element itself** has `layout layoutWhileDrag` and
its `onDrag` handler triggers a state change that alters its layout position
(e.g. toggles a sibling's mount, pushing it down the page — matching the
reporter's card description). Assert mid-animation (`.then()`, long linear
tween) that the element animates rather than jumps. Run on React 18 + 19 per
issue-1630's command block.

**Verify**: case fails on unmodified main, passes with the issue-1630 change.

### Step 3: Issue bookkeeping

Comment on #2248 from the issue-1630 PR explaining: mechanism above, fix =
`layoutWhileDrag` opt-in, default unchanged because Reorder depends on
blocking. Close #2248 when that PR merges
(`gh api -X PATCH repos/motiondivision/motion/issues/2248 -f state=closed`).

## Done criteria

- [ ] issue-1630 done criteria all hold
- [ ] #2248 scenario covered by a passing Cypress case (both React versions)
- [ ] #2248 commented and closed (only after the PR merges)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- issue-1630's Step 0 gate is not APPROVED, or any of its STOP conditions fire.
- If the maintainer instead REJECTS the feature: do NOT close #2248 silently —
  it then needs an explicit by-design wontfix decision. Recommend close as
  `not_planned` with the mechanism explanation, but only once this plan's row
  in `plans/issues/README.md` is set to `APPROVED-CLOSE`.
- The #2248 case still jumps with `layoutWhileDrag` set: the dragged element's
  own snapshot may be missing (memoized component path,
  `ensureDraggedNodesSnapshotted`, `create-projection-node.ts:2359-2364`).
  Report findings; do not patch drag controls.
