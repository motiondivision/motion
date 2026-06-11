# Plan issue-2362: Decide and implement enter-animation behavior when a `layoutId` element joins an existing shared stack

> **Executor instructions**: This plan has a hard DECISION GATE (Step 0). Do
> not write fix code until the maintainer has picked an option in
> `plans/issues/README.md`. The repro is fully specified inline in the issue
> (no sandbox needed). Update the README row when done.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2362 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/render/utils/animation-state.ts packages/framer-motion/src/motion/utils/use-visual-element.ts packages/motion-dom/src/projection/shared/stack.ts`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (behavior change candidate)
- **Depends on**: maintainer decision (Step 0)
- **Category**: bug / design
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2362

## Why this matters

Conditionally-rendered elements sharing a `layoutId` (the tab-underline
pattern: `{active && <motion.div layoutId="underline" initial={{opacity:0}}
animate={{opacity:1}} />}`) run their `initial → animate` enter animation on
EVERY tab switch, layered on top of the built-in shared-element crossfade —
the underline visibly fades each time it "moves". The whole point of
`layoutId` is continuity; users reasonably expect enter animations to apply
only when the element is genuinely new, not when it is taking over from a
predecessor. There is currently no supported way to express that.

## Current state

- Enter animations: `animateChanges()` runs from `useEffect`/
  `useIsomorphicLayoutEffect` in
  `packages/framer-motion/src/motion/utils/use-visual-element.ts:135-186`.
  Initial-state suppression exists only via presence context:
  `blockInitialAnimation: presenceContext ? presenceContext.initial === false : false`
  (use-visual-element.ts:70-72), consumed in
  `packages/motion-dom/src/render/utils/animation-state.ts:345`
  (`isInitialRender && visualElement.blockInitialAnimation`).
- Shared-stack takeover: when the new element's projection node mounts,
  `registerSharedNode` → `NodeStack.promote(node)`
  (`packages/motion-dom/src/projection/shared/stack.ts:45-73`) sets
  `node.resumeFrom = prevLead` and adopts the predecessor's snapshot. The
  built-in opacity crossfade (`mixValues`,
  `packages/motion-dom/src/projection/animation/mix-values.ts:34-46`) fades
  the lead in from 0 with `easeCrossfadeIn` — so a user-supplied
  `opacity: 0 → 1` is double-fading.
- Crucially, the projection node IS created during the first render
  (`use-visual-element.ts:97-109`) and its root's `sharedNodes` map is
  consultable before effects run — so "am I joining an existing stack with a
  live lead?" is knowable in time to block the initial animation.
- Legacy precedent: `initialPromotionConfig` /
  `SwitchLayoutGroupContext` (`packages/framer-motion/src/context/SwitchLayoutGroupContext.ts`)
  exists for exactly this class of control but is only wired for the removed
  `AnimateSharedLayout`-style usage (consumed in
  `use-visual-element.ts:95,107` and `MeasureLayout.tsx:47-49`).
- The issue's exit-side variant (exit animation playing while a successor
  animates in) is explicitly split out by the reporter as a separate, more
  complex concern — keep it out of scope.

## Step 0 — DECISION GATE (maintainer)

Pick one in the README row:

- **Option A (recommended)**: new opt-in prop, e.g.
  `layoutEnterAnimation={false}` or extending `initial` semantics is NOT
  possible — so a dedicated prop: when the element mounts INTO an existing
  stack whose `prevLead` has a live instance, treat as
  `blockInitialAnimation = true`. Opt-in, zero behavior change for existing
  apps.
- **Option B**: make the skip the DEFAULT (what the reporter asks for).
  Strictly more "correct" but a behavior change for any app relying on
  enter animations during takeover; needs changelog + major-ish caution.
- **Option C**: document-only (recommend conditional `initial={false}` via
  app state); close as working-as-intended. Gate: `APPROVED-CLOSE`.

The plan below implements A (B differs only by removing the prop check).

## Commands you will need

Standard CLAUDE.md Cypress recipe (React 18 + 19), `yarn build`,
`npx jest --config packages/framer-motion/jest.config.json --testPathPattern="<filter>"`.

## Scope

**In scope** (Option A):
- `packages/framer-motion/src/motion/utils/use-visual-element.ts`
- `packages/motion-dom/src/render/types.ts` /
  `packages/framer-motion/src/motion/types.ts` (prop type)
- `dev/react/src/tests/layout-id-enter-animation.tsx` (create)
- `packages/framer-motion/cypress/integration/layout-id-enter-animation.ts` (create)

**Out of scope**:
- Exit-side behavior (reporter's own caveat; file separately if desired).
- The crossfade math in `mix-values.ts`.
- `NodeStack`/`create-projection-node.ts` internals.

## Steps (after gate, Option A)

### Step 1: Failing Cypress test

Test page from the issue's inline snippet: three tabs; per-tab
`{active === i && <motion.div layoutId="underline" initial={{opacity: 0}}
animate={{opacity: 1}} transition={{duration: 1.5}} layoutEnterAnimation={false} />}`.
Spec: mount → click tab 2 → sample the underline's computed opacity ~300ms
in with `.then()`. Expected with fix: opacity ≈ crossfade-only value (close
to 1 well before 1.5s, since the user duration no longer applies); on
current main the user fade makes it ≈ 0.2. Also assert first-ever mount DOES
fade (enter animation preserved when no predecessor exists).

**Verify**: fails on main (the prop is ignored / opacity follows the 1.5s
user fade).

### Step 2: Detect takeover at first render

In `useVisualElement`, where `blockInitialAnimation` is computed
(use-visual-element.ts:70-72), it is too early — the projection node doesn't
exist yet. Instead, after `createProjectionNode(...)` (line 103-109), if the
new prop is set and `props.layoutId`, look up
`visualElement.projection.root?.sharedNodes?.get(layoutId)` — root may only
resolve post-mount for the first node in a tree; handle by checking in the
`useIsomorphicLayoutEffect` (line 135) BEFORE `animationState.animateChanges()`
runs in the later `useEffect` (line 165): if the node's stack has a
`prevLead` with a live instance, set
`visualElement.blockInitialAnimation = true` for this mount. Confirm
ordering: `animateChanges()` for non-handoff runs in `useEffect`
(use-visual-element.ts:165-170), which is after layout effects — so the flag
set in the layout effect lands in time.

**Verify**: Step 1 spec green on React 18 + 19; existing
`animate-presence-layout.ts`, `layout-shared.ts` specs green.

### Step 3: Type + docs surface

Add the prop to the layout-prop types (where `layoutCrossfade` is declared —
grep `layoutCrossfade` in `packages/framer-motion/src/motion/types.ts`) with
a doc comment. Note in PR body that the docs site needs a paragraph.

## Test plan

- Cypress: takeover skips user enter animation (failing-first); first mount
  keeps it; prop absent keeps today's double-fade (back-compat).
- Jest (optional): unit-level check that `blockInitialAnimation` set before
  `animateChanges` suppresses initial keyframes — model on existing
  animation-state tests under
  `packages/framer-motion/src/render/utils/__tests__/`.

## Done criteria

- [ ] README row carries an explicit Option A/B/C approval BEFORE code
- [ ] Failing-first spec; green with fix on React 18 + 19
- [ ] Back-compat case covered (no prop → unchanged behavior) [Option A]
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- The gate is unset — do nothing beyond Step 1's test page exploration.
- `blockInitialAnimation` timing doesn't hold (flag set too late and the
  enter animation still fires): do NOT start moving `animateChanges`
  call sites; report — that ordering is load-bearing for optimized appear
  handoff (use-visual-element.ts:150-163).
- PR #3749 (VisualElement/effects rewrite) has merged — animation-state
  internals may have moved; re-verify excerpts.

## Maintenance notes

- If Option B is ever chosen later, the Option A implementation is the same
  minus the prop check — note this in the PR.
- The exit-side sibling behavior (reporter's note) should reference this
  prop's naming for symmetry (e.g. future `layoutExitAnimation`).
