# Plan issue-2390: Resolve CSS-variable axis values when a drag starts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> If anything in "STOP conditions" occurs, stop and report. When done,
> update this issue's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2390 --jq .state` → `open`.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
>    If changed, re-verify the excerpts below. If the drag engine moved to
>    motion-dom (plans 019/020 landed), STOP and re-localize.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW–MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2390

## Why this matters

The issue includes full inline repro code (no sandbox needed): a bottom-sheet
whose `y` is animated to CSS variables (`y: "var(--slide-to)"` where
`--slide-to: 20%`). Animating to CSS variables is supported by the keyframe
resolver, but the moment a drag starts, the drag controller reads the axis
motion value raw. If that value is a `var()` string, the drag origin becomes
a string; every subsequent frame computes
`"var(--slide-to)" + offset` → string concatenation → an invalid transform.
Symptom matches the report exactly: "the component jumps and drag
functionality becomes unresponsive", and hardcoded values work.

## Current state

- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`,
  `onStart` origin capture (lines 146–166):

  ```ts
  eachAxis((axis) => {
      let current = this.getAxisMotionValue(axis).get() || 0

      /**
       * If the MotionValue is a percentage value convert to px
       */
      if (percent.test(current)) {
          const { projection } = this.visualElement
          if (projection && projection.layout) {
              const measuredAxis = projection.layout.layoutBox[axis]
              if (measuredAxis) {
                  const length = calcLength(measuredAxis)
                  current = length * (parseFloat(current) / 100)
              }
          }
      }

      this.originPoint[axis] = current
  })
  ```

  Only percent strings are converted; `var(--x)` strings flow through
  untouched into `originPoint`, and `updateAxis` (lines 319–338) computes
  `next = this.originPoint[axis] + offset[axis]` — string + number.

- motion-dom already exports the needed resolution utilities (verified):
  - `isCSSVariableToken(value)` —
    `packages/motion-dom/src/animation/utils/is-css-variable.ts:17`
  - `getVariableValue(current, element)` —
    `packages/motion-dom/src/animation/utils/css-variables-conversion.ts:27-54`;
    reads `getComputedStyle(element).getPropertyValue(token)`, recurses into
    fallbacks, returns a `number` for numerical strings or the raw string
    (e.g. `"20%"`). Both are `export *`'d from `motion-dom`'s index
    (`packages/motion-dom/src/index.ts:13,18`).
- The animation half of the report (animating `y` to a `var()`) is handled by
  `DOMKeyframesResolver` (`packages/motion-dom/src/animation/keyframes/DOMKeyframesResolver.ts:55`) — do not touch it; the dev page in Step 1 doubles
  as confirmation.
- The DOM element is `this.visualElement.current`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Jest drag suite | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` | all pass |
| Cypress React 18/19 | CLAUDE.md recipe, `--spec cypress/integration/drag-css-variable.ts` | all pass |

## Scope

**In scope**:
- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`
  (origin capture only)
- `dev/react/src/tests/drag-css-variable.tsx` (create)
- `packages/framer-motion/cypress/integration/drag-css-variable.ts` (create)
- Optionally `packages/framer-motion/src/gestures/drag/__tests__/index.test.tsx` (one unit test, see Test plan)

**Out of scope**:
- Keyframe/animation resolution of CSS variables (already works).
- `snapToCursor` and constraint math (`current` there comes from the same
  motion value — if you find it broken for var() too, note it in the PR as
  follow-up; don't expand scope).
- Supporting var() values that resolve to non-numeric, non-percent strings
  (e.g. `calc()`): out of scope; the guard just prevents corruption.

## Git workflow

- Branch: `fix/issue-2390-drag-css-variable-origin`
- PR via `gh pr create`; for body edits use
  `gh api -X PATCH repos/motiondivision/motion/pulls/<n> -f body=...`.

## Steps

### Step 1: Failing Cypress test

Page `dev/react/src/tests/drag-css-variable.tsx` (exported `App`):

```tsx
import { motion } from "framer-motion"

