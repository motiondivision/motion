# Plan 026: Fix InViewFeature reading `viewport.once` from a stale closure

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/motion/features/viewport`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (one-line read-site move; observer lifecycle untouched)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

The `whileInView`/`viewport` feature destructures `once` from props when the IntersectionObserver is created, but the observer callback outlives renders. The same callback explicitly re-reads `onViewportEnter`/`onViewportLeave` from latest props — with a comment saying exactly why — yet `once` was missed. Changing `viewport.once` between renders (e.g. a component that toggles "keep animating on scroll" off after a user interaction) silently has no effect until `amount`/`margin`/`root` *also* changes, because `update()` doesn't restart the observer for `once` either. Small bug, but it directly contradicts the code's own documented intent, and the fix is one line plus a test.

## Current state

- `packages/framer-motion/src/motion/features/viewport/index.ts` — `InViewFeature`. The stale read:

```ts
// viewport/index.ts:20-21 — destructured once, at observer-creation time
const { viewport = {} } = this.node.getProps()
const { root, margin: rootMargin, amount = "some", once } = viewport
```

```ts
// viewport/index.ts:44-48 — `once` used inside the long-lived callback
if (once && !isIntersecting && this.hasEnteredView) {
    return
} else if (isIntersecting) {
    this.hasEnteredView = true
}
```

```ts
// viewport/index.ts:57-63 — the same callback already re-reads OTHER props fresh:
/**
 * Use the latest committed props rather than the ones in scope
 * when this observer is created
 */
const { onViewportEnter, onViewportLeave } = this.node.getProps()
```

```ts
// viewport/index.ts:81-82 — update() restart list also omits "once"
const hasOptionsChanged = ["amount", "margin", "root"].some(
    hasViewportOptionChanged(props, prevProps)
)
```

- `root`/`margin`/`amount` are *observer construction* options — restarting on their change is correct. `once` is *callback behavior* — it should be read fresh per intersection, like the two callbacks are. Do **not** add `"once"` to the restart list; restarting the observer on a `once` toggle would needlessly churn the shared observer registry in `observers.ts`.
- Existing test exemplar with a working IntersectionObserver mock: `packages/framer-motion/src/utils/__tests__/use-in-view.test.tsx` and its helper `packages/framer-motion/src/utils/__tests__/mock-intersection-observer.ts` (exports `getActiveObserver()`; trigger with `getActiveObserver()?.([{ target, isIntersecting: true }])`).
- This file is pure framer-motion — **no motion-dom rebuild needed**; ts-jest runs against source.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Viewport feature tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="viewport"` (repo root) | all pass |
| use-in-view tests (mock sanity) | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-in-view"` | all pass |
| Lint | `yarn lint` (repo root) | exit 0 |

Known pre-existing failures to ignore (do not fix): SSR tests failing with `TextEncoder is not defined`, and the `use-velocity` test.

## Scope

**In scope** (the only files you should modify/create):
- `packages/framer-motion/src/motion/features/viewport/index.ts`
- `packages/framer-motion/src/motion/features/viewport/__tests__/index.test.tsx` (create; or add to an existing viewport test file if one exists — check first with `ls packages/framer-motion/src/motion/features/viewport/__tests__ 2>/dev/null`)

**Out of scope** (do NOT touch):
- `packages/framer-motion/src/motion/features/viewport/observers.ts` — the shared-observer registry is correct.
- `packages/framer-motion/src/render/dom/viewport/index.ts` — the standalone `inView()` is a separate implementation without a `once` option; unaffected.
- `packages/framer-motion/src/utils/use-in-view.ts` — the hook handles `once` itself, correctly.

## Git workflow

- Branch: `fix/inview-feature-stale-once`
- Commit style (match `git log`): `fix(viewport): read viewport.once from latest props in intersection callback`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing test

