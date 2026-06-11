# Plan 024: Fix hover() firing onHoverStart twice when the pointer leaves and re-enters during a press

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/gestures/hover.ts packages/framer-motion/src/gestures/__tests__/hover.test.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (one guard clause; the deferral machinery itself is untouched)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

Commit `4830aba02` (Feb 2026) added press-aware deferral to `hover()`: if the pointer leaves an element while pressed, the hover end is deferred until pointerup, so `whileHover` doesn't drop just before a drag starts. The deferral path has a hole: if the pointer leaves *and re-enters* while still pressed, the `pointerenter` handler calls `onHoverStart` **again** — without the first hover ever having ended. The first hover's end callback is silently overwritten and never called.

User-visible effects: `onHoverStart` (React prop) fires twice for what is one continuous hover; vanilla `hover()` users with paired start/end logic (timers, classes, subscriptions allocated in start, released in end) get an unbalanced pair and leak the first allocation. Reproduction is ordinary: press a button, wobble the cursor out and back in, release.

## Current state

- `packages/motion-dom/src/gestures/hover.ts` — the whole vanilla hover gesture (143 lines). Per-element state: `isPressed`, `deferredHoverEnd`, `hoverEndCallback`. The buggy sequence:

```ts
// packages/motion-dom/src/gestures/hover.ts:98-128
const onPointerLeave = (leaveEvent: PointerEvent) => {
    if (leaveEvent.pointerType === "touch") return

    if (isPressed) {
        deferredHoverEnd = true   // hover stays active, end deferred to pointerup
        return
    }

    endHover(leaveEvent)
}

const onPointerEnter = (enterEvent: PointerEvent) => {
    if (!isValidHover(enterEvent)) return

    deferredHoverEnd = false

    const onHoverEnd = onHoverStart(       // ← called again on re-enter while a
        element as Element,                //   hover is still active; previous
        enterEvent                         //   hoverEndCallback is overwritten below
    )

    if (typeof onHoverEnd !== "function") return

    hoverEndCallback = onHoverEnd

    element.addEventListener(
        "pointerleave",
        onPointerLeave as EventListener,
        eventOptions
    )
}
```

