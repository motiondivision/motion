# Plan issue-2348: Verify popLayout exit positioning in non-static containers on current main, then close or escalate

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2348 --jq .state` → expect `open`.

## Status

- **Priority**: P2
- **Effort**: S (verification) — escalates to M only if it still reproduces
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (verify-fixed)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2348

## Why this matters

Reported Sept 2023 (~v10.16): with `mode="popLayout"`, exiting elements inside
a non-`static` container (the repro uses `position: fixed`, offset from the
viewport top) get wrong `top`/`left` — they visually jump/drop instead of
exiting in place. The reporter flags toasts in the bottom-right corner as the
mainstream use case. Since then this exact area received multiple fixes —
`fbdccafd4` "Anchor popLayout x (#3021)" (adds `anchorX`), `56ea96892` "Fix
AnimatePresence popLayout mode shifting elements with bottom positioning"
(adds `anchorY="bottom"` — built precisely for bottom-anchored toasts),
`dcb79447f` (sub-pixel), `c6c59c9f1` (getComputedStyle sizing), `3212dd9f9`
(RTL) — and a dedicated parameterized fixture exists. High probability this
is fixed or addressed-by-`anchorY`; verify before touching anything.

## Current state

- Current measurement, `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx:41-58`
  (`PopChildMeasure.getSnapshotBeforeUpdate`): uses `element.offsetTop` /
  `element.offsetLeft` and the `offsetParent`'s `offsetWidth/Height` — i.e.
  offsetParent-relative, NOT window-relative. The issue's premise ("top and
  left are calculated in relation to the window") does not describe today's
  code.
- Existing parameterized fixture:
  `dev/react/src/tests/animate-presence-pop-layout-container.tsx` — accepts
  `?position=static|relative|absolute|fixed` and `&anchor-x=left|right` URL
  params on the container/items. The Cypress spec
  `packages/framer-motion/cypress/integration/animate-presence-pop.ts` runs it
  (line 214: `runTests("?test=animate-presence-pop-layout-container")`; line
  86 exercises `&position=relative`) — `position=fixed` is NOT currently
  exercised by the spec.
- The issue's CodeSandbox (`8lyz9x`) was **Cloudflare-blocked from the
  planning environment**; retry once. Reconstruction: a `position: fixed`
  container placed e.g. `top: 200px; left: 200px`, a column of items with
  `exit={{ opacity: 0, scale: 0 }}`, `mode="popLayout"`; remove an item; the
  exiting element must stay visually in place (shrink to its own center), not
  jump down by the container's offset.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Cypress | CLAUDE.md § "Running Cypress tests locally", spec `cypress/integration/animate-presence-pop.ts` (or a copy narrowed to the new case), React 18 AND 19 | pass |
| Jest sweep (if code changes) | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence"` | pass |
| Issue close (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2348 -f state=closed -f state_reason=completed` | closed |

## Steps

### Step 1: Exercise `position=fixed` with the existing fixture

Write a small Cypress spec (new file
`animate-presence-pop-fixed-container.ts`, modeled on the
`position=relative` block in `animate-presence-pop.ts:80-110`) that visits
`?test=animate-presence-pop-layout-container&position=fixed`, triggers the
exit, and immediately (`.then()`, not `.should()`) compares the exiting
element's `getBoundingClientRect()` against its pre-exit rect — they must
match within 1px. If the fixture's `fixed` mode doesn't offset the container
from the viewport top (the issue notes the bug is invisible when the
container's top aligns with the window top), extend the fixture's fixed style
with a `top` offset via another URL param rather than editing existing cases.

**Verify**: spec run on React 18 captured (`tail -60` of first run).

### Step 2: Branch on outcome

- **Passes** (expected): also run React 19, then proceed to Step 3.
- **Fails**: the bug is live. STOP and report with the failing spec — the fix
  will involve the delta between `offsetTop/offsetLeft` (border-box of
  offsetParent) and absolute positioning's containing block (padding box), or
  a non-static ancestor that isn't the `offsetParent`. Do not attempt the fix
  under this plan; it needs its own FIX plan with that evidence attached.

### Step 3: Comment + gated close

Comment on #2348: tested at 12.40.0 (`42bfbe3ed`) with the fixed-offset
container spec (link it); note today's offsetParent-relative measurement
(PopChild.tsx:41-58) and that the toast use case is additionally served by
`anchorX`/`anchorY="bottom"` (commits `fbdccafd4`, `56ea96892`) — include a
short usage snippet `<AnimatePresence mode="popLayout" anchorY="bottom">`.
Ask the reporter to confirm on ≥12.40.0.

Close ONLY if this plan's row in `plans/issues/README.md` is APPROVED (or
APPROVED-CLOSE); otherwise set the row to BLOCKED("awaiting maintainer close
approval") and stop. Committing the new spec as permanent coverage is
maintainer's choice — propose it in the comment/PR only if Step 1 ran green
on both React versions (it's real-scenario coverage, not speculative).

## Done criteria

- [ ] `position=fixed` (with top offset) exit-position spec executed on React 18 + 19; outcome recorded
- [ ] Comment with evidence + anchorY guidance posted
- [ ] Close only under APPROVED row; else BLOCKED
- [ ] No source changes beyond (optionally approved) fixture param + spec

## STOP conditions

- Step 1 spec fails → escalate per Step 2; do not fix here.
- Existing `animate-presence-pop.ts` cases break while extending the fixture
  (you changed shared styles — revert and use an additive URL param).
- README row not APPROVED at close time.
- Issue already closed at drift-check.