Create the test file. Setup: import the IntersectionObserver mock the same way `use-in-view.test.tsx` does (it installs on import; reuse `getActiveObserver()`), render a `motion.div` with `onViewportEnter`/`onViewportLeave` spies and `viewport={{ once: false }}` (note: jest.setup's `render` is the right import — copy the import block from `use-in-view.test.tsx`).

**`"viewport.once is read from latest props"`**:

1. Render with `viewport={{ once: false }}`; trigger enter (`isIntersecting: true`) with the element as `target` → `onViewportEnter` called once.
2. Rerender the same component with `viewport={{ once: true }}` (only `once` changes — `amount`/`margin`/`root` stay absent, so the observer is **not** restarted; that's the point).
3. Trigger leave (`isIntersecting: false`).
4. Assert `onViewportLeave` was **not** called (post-fix behavior: `once: true` + already entered ⇒ leave ignored). Pre-fix: stale `once === false` ⇒ `onViewportLeave` called once — the failing assertion.

Use the element rendered by `render()` as the entry `target` (the feature registers its callback per-element via `observerCallbacks` in `observers.ts`, so the target must be the actual DOM node).

**Verify**: viewport test pattern → exactly this test fails (`onViewportLeave` called 1 time, expected 0); nothing else fails.

### Step 2: Read `once` fresh in the callback

In `viewport/index.ts`:

- Remove `once` from the destructure at line 21 (keep `root`, `margin`, `amount` — they configure the observer).
- In `onIntersectionUpdate`, read it fresh alongside the existing fresh read:

```ts
const { onViewportEnter, onViewportLeave, viewport } =
    this.node.getProps()

if (viewport?.once && !isIntersecting && this.hasEnteredView) {
    return
} else if (isIntersecting) {
    this.hasEnteredView = true
}
```

Note the ordering: the existing code does the `once` check *before* invoking `setActive`/callbacks; preserve that control flow exactly — only the source of `once` changes. The fresh-props read must therefore move up to (or above) the `once` check; it's fine for `onViewportEnter`/`onViewportLeave` to be destructured in the same statement above the check. Keep the existing explanatory comment, moving it with the read.

**Verify**: viewport test pattern → all pass, including Step 1's test.

### Step 3: Regression sweep

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="(viewport|use-in-view|while-in-view)"` → all pass. `yarn lint` → exit 0.

## Test plan

Step 1's test is the regression gate. Add one companion test in the same file, **`"viewport once prevents re-entry callbacks"`** (characterizes existing behavior to guard the refactor): render with `viewport={{ once: true }}`, trigger enter → `onViewportEnter` 1; trigger leave, trigger enter again → `onViewportEnter` still 1, `onViewportLeave` 0. This must pass both pre- and post-fix.

Cypress `while-in-view.ts` / `while-in-view-remount.ts` specs exist for browser behavior; this change doesn't alter observer lifecycle, so jsdom coverage suffices — do not add a Cypress spec.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Viewport test pattern exits 0; 2 new tests exist and pass
- [ ] `grep -n "once" packages/framer-motion/src/motion/features/viewport/index.ts` shows no `once` in the `startObserver` destructure; the only behavioral read is inside `onIntersectionUpdate` via `getProps()`
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts don't match the live code (drift).
- Step 1's test cannot be made to fail pre-fix (the mock isn't reaching the feature's callback — check that the gesture feature bundle is loaded for `motion.div` in the test environment; if `viewport` features aren't active in the plain `motion` import, report rather than switching component setups speculatively).
- The fix appears to require changes to `observers.ts` or the `update()` restart list.

## Maintenance notes

- The mount-time `hasEnteredView`/`isInView` reset in `unmount()` (lines 90–94) was added by commit `b0139c4d4` (soft-navigation remount fix) — the new tests sit next to that behavior; a reviewer should confirm the remount Cypress spec (`while-in-view-remount.ts`) still passes in CI.
- If a `viewport.once` *restart* semantic is ever wanted (toggling once→false after entry re-arming leave events), that's a product decision — current fix preserves "once is evaluated per intersection with latest props".
