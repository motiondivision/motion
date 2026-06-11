# Plan issue-2750: Triage Reorder under *animated* parent scale/origin against the issue-2449 outcome, then close as documented limitation

> **Executor instructions**: Execute `plans/issues/issue-2449.md` FIRST — this
> plan reuses its fixture and its disposition. Run every verification command.
> If a STOP condition occurs, stop and report. When done, update this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2750 --jq .state` → `open` (if `closed`, mark DONE-ALREADY and stop).
> 2. Confirm `plans/issues/issue-2449.md` is DONE (or at least its Step 2 passed); if 2449 ended in its STOP state ("helper does not cover Reorder"), this plan is BLOCKED — record that and stop.

## Status

- **Classification**: INVALID/SUPPORT (documented limitation — raw CSS *animated* transforms are invisible to projection)
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/issues/issue-2449.md
- **Category**: bug / docs
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2750

## Why this matters

#2750 reports Reorder items "moving around non stop" (without user input) when
the parent's CSS `scale` **and `transform-origin` are continuously animated**
(CodePen repro; Cloudflare-blocked for agents, but the issue body and video
describe it: a scaling/origin-shifting parent wrapping a Reorder list whose
items perpetually run layout animations). This is the harshest member of the
scaled-parent cluster: every animation frame changes the screen-space size of
the items, the projection system measures those screen boxes (raw CSS
transforms are invisible to `hasTransform`/`treeScale` — same root cause as
#2449/#3356), concludes "layout changed", and starts a layout animation —
forever. PR #3502 attempted a `treeScale`-based fix for exactly this issue
and was closed (treeScale cannot see raw CSS scale). No quick fix exists that
doesn't require projection-engine awareness of computed ancestor transforms,
which is gated behind the PR #3748/#3749 rewrites. The honest disposition is
a support close with the supported pattern and a recorded design item.

## Current state

- Root cause chain (same as `issue-2449.md` "Current state", verified there):
  measurement in screen space (`motion-dom/src/projection/utils/measure.ts:8–15`),
  raw CSS transforms invisible to tracked-value logic, `Reorder.Item` is
  `layout` by default (`packages/framer-motion/src/components/Reorder/Item.tsx:69,104`),
  so animated screen-box changes re-trigger layout animations every cycle.
- What `correctParentTransform` can and cannot do here
  (`packages/framer-motion/src/utils/transform-rotated-parent.ts:34–57`):
  it inverts the parent's computed matrix around the **bounding-rect center**.
  For a *static* scale this is exact for deltas. For an *animating*
  `transform-origin`, the center-based inversion leaves a time-varying
  translation error, and measurements taken at different frames disagree —
  so even the helper may not stabilize a continuously animating parent.
- Supported patterns to state in the close:
  1. Animate the parent's scale with **tracked motion values** (`<motion.div style={{ scale }}>` or `animate={{ scale }}`) instead of raw CSS animations — tracked transforms ARE visible to projection.
  2. For static raw CSS scale, use `correctParentTransform` + `MotionConfig transformPagePoint` (regression-tested by issue-2449's spec).
  3. Pausing/avoiding layout measurement under a continuously CSS-animated ancestor is otherwise unsupported.

## Commands you will need

Same server/Cypress recipe as `issue-2449.md`. Only needed if you run the optional probe in Step 1.

## Scope

**In scope**: `plans/issues/README.md` (status row); the GitHub comment/close;
OPTIONALLY a ≤20-line extension of `dev/react/src/tests/reorder-scaled-parent.tsx`
(an `?animated=true` mode adding a CSS keyframe animation on the parent's
`transform`/`transform-origin`) for a manual probe — do NOT add a Cypress
assertion for it (continuously animating layout under a known limitation
would be a flaky test).

**Out of scope**: any projection/Reorder/drag source change; any new Cypress
spec asserting the animated case works.

## Steps

### Step 1 (optional probe, time-boxed ~30 min): observe the animated case

Add the `?animated=true` mode to the issue-2449 fixture and load it manually
(`?test=reorder-scaled-parent&animated=true&corrected=true`). Note in your
report whether items visibly jitter with and without `corrected`. This is
evidence for the closing comment, not a gate.

**Verify**: fixture still builds; issue-2449's spec still passes on React 18 (the new mode must not affect the default path).

### Step 2 (gated): Comment and close

**Gate: only if this plan's row in `plans/issues/README.md` is marked APPROVED.**

Comment via `gh api repos/motiondivision/motion/issues/2750/comments -f body="..."`:
- Explain the limitation (projection tracks motion values, not computed CSS;
  a CSS-animated parent scale/origin re-triggers layout measurement every
  cycle — hence the perpetual motion).
- Give the two supported patterns (tracked `scale` motion value on the
  parent; `correctParentTransform` for static raw CSS scale — link the test
  landed by the #2449 close).
- Note the engine-level design item is tracked and gated behind the
  projection rewrites; link #2449's closing comment as the cluster anchor.

Close: `gh api -X PATCH repos/motiondivision/motion/issues/2750 -f state=closed -f state_reason=not_planned`.

## Done criteria

- [ ] issue-2449 plan completed first (its spec green)
- [ ] No source changes beyond the optional fixture mode (`git status`)
- [ ] Issue commented + closed only if README row APPROVED; otherwise row set to "TRIAGED — awaiting close approval"
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- The optional probe shows the **tracked-motion-value** pattern (supported
  pattern #1) ALSO jitters — that would falsify the closing comment; report
  instead of closing.
- issue-2449 ended in its STOP state — this plan is BLOCKED on the cluster
  getting a real fix plan.

## Maintenance notes

- If/when the shared projection tree (PR #3748) lands and a "computed
  ancestor transform awareness" design plan is written, fold this issue's
  animated-origin case in as the stress test — it is strictly harder than
  the static case.
