# Plan 023: Fix keyboard-press listener lifecycle — stale keyup/blur listeners dispatch phantom pointer events

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
- **Risk**: LOW (listener bookkeeping only; the happy-path keyboard flow is unchanged and already covered by existing tests)
- **Depends on**: none (plan 022 touches a different region of `press/index.ts`; either order, trivial merge)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

The keyboard-accessibility layer of `press()` synthesizes pointer events from Enter keys, but never removes its `keyup`/`blur` listeners after a press completes. Consequences, all read directly from the code:

1. **Listener accumulation**: every Enter keydown adds a fresh `keyup` + `blur` listener pair. After N keyboard presses without blurring, the Nth keyup dispatches N synthetic `pointerup` events.
2. **Phantom `pointercancel` cancels unrelated gestures.** After *one completed* keyboard press, a stale `blur` listener remains. Any later blur of that element dispatches a bubbling synthetic `pointercancel`. Blur happens precisely when the user pointer-downs somewhere else — so the phantom `pointercancel` reaches the window listeners of whatever press/pan/drag gesture just started on the *other* element and cancels it (`isPrimaryPointer` accepts the synthetic event: `pointerType` is `""` so the `isPrimary !== false` branch passes). Concretely: keyboard-press button A, then mouse-press button B → B's press is cancelled before pointerup, `onTap` never fires.
3. **`cancel()` doesn't remove the focus listener.** The `focus` listener is registered without the gesture's `AbortSignal`-carrying options (third argument missing), so calling the function returned by `press()` leaks one focus listener per target. The element's `tabIndex = 0` mutation is likewise never reverted.

## Current state

- `packages/motion-dom/src/gestures/press/utils/keyboard.ts` — the whole file is the keyboard layer. The accumulating listeners:

```ts
// packages/motion-dom/src/gestures/press/utils/keyboard.ts:26-41
const handleKeydown = filterEvents(() => {
    if (isPressing.has(element)) return

    firePointerEvent(element, "down")

    const handleKeyup = filterEvents(() => {
        firePointerEvent(element, "up")
    })

    const handleBlur = () => firePointerEvent(element, "cancel")

    element.addEventListener("keyup", handleKeyup, eventOptions)
    element.addEventListener("blur", handleBlur, eventOptions)
})

element.addEventListener("keydown", handleKeydown, eventOptions)
```

`firePointerEvent` (lines 13–17) dispatches `new PointerEvent("pointer" + type, { isPrimary: true, bubbles: true })`. `filterEvents` (lines 6–11) gates on `event.key === "Enter"`. `eventOptions` carries the gesture's abort signal (see `setupGesture` in `packages/motion-dom/src/gestures/utils/setup.ts`), so everything *is* cleaned up at gesture teardown — the leak is *during* the gesture's lifetime, which for a typical motion component is the element's whole life.

- `packages/motion-dom/src/gestures/press/index.ts:114-124` — the unsignalled focus listener and tabIndex mutation:

```ts
if (isHTMLElement(target)) {
    target.addEventListener("focus", (event) =>
        enableKeyboardPress(event as FocusEvent, eventOptions)
    )

    if (
        !isElementKeyboardAccessible(target) &&
        !target.hasAttribute("tabindex")
    ) {
        target.tabIndex = 0
    }
}
```

Note `addEventListener("focus", ...)` has no third argument — every other listener in this file passes `eventOptions`.

- `isPressing` — `packages/motion-dom/src/gestures/press/utils/state.ts`, a module-level `WeakSet` guarding re-entrant keydowns.
- Existing keyboard tests: `packages/framer-motion/src/gestures/__tests__/press.test.tsx` (~lines 75–160): focus + Enter keydown/keyup → `onTapStart`/`onTap`; blur mid-press → `onTapCancel`. These define the happy path that must not change.
- Test helpers: `fireEvent` from `../../jest.setup`; `PointerEventFake` (in `packages/framer-motion/src/jest.setup.tsx`) backs `new PointerEvent(...)` in jsdom and passes through `isPrimary`/`pointerType`/`button`. `nextFrame` helper from `./utils` flushes the frame-batched callbacks.
- **Build note**: framer-motion's Jest resolves `motion-dom` to its built `dist/` output. After editing motion-dom source, run `yarn build` from the repo root before running framer-motion tests.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build (repo root, REQUIRED after motion-dom edits) | `yarn build` | exit 0 |
| Press tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/__tests__/press"` (repo root) | all pass |
| Lint | `yarn lint` (repo root) | exit 0 |

