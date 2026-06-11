# Plan issue-2284: Triage scale overshoot during layoutId crossfade (known projection limitation; reproduce, document, gated close)

> **Executor instructions**: Follow step by step; run the drift check first.
> Work is triage-only — do NOT attempt a projection-engine fix. Update the
> status row for this plan in `plans/issues/README.md` (NOT `plans/README.md`)
> when done.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2284 --jq .state` → expect `"open"`. If closed, mark DONE and stop.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/projection/node/create-projection-node.ts packages/motion-dom/src/projection/geometry/delta-remove.ts` — on change, re-verify the excerpts below; mismatch = STOP.

## Status

- **Classification**: NEEDS-REPRO (long-standing projection limitation; 2023 issue, repro links likely dead)
- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (no engine changes permitted by this plan)
- **Depends on**: none
- **Category**: bug (known limitation — triage/document)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2284

## Why this matters / verdict

A `layoutId` crossfade into a modal whose target also has `animate={{ scale: 1.5 }}` overshoots
far past 1.5 mid-animation, then snaps correct at the end. This is a real, architectural
interaction between independent scale animations and layout projection — not a one-line bug.
Given the issue's age (Aug 2023), no activity since, and that the reporter found a satisfying
workaround themselves (`scale: [null, null, null, 1.5]`, see issue comments), the honest plan is:
reproduce against current main, document the mechanism + workaround on the issue, and recommend
closing as a known limitation. **Do not plan or attempt a speculative projection fix.**

## Mechanism (verified in source at `42bfbe3ed`)

- When projection measures the modal's layout it strips the element's current transform using
  the element's `latestValues` — `packages/motion-dom/src/projection/node/create-projection-node.ts:1113-1142`,
  ending with:

```ts
            if (hasTransform(this.latestValues)) {
                removeBoxTransforms(boxWithoutTransform, this.latestValues)
            }
```

- `removeBoxTransforms` (`packages/motion-dom/src/projection/geometry/delta-remove.ts:103-123`)
  divides the measured box by `latestValues` scale around `originX/originY` (defaults 0.5 via
  `removeAxisDelta`'s `origin = 0.5`, `delta-remove.ts:30-38`).
- While `scale` is being animated by the regular value pipeline at the same time, `latestValues.scale`
  differs between the moment boxes are measured and every projection frame thereafter; the
  projection target box is corrected with a stale/moving scale while the real DOM transform keeps
  animating underneath. The two multiply → apparent scale far beyond 1.5 until both systems settle,
  then the final layout settle snaps to the correct value. (Repo institutional memory documents the
  sibling effect for scaled parents in issue #3356: `removeBoxTransforms` only sees tracked motion
  values and their `originX/originY`, never the raw CSS state.)
- The reporter's workaround (`scale: [null, null, null, 1.5]`) works precisely because it holds
  scale at its current value for 75% of the animation, letting the projection animation finish
  before scale starts moving.

## Repro (inline, from the issue + comments — the StackBlitz/CodeSandbox links may be dead)

Two elements sharing a `layoutId`, where the appearing one is portaled and also animates scale:

```jsx
// Card list: <motion.div layoutId={dragon.name}> <Card .../> </motion.div>
// Modal (rendered via createPortal on click):
const Modal = ({ dragon, toggleModal }) =>
    createPortal(
        <ModalOverlay onClick={toggleModal}>
            <motion.div
                onClick={(e) => e.stopPropagation()}
                layoutId={dragon.name}
                animate={{ scale: 1.5 }}
            >
                <CardModal dragon={dragon} />
            </motion.div>
        </ModalOverlay>,
        modalRoot
    )
```

Bug: during the card→modal crossfade the element's visual scale overshoots well beyond 1.5,
snapping correct when the layout animation completes. Without `layoutId` (or with the keyframe
workaround) it behaves.

## Steps

### Step 1: Build a local fixture and reproduce

Create `dev/react/src/tests/layout-shared-scale-overshoot.tsx` (exporting `App`) modeled on the
JSX above: a small card with `layoutId="card"`; on click, render a centered fixed-position
`<motion.div layoutId="card" animate={{ scale: 1.5 }} transition={{ duration: 2, ease: "linear" }}>`
(a portal is optional — same projection path). Run it via the Vite dev server
(`cd dev/react && yarn vite --port 9990`, open `http://localhost:9990/?test=layout-shared-scale-overshoot`)
and observe visually, or measure: sample `getBoundingClientRect().width / offsetWidth` mid-animation
and confirm it exceeds 1.5 noticeably (e.g. > 1.8).

**Verify**: a yes/no answer with a measured peak ratio. If it does NOT reproduce on current main,
record that — the recommendation below flips to closing as fixed/not-reproducible
(`state_reason=completed` is NOT appropriate without identifying the fixing change; use
`not_planned` with "cannot reproduce on motion@12").

### Step 2 (only if reproduced, optional): pin it as a characterization spec

If reproduction is clean and you want a tracking artifact, add a Cypress spec
(`packages/framer-motion/cypress/integration/layout-shared-scale-overshoot.ts`) that documents
current behavior per CLAUDE.md conventions (React 18 AND 19). Do NOT mark it as a failing gate —
there is no fix planned; a `.skip`-ped spec with a comment linking this issue is acceptable.
Skip this step entirely if it adds no signal.

### Step 3: Report on the issue + recommend disposition (gated)

ONLY after the row for this plan in `plans/issues/README.md` is marked APPROVED, post the
findings and close:

```
gh api repos/motiondivision/motion/issues/2284/comments -f body="Triage update: this is a known architectural interaction between layout (layoutId) projection and a simultaneously-animating scale value. When the projection system measures the modal it removes the element's current transform using the live scale value; while scale is itself mid-animation, that correction and the real transform drift apart and multiply, which is the overshoot you saw — it snaps correct once both animations settle. The keyframe workaround you found (scale: [null, null, null, 1.5]) is the recommended pattern: it delays the scale change until the layout animation has mostly completed. Equivalent options: animate scale with a delay, or scale via layout itself (animate width/height). A general fix requires the projection engine to compensate for in-flight transform animations, which is a significant architectural change we're not planning from this issue. Closing as a documented limitation; <result of Step 1: 'still reproduces on motion@12 as described' / 'no longer reproduces on motion@12'>."
gh api -X PATCH repos/motiondivision/motion/issues/2284 -f state=closed -f state_reason=not_planned
```

Replace the `<result of Step 1>` placeholder with the actual finding before posting.

**Verify**: `gh api repos/motiondivision/motion/issues/2284 --jq .state` → `"closed"`.

## Done criteria

- [ ] Step 1 executed with a recorded reproduce/no-reproduce result and peak-scale measurement
- [ ] No changes to `packages/motion-dom/src/projection/**` (`git status` clean there)
- [ ] Comment + close only under the APPROVED gate; placeholder filled in
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- You find yourself editing projection source to "just compensate" for animating transforms —
  explicitly out of scope; report findings instead.
- The fixture shows a DIFFERENT failure (e.g. no crossfade at all) — that's a separate issue;
  report, don't widen scope.
- Excerpted projection code has drifted (see drift check).
- Reminder: `gh pr edit` is broken on this repo — use `gh api -X PATCH` for any PR edits.

## Maintenance notes

- If a contributor/slot-model effects refactor lands (see repo memory: effects/VisualElement
  unification), revisit whether transform-animation-aware projection becomes feasible; this
  issue plus #3356 are the test cases.
