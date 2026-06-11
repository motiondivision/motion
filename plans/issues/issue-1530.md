# Plan issue-1530: Attempt a repro of the layout-effect + draggable resize jump; report if real, else close needs-repro with the supported pattern

> **Executor instructions**: Follow this plan step by step; run every
> verification command. If a STOP condition occurs, stop and report.
> When done, update this plan's row in `plans/issues/README.md`.
> Repo policy: **no repro → no fix, no speculative coverage tests**.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/1530 --jq .state` → `open` (if `closed`, mark DONE-ALREADY and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` — if `scalePositionWithinConstraints` (lines 589–659) changed, re-verify before proceeding.

## Status

- **Classification**: NEEDS-REPRO
- **Priority**: P3 (2022; reporter says "only happens sometimes"; resize-constraint code rewritten several times since)
- **Effort**: S
- **Risk**: MED (the symptom is a race — inherently flaky to assert)
- **Depends on**: none
- **Category**: bug (triage)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1530

## Why this matters

#1530: a draggable scrubber whose `x` motion value is set imperatively inside
a `useLayoutEffect` sometimes jumps on window resize; switching to
`useEffect` makes it go away. The likely mechanism on today's code: with
ref-based `dragConstraints`, the drag feature's window-resize handler
(`scalePositionWithinConstraints`) re-measures and **re-sets the axis motion
value** to preserve the element's relative position within the new
constraints — while the user's layout effect simultaneously sets `x` to its
own computed value. Two writers race; ordering differs between
layout-effect and effect timing; "sometimes" jumps. The repro sandbox
(`qjrden`) is Cloudflare-blocked for agents and 4 years old; the
constraints-on-resize machinery has been rewritten repeatedly since
(`f93560b96`, `801a699a5`, `a4df97a6c`, `cfccb0300`). A jamesvclements
comment (2023) asks for the supported imperative-positioning pattern —
the close should answer that regardless of repro outcome.

## Current state

- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:734–736`
  — window resize → `scalePositionWithinConstraints()`.
- `scalePositionWithinConstraints` (lines 589–659): stops animations,
  records per-axis progress within the old constraints, strips the
  element's transform to re-measure, re-resolves constraints, then
  **`axisValue.set(mixNumber(min, max, boxProgress[axis]))`** (line 650) —
  this is the competing write that can clobber a user-set `x`. It only runs
  when `dragConstraints` is a ref (line 594).
- Supported imperative-positioning answer for the closing comment: set the
  motion value directly (`x.set(px)` / `x.jump(px)`) from an event handler or
  effect — no `dragControls.start(fakeEvent)` needed; the conflict in this
  issue arises only when that write races the ref-constraints resize handler.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Server (React 18) | `PORT=$((10000 + RANDOM % 50000)); cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &` then `npx wait-on http://localhost:$PORT` | up |
| Probe spec | `cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/drag-layout-effect-resize.ts` | verdict |

## Scope

**In scope**: throwaway fixture `dev/react/src/tests/drag-layout-effect-resize.tsx`
+ probe spec `packages/framer-motion/cypress/integration/drag-layout-effect-resize.ts`
(committed ONLY if a deterministic repro is found); `plans/issues/README.md`
row; the GitHub comment/close.
**Out of scope**: any change to `scalePositionWithinConstraints` or drag
source without a confirmed deterministic repro.

## Steps

### Step 1: Build the scrubber fixture

A track `div` (`ref={trackRef}`, width 80% of viewport) and a `motion.div`
scrubber with `drag="x"`, `dragConstraints={trackRef}`, `dragElastic={0}`,
`dragMomentum={false}`, `style={{ x }}` where `x = useMotionValue(0)`. A
`useLayoutEffect` (re-running on a `progress` prop/state and on a window
`resize`-driven re-render) sets `x.set(progress * trackWidth)` — mirroring
the issue's described setup as closely as the text allows.

### Step 2: Probe for the jump under viewport resize

Cypress spec: load, `cy.wait(300)`, record scrubber `getBoundingClientRect().left`;
`cy.viewport(800, 600)` then `cy.viewport(1000, 660)` with small waits;
after settling, compare the scrubber's position against the layout-effect's
intended `progress * trackWidth` position with `.then()`. Run the spec 3
times (rerun the command; do not loop inside the spec).

- **Deterministic mismatch/jump** → reproduced → STOP and report: include
  which writer won (resize handler's `mixNumber` value vs the effect's
  value); the likely fix discussion (e.g. skipping `scalePositionWithinConstraints`'s
  value write when an external write happened the same frame, or documenting
  the precedence) needs maintainer input before implementation.
- **No jump across 3 runs** → not reproducible → Step 3. Leave fixture/spec
  uncommitted.

**Verify**: 3 recorded run outcomes.

### Step 3 (gated): Close as needs-repro, answering the support question

**Gate: only if this plan's row in `plans/issues/README.md` is marked APPROVED.**

Comment via `gh api repos/motiondivision/motion/issues/1530/comments -f body="..."`:
- Could not reproduce on the current release with a reconstruction (include
  the fixture inline); the resize/constraints code paths have been rewritten
  several times since 2022.
- Answer the standing question: the supported way to imperatively position a
  draggable is to write to its motion value (`x.set()` / `x.jump()`); no
  synthetic event or `dragControls.start()` is needed.
- Note the known interaction: with ref-based `dragConstraints`, the library
  repositions the element proportionally on window resize — if you also
  reposition it yourself on resize, do it in `useEffect` (after the
  library's handler) rather than `useLayoutEffect`.
- Ask for a fresh repro on the latest release if it persists.

Close: `gh api -X PATCH repos/motiondivision/motion/issues/1530 -f state=closed -f state_reason=not_planned`.

## Done criteria

- [ ] Fixture + probe built; 3 probe runs recorded
- [ ] No drag source modified; nothing speculative committed (`git status`)
- [ ] Issue commented + closed only if README row APPROVED; otherwise row set to the branch reached ("NO-REPRO — awaiting close approval" / "REPRO — needs decision")

## STOP conditions

- Deterministic repro found (Step 2 first branch) — report, do not patch.
- The probe is flaky (jump in some runs only) after 3 attempts at
  stabilizing waits — report as "race confirmed but nondeterministic";
  closing as plain needs-repro would be dishonest, so this also goes back
  to the maintainer.

## Maintenance notes

- If a fix is ever planned: the two-writers problem is really a precedence
  question (library resize-reposition vs user writes). Any solution should be
  designed against plan 019/020's relocated drag engine, not the current
  file.
