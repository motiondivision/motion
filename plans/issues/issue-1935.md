# Plan issue-1935: FEATURE — shared `layoutId` animations resolved relative to a layout ancestor

> **Executor instructions**: Feature plan with a DECISION GATE (Step 0) and a
> design-spike structure. Do not write production code before the gate is
> approved and the Phase 1 fixture exists. Update the row in
> `plans/issues/README.md` when done.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/1935 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/projection/node/create-projection-node.ts packages/motion-dom/src/projection/shared/stack.ts`
> This plan dies on contact with PR #3748/#3749 merges — re-verify all
> excerpts if that file moved.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: maintainer decision (Step 0); coordinate with
  plans/issues/issue-2514.md (same root phenomenon, bug-shaped)
- **Category**: feature
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1935

## Why this matters

When a shared `layoutId` animation starts at the same moment as an unrelated
content shift (e.g. a sidebar mounts and pushes the tab strip), the shared
element animates between its old and new boxes in PAGE coordinates, while the
content around it teleports — so the element appears to fly in from the wrong
direction. The requester shows that `layout layoutRoot` on a parent fixes
this for plain `layout` animations and asks for the same containment for
`layoutId` shared animations: resolve the shared animation RELATIVE to a
layout root/ancestor so simultaneous content shifts don't distort it.
Issue #2514 (and previously #1972/#2006) are user reports of the same
phenomenon as a bug.

## Current state (verified)

- Relative-target machinery already exists for non-shared animations:
  `resolveTargetDelta` in
  `packages/motion-dom/src/projection/node/create-projection-node.ts:1196-1335`
  — `getClosestProjectingParent()`, `createRelativeTarget(...)`,
  `calcRelativeBox(...)`. A child CAN track its parent's animating box.
- The shared-stack handoff does NOT use it: when `NodeStack.promote()`
  (`packages/motion-dom/src/projection/shared/stack.ts:45-73`) adopts
  `prevLead.snapshot`, the new lead's animation origin is computed from
  page-space boxes in `setAnimationOrigin`
  (create-projection-node.ts:1590+) / the `didUpdate` listener
  (lines 499-604).
- `attemptToResolveRelativeTarget` (lines 1315-1335) bails for shared cases
  unless `Boolean(relativeParent.resumingFrom) === Boolean(this.resumingFrom)`
  — i.e. relative resolution across a takeover only works when parent AND
  child are BOTH shared transitions. The tab-underline case (shared child,
  non-shared but shifting parent) falls through to page-space deltas.
- A telling comment at lines 531-536: `hasRelativeLayoutChanged` was
  deliberately disabled as an animation trigger ("Disabled to fix relative
  animations always triggering new layout animations") — prior attempts in
  this area caused regressions; expect subtlety.
- `layoutRoot` option exists on projection nodes (`options.layoutRoot`,
  checked at lines 547, 569, 1232) and forces instant subtree behavior — the
  requester's workaround leans on it.

## Step 0 — DECISION GATE (maintainer)

Approve ONE direction in the README row before any code:

- **Option A**: implicit — when a shared takeover happens and old & new leads
  share a common projecting ancestor, resolve the snapshot and target
  relative to that ancestor's box automatically. Best UX; highest regression
  risk (this is exactly the area the line-536 comment warns about).
- **Option B (recommended for v1)**: explicit — honor the existing
  `layoutRoot`/`layoutAnchor`-style contract: a new opt-in (e.g. respecting
  `layout layoutRoot` ancestors during shared promotes, or a
  `layoutRelative` prop on the shared element) that converts the adopted
  snapshot into the common ancestor's space before the animation starts.
- **Option C**: reject feature; document the requester's own delay/sequence
  workaround. Gate `APPROVED-CLOSE`; close via
  `gh api -X PATCH repos/motiondivision/motion/issues/1935 -f state=closed -f state_reason=not_planned`.

## Commands you will need

Same HTML-fixture toolchain as plans/issues/issue-2465.md:
`node dev/inc/collect-html-tests.js`; dev/html Vite on port 8000;
`npx cypress run --config-file=cypress.html.json --spec cypress/integration-html/projection.ts`.
React-level: standard CLAUDE.md Cypress recipe.

## Steps (after gate; written for Option B, adapt if A)

### Phase 1 — Encode the desired behavior as a failing fixture

1. Read `dev/html/public/projection/shared-relative-new-child.html` and
   `shared-promote-new.html` for idioms.
2. Create `dev/html/public/projection/shared-promote-content-shift.html`:
   parent container (a projection node with `layout: true`), child A with
   `layoutId: "x"` at one position; in the update phase, simultaneously
   (a) shift the parent (prepend a sibling box / change parent's left margin)
   and (b) replace A with new child B (`layoutId: "x"`) elsewhere INSIDE the
   same parent. Assert (matchViewportBox at animation start, via
   `frame.postRender`): B's projected box equals A's box as carried by the
   SHIFTED parent (i.e. A's old offset *within the parent* + parent's new
   position) — not A's stale page-space box.
3. Add a control fixture without the content shift (must pass today).

**Verify**: control passes; content-shift fixture FAILS on main in exactly
the off-by-parent-shift way (record the delta). This fixture is the
feature's acceptance test.

### Phase 2 — Design write-up (no production code yet)

Produce a short design note (PR description or `plans/notes`, not committed
docs): where the snapshot-space conversion happens — candidate insertion
point: the `didUpdate` listener's `setAnimationOrigin(delta, ...)` call
(create-projection-node.ts:575-585) computing `delta` from
snapshot-vs-target in the COMMON ANCESTOR's space when (Option B trigger)
the closest projecting ancestor of the new lead has `options.layoutRoot` or
`layout` enabled, both leads share it, and `options.layoutAnchor !== false`.
Spell out interaction with: `resumingFrom`, `mixValues` crossfade,
`hasOnlyRelativeTargetChanged` (lines 543-552), and the disabled
`hasRelativeLayoutChanged` trigger (lines 531-536). Get maintainer sign-off
on the note (second gate) before Phase 3 — this is the highest-risk file in
the repo and two rewrites (PR #3748/#3749) are in flight.

### Phase 3 — Implement + gates

Implement per the approved note. Gates, in order:
1. New fixture(s) green.
2. ENTIRE HTML projection suite green (this suite is the contract; pay
   special attention to `shared-relative-new-child.html`,
   `animate-relative-*.html`, `shared-promote-*.html`).
3. React-level Cypress: reproduce the issue's tab-strip-with-sidebar case as
   `dev/react/src/tests/layout-shared-content-shift.tsx` + spec (failing
   first against main), React 18 + 19.
4. `yarn test-client` baseline.

## Test plan

- `shared-promote-content-shift.html` (+ control) — acceptance, failing-first.
- React spec `layout-shared-content-shift.ts` — the reporter's scenario
  end-to-end, failing-first.
- Full projection fixture suite as the regression net.

## Done criteria

- [ ] Gate decision recorded in README row before implementation
- [ ] Phase 1 fixture demonstrates the gap on main (delta documented)
- [ ] Phase 2 design note approved by maintainer
- [ ] Phase 3: all four gates green; no behavior change without the Option B
      trigger conditions
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- PR #3748 or #3749 merged → STOP, re-plan: both reshape projection
  rendering; this feature must be built on the post-merge code.
- Phase 3 turns any `animate-relative-*` or `shared-*` fixture red twice →
  the design interacts with the line-536 minefield; back out and report.
- Implementation needs changes in more than `create-projection-node.ts` +
  `stack.ts` + types — scope has escaped; report.

## Maintenance notes

- Lands a fix for issue #2514's scenario as a by-product — verify with that
  plan's repro and cross-link the issues in the PR.
- The disabled `hasRelativeLayoutChanged` trigger is the historical scar
  tissue here; reviewers should diff behavior against the commit that
  disabled it (`git log -S "hasRelativeLayoutChanged" --oneline`).
