# Plan issue-2591: Reset whileHover when a drag-end animation moves the element away from the cursor

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update this issue's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2591 --jq .state` → `open`.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/drag/ packages/framer-motion/src/gestures/hover.ts`
>    If `VisualElementDragControls.ts` changed, re-verify the excerpts below.
>    If the drag gesture has MOVED to motion-dom (plans 019/020 landed —
>    check `ls packages/motion-dom/src/gestures/drag/VisualElementDragControls.ts 2>/dev/null`),
>    STOP and report: the insertion points in this plan must be re-localized.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but see drift check re: plans 019/020)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2591

## Why this matters

With `drag` + `dragConstraints` (or `dragSnapToOrigin`), releasing a drag
animates the element back toward its constraint/origin. If that animation
moves the element out from under a stationary cursor, browsers fire NO
pointer events — so the `whileHover` state sticks until the user happens to
move the mouse over and off the element again. The reporter's repro steps are
fully self-describing (sandbox is Cloudflare-blocked, not needed): drag the
element, release, element springs away, hover styles remain.

## Current state

- `packages/framer-motion/src/gestures/hover.ts` — `HoverGesture` feature.
  `handleHoverEvent(node, event, "End")` (lines 4–20) does two things:
  `node.animationState.setActive("whileHover", false)` and fires
  `props.onHoverEnd`. Hover start/end is driven purely by
  `pointerenter`/`pointerleave` via motion-dom's `hover()`
  (`packages/motion-dom/src/gestures/hover.ts`) — nothing re-checks hover
  validity when the element moves.
- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`:
  - `stop(event?, panInfo?)` (lines 267–282): called on pointer up; calls
    `this.startAnimation(velocity)` which animates back to constraints
    (`startAnimation`, lines 458–512, returns
    `Promise.all(momentumAnimations).then(onDragTransitionEnd)`).
  - `this.latestPointerEvent` (line 89) holds the last `PointerEvent`
    (has `.clientX/.clientY`) but is nulled in `onSessionEnd` (lines
    227–235) right after `stop()` returns — capture coordinates inside
    `stop()` before they're gone.
  - The visual element is reachable as `this.visualElement`; its DOM element
    is `this.visualElement.current`; animation state:
    `this.visualElement.animationState` (see usage at line 175–176:
    `animationState.setActive("whileDrag", true)`).
- The momentum/spring-back animation is started by `stop()`; when it
  finishes, the element is at its settled position — that is the moment to
  hit-test the cursor.
- `getContextWindow(this.visualElement)` (imported, used at line 258) gives
  the correct window for iframe contexts.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress (React 18) | see CLAUDE.md recipe: start `dev/react` Vite on a random port, then `cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/drag-hover-reset.ts` | all pass |
| Cypress (React 19) | same with `dev/react-19` + `--config-file=cypress.react-19.json` | all pass |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` | all pass |

Run Cypress in the foreground; capture output with `tail -60` on first run.

## Scope

**In scope**:
- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
- `dev/react/src/tests/drag-hover-reset.tsx` (create)
- `packages/framer-motion/cypress/integration/drag-hover-reset.ts` (create)

**Out of scope**:
- `packages/motion-dom/src/gestures/hover.ts` — do not add hit-testing into
  the generic vanilla `hover()` gesture; the bug is specific to drag-induced
  movement and the fix belongs where the movement is known to happen.
- Synthesizing/firing `onHoverEnd` user callbacks with a fake event — only
  reset the `whileHover` *animation state*. (Document this limitation in the
  PR; firing callbacks with a synthetic stale event is worse than not firing.)
- Layout-animation-induced movement away from cursor (same symptom, different
  trigger) — out of scope; mention as follow-up.

## Git workflow

- Branch: `fix/issue-2591-hover-reset-after-drag`
- PR via `gh pr create`; `gh pr edit` is broken — use
  `gh api -X PATCH repos/motiondivision/motion/pulls/<n> -f body=...` for edits.

## Steps

### Step 1: Failing Cypress test first

Create `dev/react/src/tests/drag-hover-reset.tsx` exporting `App`:

```tsx
import { motion } from "framer-motion"
import { useRef } from "react"

export const App = () => {
    const constraints = useRef<HTMLDivElement>(null)
    return (
        <div ref={constraints} style={{ width: 200, height: 200, position: "relative" }}>
            <motion.div
                data-testid="draggable"
                drag
                dragConstraints={constraints}
                dragElastic={0.5}
                dragMomentum={false}
                initial={{ backgroundColor: "rgb(255, 0, 0)" }}
                whileHover={{ backgroundColor: "rgb(0, 255, 0)" }}
                transition={{ duration: 0 }}
                style={{ width: 100, height: 100 }}
            />
        </div>
    )
}
```