export const App = () => (
    <motion.div
        data-testid="draggable"
        drag="y"
        dragMomentum={false}
        dragElastic={0}
        initial={{ y: "var(--slide-from)" }}
        style={
            {
                width: 100,
                height: 100,
                background: "red",
                "--slide-from": "100px",
            } as any
        }
    />
)
```

Spec `packages/framer-motion/cypress/integration/drag-css-variable.ts`:

1. Visit `?test=drag-css-variable`, `.wait(200)`.
2. Read the element's `getBoundingClientRect().top` with `.then()` and store
   it — it should already reflect y=100 (the var is applied; if not, log and
   continue, the drag assertion is the gate).
3. `pointerdown` at center → `pointermove` +10 → `.wait(50)` →
   `pointermove` +50px vertically → `.wait(50)` → `pointerup`
   (`{ force: true }` throughout; model on
   `cypress/integration/drag-ref-constraints-absolute-scrolled.ts`).
4. Assert with `.then()`: the element's computed `transform` is a valid
   matrix (does NOT contain `var` and is not `none`-with-jump), and its
   `getBoundingClientRect().top` moved by ≈ +50 (±10) from the position in
   step 2 — i.e. origin was resolved as 100px and the drag tracked the
   pointer.

**Verify**: spec FAILS at `42bfbe3ed` (element snaps to a wrong position or
doesn't move — record the actual failure mode). If it doesn't fail, check
whether `initial` var-resolution leaves a resolved number in the motion value
already; try `animate={{ y: "var(--slide-from)" }}` with a duration and a
mid-animation drag instead. If it still can't fail after 2–3 attempts, STOP
(per CLAUDE.md no-repro rule).

### Step 2: Resolve var() in the origin capture

In `VisualElementDragControls.ts`, extend the `onStart` origin loop
(lines 146–166). After reading `current` and BEFORE the percent test:

```ts
if (typeof current === "string" && isCSSVariableToken(current)) {
    current =
        getVariableValue(current, this.visualElement.current!) ?? current
}
```

Then, after the existing percent conversion block, add a final numeric guard
so `originPoint` can never become a string:

```ts
this.originPoint[axis] =
    typeof current === "number" ? current : parseFloat(current) || 0
```

Imports: add `isCSSVariableToken`, `getVariableValue` to the existing
`motion-dom` import at the top of the file (line 1–20). Note
`getVariableValue` can return a percent string (e.g. `"20%"`) — that is why
it must run BEFORE the `percent.test(current)` block, which then converts it
to px using the projection layout.

**Verify**: `yarn build` → exit 0; Step 1 spec PASSES on React 18.

### Step 3: Regression pass

**Verify**:
- React 19 run of the new spec → passes.
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` → all pass.
- Existing Cypress `drag.ts` spec on React 18 → passes (known-flaky: re-run
  once before treating failure as real).

## Test plan

- Cypress (authoritative gate): var()-valued `y` resolves at drag start;
  drag tracks pointer; both React versions.
- Optional Jest unit test in
  `packages/framer-motion/src/gestures/drag/__tests__/index.test.tsx`
  (pointer-event plumbing is Jest-testable — see existing tests there):
  set `--slide-from` via `element.style.setProperty`, drag, assert `y` ends
  numeric. CAVEAT: JSDOM's `getComputedStyle().getPropertyValue("--x")`
  support is unreliable; if the var doesn't resolve in JSDOM, instead assert
  the defensive half (origin falls back to a number, no string concat —
  `y.get()` is a finite number after a drag that started from a var() value).
  Time-box one attempt; the Cypress spec is the real gate.

## Done criteria

- [ ] New Cypress spec passes on React 18 AND 19; failed before the fix
- [ ] Jest drag suite passes
- [ ] `grep -n "isCSSVariableToken" packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts` → 1+ match
- [ ] Only in-scope files modified
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 1 cannot produce a failing test after 2–3 variants.
- The fix requires changes inside motion-dom keyframe resolution.
- Drag engine moved to motion-dom (plans 019/020) — re-localize first.

## Maintenance notes

- Plans 019–021 port this file to motion-dom; this resolution logic moves
  with it (the utilities already live in motion-dom — the import gets
  shorter).
- Reviewer: check the `?? current` fallback — when `getVariableValue`
  returns `undefined` (unset var, no fallback), the final parseFloat guard
  yields 0, which is the pre-CSS-var-equivalent of "no transform". Mention
  in the PR that snapToCursor/constraints share the same motion value and a
  follow-up could centralize numeric coercion in `getAxisMotionValue`.
