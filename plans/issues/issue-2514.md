# Plan issue-2514: Reproduce the vertical layoutId mispositioning and fold it into the #1935 work

> **Executor instructions**: Reproduce-and-consolidate plan. Do not attempt a
> standalone fix here — the mechanism lives in plans/issues/issue-1935.md.
> Honor the approval gate before closing. Update the row in
> `plans/issues/README.md` when done.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2514 --jq .state` → must be `open`.
> Check the README rows for issue-1935 (mechanism) before acting on Step 3.

## Status

- **Priority**: P3
- **Effort**: M (S if issue-1935's fixture already exists)
- **Risk**: LOW
- **Depends on**: plans/issues/issue-1935.md (decision + mechanism)
- **Category**: bug (triage/consolidation)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2514

## Why this matters

Re-report of the closed #1972/#2006: a `layoutId` indicator (nav underline /
highlight) animates to the wrong position when sibling content height changes
at the same time, and the horizontal-only workaround from #1972 doesn't help
for vertically-stacked navs. A commenter found `style={{ originY: '0px' }}`
(or `originX` for horizontal) papers over it per-direction. This is the same
phenomenon issue #1935 requests a real mechanism for (shared animation
resolved relative to a layout ancestor instead of page space): the shared
element's page-space origin goes stale the instant surrounding content
shifts.

## Current state

- Reproductions: the issue's image link and the comment's devbox
  (`codesandbox.io/p/devbox/framer-motion-layoutid-bug-vertical-scroll-v92zzt`)
  were unreachable at planning time (Cloudflare 403). #1972's sandbox
  (`framer-motion-layoutid-issue-uu7kb9`) likewise. Retry once; otherwise
  reconstruct: a VERTICAL list of nav items with a `layoutId="indicator"`
  highlight, where selecting an item also expands/collapses content ABOVE
  the list (height change → vertical shift), mirroring #1972's description
  plus this issue's vertical orientation.
- Code grounding (same as issue-1935; verified):
  shared promote adopts the predecessor's page-space snapshot
  (`packages/motion-dom/src/projection/shared/stack.ts:45-73`); relative
  resolution bails for shared-child/non-shared-parent combos
  (`packages/motion-dom/src/projection/node/create-projection-node.ts:1315-1335`);
  origin defaults (`originX/originY` 0.5) explain why the commenter's
  `originY: '0px'` changes the failure shape — `removeBoxTransforms`/box
  correction uses tracked origins, and pinning the origin aligns the stale
  delta along one axis only.

## Steps

### Step 1: Reconstruct the repro

`dev/react/src/tests/layout-shared-vertical-shift.tsx` exporting `App`:
- `#expander`: a div above the nav whose height toggles 0 ↔ 200px with a
  button (NO layout props — instant shift, as in real apps).
- Vertical nav of 3 items; the selected one renders
  `<motion.div layoutId="indicator" transition={{ type: "tween", ease: "linear", duration: 10 }} />`.
- Clicking an item BOTH selects it AND toggles the expander (single state
  update — simultaneity is the trigger per #1935's analysis).

Spec `packages/framer-motion/cypress/integration/layout-shared-vertical-shift.ts`:
click item 2; `cy.wait(500)`; `.then()` on the indicator rect: assert it lies
between its old and new boxes as measured in the SHIFTED coordinate space
(i.e. its x/y at 5% progress should be ≈ old position + expander height, not
the stale pre-shift position). On current main this fails by ≈ the expander
height on the y axis.

**Verify**: spec fails on main with the predicted signature → reproduction
confirmed; record the delta. If it does NOT fail, try the #1972 horizontal
variant once; if still clean, go to Step 3b.

### Step 2: Park the spec as the issue's acceptance test

Do not fix here. Reference the spec from plans/issues/issue-1935.md Phase 3
gate 3 (it is the same scenario, vertical flavor). Keep the test page +
spec on the issue-1935 branch or attach to the issue as a gist if 1935 is
not yet approved — per repo policy do NOT merge a permanently-red or
never-green test on its own.

### Step 3a (reproduced): consolidate

Comment on #2514: confirmed at `<commit>`, root cause is shared-stack
animations resolving in page space while content shifts (same as #1935),
fix tracked there; include the `originX/originY` per-axis workaround caveat.
Recommend closing as duplicate-tracked-by-#1935. Close ONLY after the
`plans/issues/README.md` row reads `APPROVED-CLOSE`:
`gh api -X PATCH repos/motiondivision/motion/issues/2514 -f state=closed -f state_reason=not_planned`
(state_reason `duplicate` is not API-settable; mention #1935 in the comment).

### Step 3b (not reproduced): needs-repro

Comment asking for an updated reproduction (note the old sandboxes are
gone/unreachable), recommend close-as-needs-repro; same approval gate.

## Done criteria

- [ ] Reproduction verdict + measured delta recorded
- [ ] Spec exists and is linked from the issue-1935 plan (if reproduced)
- [ ] Comment posted; any close gated on README `APPROVED-CLOSE`
- [ ] No production source modified; `plans/issues/README.md` row updated

## STOP conditions

- The repro fails in a way NOT explained by the content-shift theory (e.g.
  wrong even without the expander toggle) — that's a different bug; report
  with the recording.
- issue-1935 was REJECTED (Option C) at its gate — then this issue needs its
  own decision: report to maintainer instead of closing onto a dead feature.

## Maintenance notes

- When #1935 lands, this issue's spec becomes a regression test in that PR;
  ensure both issue numbers appear in that PR body so GitHub closes them
  together.
