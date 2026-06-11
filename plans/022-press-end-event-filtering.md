# Plan 022: Fix press() end-event filtering — secondary-pointer teardown and swallowed drag cancel

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/gestures/press packages/framer-motion/src/gestures/__tests__/press.test.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (changes when the press end callback fires; one existing test encodes the old drag behavior — see Step 1)
- **Depends on**: none (plan 023 touches the same package but a different region of `press/index.ts`; either order, trivial merge)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

The `press()` gesture in motion-dom validates the *end* event (`pointerup`/`pointercancel`) **after** it has already torn down its window listeners and cleared press state. Two real bugs follow:

1. **Multi-touch kills the press.** While a primary touch is pressing an element, lifting *any other finger* anywhere on the page fires a window `pointerup` with `isPrimary: false`. The handler removes both window listeners and deletes the press state, then the validity check rejects the event and returns — so the end callback is **never called**. When the actual pressing finger lifts, nothing is listening. For React users, `whileTap` stays visually stuck on and `onTap`/`onTapCancel` never fire. For vanilla `press()` users, the start/end pairing is broken and anything allocated in `onPressStart` leaks.

2. **A press that turns into a drag never delivers Cancel.** When a drag starts mid-press, the `pointerup` arrives while `isDragActive()` is true, so the same validity check swallows the callback. The intended behavior (per the React layer's `onTapCancel` and `whileTap`) is that the press is *cancelled* — instead it just evaporates, leaving `whileTap` active forever. `setActive("whileTap", false)` is called from exactly one place in the codebase — the press end callback (`packages/framer-motion/src/gestures/press.ts:16`) — so if that callback is swallowed, nothing else ever resets the state.

## Current state

- `packages/motion-dom/src/gestures/press/index.ts` — the vanilla press gesture. The bug is in `onPointerEnd` (lines 71–86):

```ts
// packages/motion-dom/src/gestures/press/index.ts:71-100
const onPointerEnd = (endEvent: PointerEvent, success: boolean) => {
    window.removeEventListener("pointerup", onPointerUp)
    window.removeEventListener("pointercancel", onPointerCancel)

    if (isPressing.has(target)) {
        isPressing.delete(target)
    }

    if (!isValidPressEvent(endEvent)) {
        return
    }

    if (typeof onPressEnd === "function") {
        onPressEnd(endEvent, { success })
    }
}

const onPointerUp = (upEvent: PointerEvent) => {
    onPointerEnd(
        upEvent,
        (target as any) === window ||
            (target as any) === document ||
            options.useGlobalTarget ||
            isNodeOrChild(target, upEvent.target as Element)
    )
}

const onPointerCancel = (cancelEvent: PointerEvent) => {
    onPointerEnd(cancelEvent, false)
}
```

- `isValidPressEvent` (same file, lines 17–19) is `isPrimaryPointer(event) && !isDragActive()`. The two halves need *different* handling at end-time: a non-primary pointer event should be **ignored entirely** (press continues, listeners stay), while a drag-active end should **cancel** the press (callback fires with `success: false`).
- `isPrimaryPointer` — `packages/motion-dom/src/gestures/utils/is-primary-pointer.ts` (mouse: `button <= 0`; others: `isPrimary !== false`).
- `isDragActive` — `packages/motion-dom/src/gestures/drag/state/is-active.ts`; reads the module-level `isDragging` flags, which the test suite can set directly (`import { isDragging } from "motion-dom"` — see `packages/framer-motion/src/gestures/__tests__/hover.test.tsx:1` for precedent).
- React layer consuming the callback: `packages/framer-motion/src/gestures/press.ts` — `success ? "End" : "Cancel"` maps to `onTap` vs `onTapCancel`, and both reset `whileTap`.
- Existing tests: `packages/framer-motion/src/gestures/__tests__/press.test.tsx`. Relevant baseline: the test `"press event listeners doesn't fire if parent is being dragged"` (line 288) asserts only that `onTap` is **not** called after a drag — it does *not* assert `onTapCancel` stays at 0, so delivering Cancel does not break it. Verify this by reading the test before you start.
- Test helpers: `pointerDown`/`pointerUp` from `packages/framer-motion/src/jest.setup.tsx`, which installs a `PointerEventFake` passing through `isPrimary`, `pointerType`, `button`.
- **Build note**: framer-motion's Jest resolves `motion-dom` to its built `dist/` output. After editing motion-dom source, run `yarn build` from the repo root before running framer-motion tests, or the old code runs.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build (repo root, REQUIRED after motion-dom edits) | `yarn build` | exit 0 |
| Press tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/__tests__/press"` (repo root) | all pass |
| Full gesture tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/__tests__"` | all pass |
| Lint | `yarn lint` (repo root) | exit 0 |

Known pre-existing failures to ignore (do not fix): SSR tests failing with `TextEncoder is not defined`, and the `use-velocity` test.

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/gestures/press/index.ts`
- `packages/framer-motion/src/gestures/__tests__/press.test.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `packages/motion-dom/src/gestures/press/utils/keyboard.ts` — covered by plan 023.
- `packages/framer-motion/src/gestures/press.ts` (React layer) — the fix is in the vanilla gesture; the React layer's End/Cancel mapping is already correct.
- `packages/motion-dom/src/gestures/drag/**` — drag's own state management is not in question.
- `isValidPressEvent` usage at press **start** (line 60) — start-time filtering is correct as-is.

## Git workflow

- Branch: `fix/press-end-event-filtering`
- Commit style (match `git log`): `fix(press): deliver cancel on drag, ignore secondary pointers at press end`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing tests

In `packages/framer-motion/src/gestures/__tests__/press.test.tsx`, add two tests (model structure after the existing `"press event listeners doesn't fire if parent is being dragged"` test and its neighbors; use the `nextFrame` helper from `./utils` already imported in the file):

1. **`"press is not ended by a secondary pointer lifting"`** — render a `motion.div` with `onTapStart`, `onTap`, `onTapCancel` spies. `pointerDown` on the element (primary). Then dispatch a non-primary `pointerup` on `window` (use `fireEvent.pointerUp(window, ...)` or construct a `PointerEvent` with `{ isPrimary: false, pointerType: "touch", bubbles: true }` and `window.dispatchEvent` — check `jest.setup.tsx`'s `PointerEventFake` for which properties pass through). Then `pointerUp` on the element (primary). Assert: `onTapStart` 1, `onTap` 1, `onTapCancel` 0.
2. **`"press delivers cancel when a drag is active at release"`** — import `isDragging` from `motion-dom`. Render with the three spies. `pointerDown` on the element, then set `isDragging.x = true`, then `pointerUp` on the element, then reset `isDragging.x = false` (use try/finally so a failing assertion can't poison other tests — `isDragging` is module-level shared state). Assert: `onTapStart` 1, `onTap` 0, `onTapCancel` 1.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/__tests__/press"` → exactly these 2 new tests fail (test 1: `onTap` received 0 calls; test 2: `onTapCancel` received 0 calls). All pre-existing press tests still pass. If they fail for a different reason (e.g. the secondary pointerup never reaches the handler in jsdom), STOP — see STOP conditions.

### Step 2: Fix `onPointerEnd`

In `packages/motion-dom/src/gestures/press/index.ts`, restructure `onPointerEnd` so that:

- Non-primary end events are ignored **before** any teardown (listeners stay registered, `isPressing` untouched).
- Teardown then proceeds, and the callback always fires for a primary end event — with `success` forced to `false` when a drag is active.

Target shape:

```ts
const onPointerEnd = (endEvent: PointerEvent, success: boolean) => {
    if (!isPrimaryPointer(endEvent)) return

    window.removeEventListener("pointerup", onPointerUp)
    window.removeEventListener("pointercancel", onPointerCancel)

    isPressing.delete(target)

    if (typeof onPressEnd === "function") {
        onPressEnd(endEvent, { success: success && !isDragActive() })
    }
}
```

Notes: `isPressing.delete()` is safe without the `has()` check (matches repo's "prioritise small file size" style). `isValidPressEvent` remains used at press start — do not delete it. Import `isPrimaryPointer` is already present in the file.

**Verify**: `yarn build` (repo root) → exit 0. Then the press test pattern → all pass, including the 2 new tests.

### Step 3: Full gesture suite + lint

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/__tests__"` → all pass (ignore the known pre-existing failures listed above if they appear). `yarn lint` → exit 0.

## Test plan

Covered by Step 1: secondary-pointer non-teardown, drag-cancel delivery. The existing suite covers: drag suppressing `onTap` (line 288 — must stay green), keyboard presses, `globalTapTarget`, propagation. No Cypress test needed: both bugs are pure event-sequencing logic fully reproducible in jsdom with the existing PointerEventFake.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `yarn build` exits 0
- [ ] Press test pattern exits 0; the 2 new tests exist and pass
- [ ] The test `"press event listeners doesn't fire if parent is being dragged"` still passes unmodified
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `onPointerEnd` excerpt above doesn't match the live code (drift).
- In Step 1, the secondary-pointer test cannot be made to fail for the right reason — i.e. you cannot get a non-primary `pointerup` through jsdom to press's window listener. Report what you tried; do not land a test that passes pre-fix (repo policy: no repro → no fix).
- Fixing the tests seems to require changing `packages/framer-motion/src/gestures/press.ts` or any drag file.
- More than the 2 new tests change pass/fail state after the fix — the fix has wider blast radius than planned; report which tests and how.

## Maintenance notes

- This changes observable behavior: presses interrupted by drag now fire `onTapCancel` (previously: nothing). If a consumer complains, that's the intended fix — `whileTap` previously stuck on.
- Plan 023 edits other regions of the same file (`press/index.ts` lines 114–124) and `keyboard.ts`; whichever lands second rebases trivially.
- Reviewer should scrutinize: the `success && !isDragActive()` ordering (drag must downgrade success, not suppress the callback), and that no `pointercancel` path can now fire the callback twice (listeners are removed before the callback, so re-entry is impossible).
- Deferred: `claimedPointerDownEvents` / `stopPropagation` interplay was audited and found correct; not touched here.