Create `packages/framer-motion/cypress/integration/drag-hover-reset.ts`:
sequence — `pointerenter` on the draggable (hover starts; assert background
is green), `pointerdown` at its center, `pointermove` far outside the
constraint (e.g. `clientX: 500, clientY: 500`, two moves with `.wait(50)`
between, `{ force: true }`), `pointerup` at that outside point (element
springs back into constraints, cursor position now outside the element),
`.wait(500)` for the spring to settle, then assert with `.then()` (NOT
`.should()`) that `getComputedStyle(el).backgroundColor` is
`rgb(255, 0, 0)` again. Model the pointer-event sequence on
`packages/framer-motion/cypress/integration/drag-ref-constraints-absolute-scrolled.ts`.

Note: in Cypress, hover start must be triggered explicitly
(`.trigger("pointerenter", { force: true })`) because synthetic moves don't
generate enter/leave. That is fine — the bug is about the *end* never firing.

**Verify**: run via the CLAUDE.md React 18 recipe → test FAILS on the final
assertion (background still green). If it passes, STOP — investigate whether
Cypress's trigger sequence fires a real `pointerleave` (try
`cy.window().then()` logging); if the bug can't be reproduced in 2–3
attempts, follow the CLAUDE.md "can't reproduce in test environment" rule.

### Step 2: Capture the release point and hit-test after settling

In `VisualElementDragControls.ts`, in `stop()` (lines 267–282):

1. Before `this.startAnimation(velocity)`, capture the release coordinates
   in *client* space from `finalEvent`: `const { clientX, clientY } = finalEvent`.
2. Chain on the animation-settled promise. `startAnimation` already returns
   the `Promise.all(...)` — change `this.startAnimation(velocity)` to use the
   returned promise:

   ```ts
   this.startAnimation(velocity).then(() => {
       this.checkHover(clientX, clientY)
   })
   ```

3. Add a private `checkHover(clientX: number, clientY: number)` method:

   ```ts
   private checkHover(clientX: number, clientY: number) {
       const { current } = this.visualElement
       const { animationState } = this.visualElement
       if (!current || !animationState || !this.visualElement.getProps().whileHover) return
       const win = getContextWindow(this.visualElement)
       const hit = win && win.document.elementFromPoint(clientX, clientY)
       if (!hit || !current.contains(hit)) {
           animationState.setActive("whileHover", false)
       }
   }
   ```

   Match the codebase style: optional chaining, no `var`, small output size.
   Guard everything — `elementFromPoint` must never throw the drag pipeline.

Note `startAnimation` only runs animations when constraints or
`dragSnapToOrigin` apply; when neither does, the element stays under the
cursor and `checkHover` is a harmless no-op (hit succeeds).

**Verify**: `yarn build` → exit 0; Step 1's Cypress spec now PASSES on
React 18.

### Step 3: Verify no regressions and React 19

**Verify**:
- React 19 run of the new spec (CLAUDE.md recipe) → passes.
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` → all pass. (JSDOM `document.elementFromPoint`
  exists but returns null-ish results; the guards make this safe. If a Jest
  drag test fails on `elementFromPoint`, stub-guard with
  `win.document.elementFromPoint ?` check.)
- Existing Cypress drag specs `drag.ts` and `drag-snap-animate-presence-exit.ts`
  on React 18 → pass (known-flaky family: re-run once before treating a
  failure as real).

## Test plan

- New Cypress spec (Step 1): hover set → drag → release outside cursor →
  settles → hover reset. Both React 18 and 19.
- Negative case (add to same spec): drag and release such that the element
  settles UNDER the cursor (small drag within constraints, cursor stays on
  element) → background remains green (hover NOT incorrectly cleared).

## Done criteria

- [ ] New Cypress spec passes on React 18 AND React 19; failed before fix
- [ ] Negative case passes (hover preserved when cursor still over element)
- [ ] Jest drag suite passes
- [ ] Only in-scope files modified
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Drag engine moved to motion-dom (plans 019/020 landed) — re-localize.
- Step 1's test cannot be made to fail (see Step 1 note).
- Fixing requires touching `motion-dom`'s `hover()` internals — report
  instead; that changes public vanilla-API behavior.
- The negative case (hover preserved) cannot pass without breaking the
  positive case — the hit-test approach is then wrong for this DOM setup.

## Maintenance notes

- Reviewer should scrutinize: promise chaining off `startAnimation` — it
  also feeds `onDragTransitionEnd` (line 511); do not change its timing.
- Known gap (document in PR): `onHoverEnd` callback is NOT fired on
  programmatic reset, only the `whileHover` state is cleared. Also
  `dragSnapToOrigin` mid-flight cancellations and layout-animation movement
  share the symptom; follow-ups, not regressions.
- Plans 019–021 will move this file to motion-dom — this fix should port
  verbatim; flag it in the port's checklist.
