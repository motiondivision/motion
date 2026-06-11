# Plan issue-2491: Document and close "layoutId element disappears crossing overflow-clipped containers" as an architectural limitation

> **Executor instructions**: Verification + bookkeeping plan. The only code
> artifact is an optional demonstration fixture used to confirm the diagnosis
> — it must NOT be committed unless Step 2's diagnosis is confirmed AND the
> maintainer wants the fixture kept. Honor the approval gate. When done,
> update this issue's row in `plans/issues/README.md`.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2491 --jq .state`
> → `open`. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/projection` →
> if large drift, re-verify the diagnosis below.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support / known limitation
- **Classification**: INVALID/SUPPORT — by-architecture limitation of non-reparenting FLIP; recommend wontfix-with-guidance (gated)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2491

## Diagnosis (grounded at `42bfbe3ed`)

Report: moving a `layoutId` element into/out of a parent with
`overflow: scroll|hidden`, the element "immediately disappears and doesn't
appear again until it's inside the destination element". Repro sandbox
(codesandbox `zqvzdy`) and the related x.com link from the 2025-11-15 comment
are both inaccessible to automation at planning time (Cloudflare 403) — but no
repro is needed to diagnose this one, because it is geometric:

- Motion's shared layout transitions never reparent DOM nodes. The newly
  mounted element lives in its **destination** container and is positioned at
  the source's screen location purely via `transform` (projection delta
  applied in `packages/motion-dom/src/projection/node/create-projection-node.ts`;
  the lead/follow promotion machinery is in
  `packages/motion-dom/src/projection/node/state.ts` and the crossfade in
  `create-projection-node.ts`'s `animationValues` handling).
- CSS `overflow: hidden|scroll|auto` on an ancestor clips descendants
  **including their transformed positions**. While the new element is
  transformed to the old container's coordinates, it is outside its own
  clipping ancestor's box → fully clipped → "disappears until it's inside the
  destination element". The same applies in reverse when leaving a clipped
  container. No projection-side change can paint outside an ancestor's clip;
  the only general solutions are reparenting to an unclipped layer (portal /
  top layer) — which is the View Transitions model, available in this repo as
  `animateView()` (`packages/motion-dom/src/view/index.ts`) — or
  removing the clip during the transition.

Workarounds to give the reporter:
1. Suspend the clip during the transition (`overflow: visible` while
   animating, restore on `onLayoutAnimationComplete`).
2. Render the transiting element in a portal above both containers for the
   duration of the transition.
3. Use the View Transitions–based `animateView()` for cross-container moves —
   snapshots paint in the browser's top layer and are not ancestor-clipped.

## Steps

### Step 1: Sanity-check the diagnosis (10-minute fixture, do not over-invest)

Create a throwaway page (do not commit): two stacked containers with
`overflow: hidden`, a `layoutId="box"` element conditionally rendered in one
or the other, 2s linear layout transition. Confirm in the browser
(`dev/react` Vite app, see CLAUDE.md commands) that the element is invisible
while its transform places it outside its current parent, and that setting the
containers to `overflow: visible` makes the same transition fully visible.
If the element is invisible **even with `overflow: visible`** — the diagnosis
is wrong (possibly a `visibility` lead/follow bug); STOP and report, this
becomes a FIX investigation instead.

### Step 2: Approval gate

Recommend wontfix-with-guidance. Only act once this plan's row in
`plans/issues/README.md` is `APPROVED-CLOSE`. If the maintainer instead wants
a feature (e.g. opt-in portal escape for shared transitions), that is a new
feature plan — report back, do not improvise one.

### Step 3: Comment and close

Post a comment explaining the clipping geometry (Diagnosis above, in
user-facing words), the three workarounds, and that cross-container moves are
exactly what `animateView()`/View Transitions solve. Then:

```bash
gh api -X PATCH repos/motiondivision/motion/issues/2491 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2491 --jq .state` → `closed`.

## Done criteria

- [ ] Step 1 fixture confirms clip-based disappearance (and is deleted; `git status` clean)
- [ ] Issue commented with workarounds + closed as `not_planned` (only behind APPROVED-CLOSE)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 1 contradicts the diagnosis (invisible even unclipped) → reclassify as
  FIX, report with the fixture code.
- Row not `APPROVED-CLOSE`.
- The 2025-11-15 linked tweet becomes accessible and shows a different bug
  shape (e.g. flicker rather than clip) — surface before closing.

## Maintenance notes

- If demand recurs, the durable feature answer is an opt-in "escape clip"
  mode for shared layout transitions (portal the lead element for the
  transition duration). That interacts with the PR #3748/#3749 projection
  rewrites and should be planned only after they land.