Trace of the bug: enter (start #1, `hoverEndCallback` set) → pointerdown (`isPressed = true`) → leave (`deferredHoverEnd = true`, **no end**, listener stays) → re-enter (`deferredHoverEnd = false`, **start #2**, `hoverEndCallback` overwritten) → release, later leave → end fires once. Net: 2 starts, 1 end, first end callback dropped.

- `hoverEndCallback` being set is exactly the "a hover is currently active" condition: it's set on start (line 121) and cleared in `endHover` (lines 59–65).
- The duplicate `addEventListener("pointerleave", ...)` on re-enter is harmless (same function reference + options → browser dedupes), but the guard added in this plan makes it unreachable anyway.
- React layer: `packages/framer-motion/src/gestures/hover.ts` — `handleHoverEvent` fires `onHoverStart` prop and `setActive("whileHover", true)` on every start; the double-start is directly observable as a double `onHoverStart` prop call.
- Existing tests: `packages/framer-motion/src/gestures/__tests__/hover.test.tsx`, especially `"whileHover stays active during press when pointer leaves before drag starts"` (line 312) and `"whileHover stays active during press and deactivates on release outside element"` (line 279) — these characterize the deferral behavior this plan must preserve. Test helpers `pointerEnter`/`pointerLeave`/`pointerDown`/`pointerUp` come from `../../jest.setup`; `nextFrame` from `./utils`.
- **Build note**: framer-motion's Jest resolves `motion-dom` to its built `dist/` output. After editing `hover.ts`, run `yarn build` from the repo root before running framer-motion tests.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build (repo root, REQUIRED after motion-dom edits) | `yarn build` | exit 0 |
| Hover tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/__tests__/hover"` (repo root) | all pass |
| Lint | `yarn lint` (repo root) | exit 0 |

Known pre-existing failures to ignore (do not fix): SSR tests failing with `TextEncoder is not defined`, and the `use-velocity` test.

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/gestures/hover.ts`
- `packages/framer-motion/src/gestures/__tests__/hover.test.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `packages/framer-motion/src/gestures/hover.ts` (React layer) — correct as-is.
- `packages/motion-dom/src/gestures/drag/**` and `isDragActive` — the drag interplay was deliberately designed in commit `4830aba02`.
- The `pointerType === "touch"` filters — separate, intentional behavior.

## Git workflow

- Branch: `fix/hover-double-start-during-press`
- Commit style (match `git log`): `fix(hover): prevent duplicate hover start on re-enter during press`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing test

In `hover.test.tsx`, add (model after the line-312 test, which already shows the enter→down→leave sequence with `whileHover` and variant assertions — but assert on the event props, which is where the bug is sharpest):

**`"onHoverStart fires once when pointer leaves and re-enters during press"`** — render `<motion.div onHoverStart={hoverIn} onHoverEnd={hoverOut} />`. Sequence with `await nextFrame()` between steps as the neighboring tests do:

1. `pointerEnter` → expect `hoverIn` 1
2. `pointerDown` on the element
3. `pointerLeave` → expect `hoverOut` 0 (deferred — existing behavior)
4. `pointerEnter` again → **expect `hoverIn` still 1** (pre-fix: 2 — this is the failing assertion)
5. `pointerUp` on the element → expect `hoverOut` 0 (still hovering, deferral cleared by the re-enter)
6. `pointerLeave` → expect `hoverIn` 1, `hoverOut` 1

**Verify**: hover test pattern → exactly this test fails at step 4 (`hoverIn` received 2 calls); all existing hover tests pass.

### Step 2: Guard re-entry while a hover is active

In `packages/motion-dom/src/gestures/hover.ts`, in `onPointerEnter`, after clearing `deferredHoverEnd`, early-return if a hover is already active:

```ts
const onPointerEnter = (enterEvent: PointerEvent) => {
    if (!isValidHover(enterEvent)) return

    deferredHoverEnd = false

    if (hoverEndCallback) return

    const onHoverEnd = onHoverStart(element as Element, enterEvent)
    ...
```

The `deferredHoverEnd = false` line must stay **before** the guard — re-entering must still cancel the pending deferred end, otherwise the pointerup after re-entry would end a hover that is still visually active.

Note the guard's known limit: it only detects an active hover when the caller returned an end callback. A caller that returns nothing from `onHoverStart` keeps today's behavior (a start per enter, no end tracking) — that's the documented contract (no end callback ⇒ no hover lifecycle), not a regression.

**Verify**: `yarn build` → exit 0. Hover test pattern → all pass, including the new test and the two press-deferral tests at lines 279/312.

### Step 3: Lint

**Verify**: `yarn lint` → exit 0.

## Test plan

Step 1's test is the regression gate. The existing suite already characterizes: touch filtering, drag interplay (`isDragging` import), deferral on leave-while-pressed, release-outside-element. No Cypress test needed: `pointerenter`/`pointerleave` sequencing is fully simulable in jsdom via the existing helpers (the deferral commit `4830aba02` itself shipped jsdom tests in this same file).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `yarn build` exits 0
- [ ] Hover test pattern exits 0; the new test exists and passes
- [ ] Tests at lines 279 and 312 (press-deferral characterization) pass unmodified
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `onPointerEnter`/`onPointerLeave` excerpts don't match the live code (drift).
- The new test cannot be made to fail pre-fix at step 4 (the jsdom event sequence isn't reproducing the bug — report the observed call counts; no repro → no fix).
- The guard breaks either existing press-deferral test — that means the `deferredHoverEnd` reset ordering described in Step 2 was not preserved.

## Maintenance notes

- The tri-state per-element hover state (`isPressed`, `deferredHoverEnd`, `hoverEndCallback`) is now load-bearing in three handlers; if a fourth interaction is added (e.g. focus-driven hover), consider consolidating into a single state enum.
- Reviewer should scrutinize: ordering of `deferredHoverEnd = false` vs the new guard, and that the no-end-callback contract (every enter fires start) is unchanged.
- Related but separate: the deferred end delivers a `pointerup` event (not `pointerleave`) to `onHoverEnd` — typed as `PointerEvent`, intentional, not changed here.