Known pre-existing failures to ignore (do not fix): SSR tests failing with `TextEncoder is not defined`, and the `use-velocity` test.

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/gestures/press/utils/keyboard.ts`
- `packages/motion-dom/src/gestures/press/index.ts` (only lines 106–128, the `targets.forEach` block and return value)
- `packages/framer-motion/src/gestures/__tests__/press.test.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `onPointerEnd` / `startPress` in `press/index.ts` — covered by plan 022.
- Adding Space-key support — recorded as a deferred maintainer decision in `plans/README.md`; Enter-only is the documented current behavior.
- `packages/motion-dom/src/gestures/press/utils/is-keyboard-accessible.ts` — shared with drag; behavior is correct.

## Git workflow

- Branch: `fix/press-keyboard-listener-lifecycle`
- Commit style (match `git log`): `fix(press): remove stale keyboard listeners after press ends`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing tests

Add to `packages/framer-motion/src/gestures/__tests__/press.test.tsx`, near the existing keyboard tests (reuse their `enterKey` constant and focus/keyDown/keyUp pattern):

1. **`"completed keyboard press does not dispatch phantom pointercancel on later blur"`** — render a `motion.div` with `onTapStart`/`onTap` spies. Attach a spy directly: `container.firstChild.addEventListener("pointercancel", cancelSpy)`. Focus, Enter keydown, Enter keyup (complete one press, `await nextFrame()`), then `fireEvent.blur(...)`. Assert `cancelSpy` was called 0 times. (Pre-fix: the stale `handleBlur` dispatches one `pointercancel`.)
2. **`"repeated keyboard presses dispatch exactly one pointerup each"`** — same setup with a `pointerup` spy on the element. Perform two complete focus→Enter-down→Enter-up presses (focus once, then two down/up cycles). Assert the `pointerup` spy total is exactly 2. (Pre-fix: 1 + 2 = 3, because the first press's `keyup` listener is still attached during the second.)
3. **`"keyboard press on one element does not cancel a pointer press on another"`** — the headline regression. Render two motion.divs A and B; B has `onTap`/`onTapCancel` spies. Keyboard-press A once (focus, Enter down, Enter up, `await nextFrame()`). Then `pointerDown` on B, `fireEvent.blur` on A (simulating the focus shift a real pointerdown causes), `pointerUp` on B, `await nextFrame()`. Assert B's `onTap` 1, `onTapCancel` 0. (Pre-fix: A's stale blur listener dispatches `pointercancel`, which bubbles to window and cancels B's in-flight press → `onTap` 0, `onTapCancel` 1.)

**Verify**: press test pattern → exactly these 3 new tests fail with the pre-fix counts given above; all existing tests pass.

### Step 2: Remove keyup/blur listeners once the press resolves

In `keyboard.ts`, make each `keyup`/`blur` pair remove itself when either fires:

```ts
const handleKeydown = filterEvents(() => {
    if (isPressing.has(element)) return

    firePointerEvent(element, "down")

    const removeEndListeners = () => {
        element.removeEventListener("keyup", handleKeyup)
        element.removeEventListener("blur", handleBlur)
    }

    const handleKeyup = filterEvents(() => {
        removeEndListeners()
        firePointerEvent(element, "up")
    })

    const handleBlur = () => {
        removeEndListeners()
        firePointerEvent(element, "cancel")
    }

    element.addEventListener("keyup", handleKeyup, eventOptions)
    element.addEventListener("blur", handleBlur, eventOptions)
})
```

(If TypeScript complains about use-before-assign for `handleKeyup`/`handleBlur` inside `removeEndListeners`, declare `removeEndListeners` as an arrow `const` after both handlers and have the handlers call it — the closure resolves at call time, not declaration time. Keep the file's existing concise style.)

Leave the outer `keydown` registration and the existing keydown-removing blur listener (lines 46–50) as they are.

**Verify**: `yarn build` → exit 0. Press test pattern → new tests 1–3 pass; all existing keyboard tests (including `"press cancel event listeners fire via keyboard"`, which relies on blur-during-press firing cancel) still pass.

### Step 3: Register the focus listener with the gesture's options

In `press/index.ts`, pass `eventOptions` as the third argument so the abort signal covers it:

```ts
target.addEventListener(
    "focus",
    (event) => enableKeyboardPress(event as FocusEvent, eventOptions),
    eventOptions
)
```

**Verify**: `yarn build` → exit 0; press test pattern → all pass.

### Step 4 (small, same block): revert the tabIndex mutation on cancel

In `press/index.ts`, track elements whose `tabIndex` the gesture set, and clear it in the returned cancel function. Target shape — wrap the existing return value:

```ts
const tabIndexedTargets: HTMLElement[] = []

// inside targets.forEach, where tabIndex is currently set:
if (
    !isElementKeyboardAccessible(target) &&
    !target.hasAttribute("tabindex")
) {
    target.tabIndex = 0
    tabIndexedTargets.push(target)
}

// replace `return cancelEvents` with:
return () => {
    cancelEvents()
    tabIndexedTargets.forEach((element) =>
        element.removeAttribute("tabindex")
    )
}
```

Add a test in `press.test.tsx` using vanilla `press` imported from `"motion-dom"`: create a plain `div`, append to `document.body`, call `const cancel = press(el, jest.fn())`, assert `el.getAttribute("tabindex") === "0"`, call `cancel()`, assert `el.hasAttribute("tabindex") === false`. Clean up the div.

**Verify**: `yarn build` → exit 0; press test pattern → all pass including the new tabindex test.

## Test plan

Steps 1 and 4 define the four new tests. The real regression gates are tests 1–3 (phantom events); test 4 covers cancel hygiene. Existing keyboard tests in `press.test.tsx` are the characterization suite for the happy path — they must pass unmodified. No Cypress test: everything here is synchronous listener bookkeeping, fully observable in jsdom.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `yarn build` exits 0
- [ ] Press test pattern exits 0; 4 new tests exist and pass
- [ ] Existing keyboard press tests pass unmodified (no edits to their assertions)
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `keyboard.ts` or `press/index.ts` excerpts don't match the live code (drift — plan 022 may have landed; re-read and reconcile only if the differences are plan 022's documented changes to `onPointerEnd`).
- Any of the 3 phantom-event tests cannot be made to fail pre-fix for the stated reason (repo policy: no repro → no fix; report what jsdom did instead).
- The fix appears to require changing `isPressing` semantics or `filterEvents`.
- Existing keyboard tests fail after Step 2 — the blur-during-press cancel path must keep working; if it breaks, the removal ordering is wrong (remove listeners *before* dispatching, as shown).

## Maintenance notes

- If Space-key activation is ever added (deferred decision — see `plans/README.md`), it must reuse `removeEndListeners`; a second accumulating pair would reintroduce bug 2.
- The synthetic events still use `bubbles: true` deliberately — press's own window-level listeners depend on it. The fix removes *stale* dispatchers rather than stopping bubbling; don't "harden" by making them non-bubbling.
- Reviewer should scrutinize: that `removeEndListeners` runs before `firePointerEvent` in both handlers (so a re-entrant keydown triggered by the dispatched event can't observe half-removed state), and the tabindex revert only fires for elements the gesture itself mutated.
- Deferred from this plan: restoring a *pre-existing* `tabindex` attribute value is unnecessary — the gesture only sets `tabIndex` when the attribute is absent.
