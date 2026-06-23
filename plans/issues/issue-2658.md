# Plan issue-2658: Add keyboard-accessible reordering to Reorder.Item

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2658 --jq '.state'` → `open`
>    (if closed, mark DONE and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/components/Reorder/`
>    Plans 015 and 018 intentionally rewrite parts of `Group.tsx`/`Item.tsx`
>    (015: `useDefaultMotionValue`;
>    018: `updateOrder`/`checkReorder`/axis typing). Those diffs are expected;
>    re-read the live files and adapt line references. Any change to how
>    `onReorder`/`values` flow that contradicts "Current state" = STOP.

## Status

- **Priority**: P2 (accessibility gap in a flagship component)
- **Effort**: M
- **Risk**: MED (new default-on key handling on focused items — gated)
- **Depends on**: none hard. Prefer landing AFTER plan 018 (both edit
  `Group.tsx`/`Item.tsx`; 018 is L-effort and feel-gated — don't make it
  rebase over this). If plan issue-2603 (onReorder details) is APPROVED,
  coordinate the `onReorder` payload (see Maintenance notes).
- **Category**: direction / dx (a11y)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2658

## Classification: FEATURE — maintainer decision gate on scope and defaults

## Why this matters

`Reorder` is pointer-only: there is no way to reorder with a keyboard, which
makes any list built on it fail WCAG 2.1.1 (Keyboard) and excludes
switch/keyboard users. The reorder *logic* needed is trivial — move the
item's value one index along `values` and call `onReorder` — everything hard
about pointer reordering (geometry, velocity, auto-scroll) is irrelevant to
the keyboard path. A small, opt-in-by-focusability key handler on
`Reorder.Item` closes the gap without changing pointer behavior or rendered
markup.

## Issue facts

Filed 2024-05-10, 0 comments, no proposed API. Ask: "Reorder should allow
both drag and drop and keyboard accessibility reordering." No repro needed —
this is a feature, not a bug.

## Maintainer decision gate (BEFORE implementing)

The maintainer must set this plan's row in `plans/issues/README.md` to
`APPROVED` before Steps 2+ run, deciding:

1. **Scope**: this plan implements key handling + programmatic move only.
   Full WAI-ARIA drag pattern (grab/drop mode with Space, `aria-live`
   announcements, `aria-grabbed`/`aria-dropeffect`) is explicitly deferred —
   announcements are app-locale-specific and belong to userland or a later
   plan. Items also do NOT get `tabIndex` automatically (changing every
   existing Reorder list's tab order would be a breaking change); users make
   items focusable, and the handler activates. Is that acceptable as v1?
2. **Bindings**: ArrowUp/ArrowDown when `axis="y"`, ArrowLeft/ArrowRight
   when `axis="x"` (both sets if 018's `axis="both"` is present), only when
   the item element itself has focus. No modifier required. Alternative
   (stricter a11y pattern, less discoverable): require a modifier or
   grab-mode — maintainer's call; the plan below assumes plain arrows.

If REJECTED: comment a userland recipe on the issue (focusable item +
`onKeyDown` calling `onReorder` with a moved array — it is implementable
today entirely outside the library) and close as not_planned via
`gh api -X PATCH repos/motiondivision/motion/issues/2658 -f state=closed -f state_reason=not_planned`
— only with an APPROVED-CLOSE row.

## Current state

- `packages/framer-motion/src/components/Reorder/Group.tsx:102-140` — the
  context object. `updateOrder` is geometry-driven (goes through
  `checkReorder`); the keyboard path must NOT reuse it — add a sibling
  context method that moves by index directly. `values` and `onReorder` are
  in scope there; `isReordering` ref guards one reorder per render
  (lines 93, 116, 121, 142–144) and the keyboard path must respect it too.
- `packages/framer-motion/src/components/Reorder/Item.tsx:98-133` — the
  rendered `<Component>`; props are spread at line 101 (`{...props}`), so a
  composed handler must be destructured out of `props` (see how `onDrag`/
  `onDragEnd` are pulled out at lines 67–68 and composed at 105–124) —
  otherwise the user's `onKeyDown` would be silently overridden, or ours
  would be overridden by the spread, depending on order.
- `packages/framer-motion/src/components/Reorder/types.ts` — context type
  `ReorderContextProps<T>`; add the new method here.
- `moveItem` utility: `packages/motion-utils/src/array.ts:11` —
  `moveItem([...arr], fromIndex, toIndex)` clones and splices; out-of-range
  `fromIndex` returns the clone unchanged. Import from `motion-utils`
  (Group.tsx does not currently import it pre-018; plan 018 adds the import).
- Test pattern: `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx`
  — `render` from `../../../jest.setup`; the virtualization test shows the
  ContextCapture pattern. For keyboard, prefer driving the real DOM with
  `fireEvent.keyDown` (import from `@testing-library/react` the way other
  suites in the repo do — check `grep -rn "fireEvent" packages/framer-motion/src --include="*.test.tsx" | head`).
- JSDOM is sufficient: the keyboard path is pure index logic + React event
  handling; no layout, no WAAPI. A Cypress smoke spec is still added for
  real-browser focus semantics and the layout animation on reorder.

## Design

`types.ts`:

```ts
// add to ReorderContextProps<T>
moveItem: (item: T, offset: 1 | -1) => void
```

`Group.tsx` context (naming: `moveItem` collides with the motion-utils
import — import it aliased, e.g. `import { moveItem as moveArrayItem } from "motion-utils"`,
or name the context method `moveByOffset`; pick ONE and keep it consistent):

```ts
moveByOffset: (item, offset) => {
    if (isReordering.current) return
    const index = values.indexOf(item)
    if (index === -1) return
    const next = index + offset
    if (next < 0 || next >= values.length) return
    isReordering.current = true
    onReorder(moveArrayItem(values, index, next))
},
```

`Item.tsx` — destructure `onKeyDown` from props alongside `onDrag`, and on
the `<Component>`:

```tsx
onKeyDown={(event: React.KeyboardEvent) => {
    if (event.target === event.currentTarget) {
        const offset =
            event.key === (axis === "x" ? "ArrowRight" : "ArrowDown")
                ? 1
                : event.key === (axis === "x" ? "ArrowLeft" : "ArrowUp")
                ? -1
                : 0
        if (offset) {
            event.preventDefault()
            moveByOffset(value, offset as 1 | -1)
        }
    }
    onKeyDown && onKeyDown(event)
}}
```

Notes baked into the design:
- `event.target === event.currentTarget` guard: arrow keys inside nested
  inputs/contenteditable children must not reorder or be preventDefault-ed.
- `preventDefault` only when a move key matched: prevents page scroll on
  handled arrows, leaves everything else native.
- If plan 018 landed and `axis === "both"`: treat ArrowUp/Down AND
  ArrowLeft/Right as -1/+1 respectively (index order, since 2D geometry has
  no meaning for index stepping).
- The user's `onKeyDown` always runs (after ours), matching the
  `onDrag`/`onDragEnd` composition style at Item.tsx:105-124.
- The reorder triggers the item's existing `layout` animation — keyboard
  moves animate for free.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` from repo root | exit 0 |
| Reorder unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"` from repo root | pass |
| SSR tests | `cd packages/framer-motion && yarn test-server` | Reorder SSR markup tests unchanged (no new attributes render by default) |
| Lint | `yarn lint` from repo root | exit 0 |
| Cypress | recipe below | pass on React 18 AND 19 |

```bash
# React 18
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --headed --config baseUrl=http://localhost:$PORT --spec "cypress/integration/reorder-keyboard.ts,cypress/integration/drag-to-reorder.ts"
kill $DEV_PID

# React 19
PORT=$((10000 + RANDOM % 50000))
cd ../../dev/react-19 && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --config-file=cypress.react-19.json --config baseUrl=http://localhost:$PORT --headed --spec "cypress/integration/reorder-keyboard.ts,cypress/integration/drag-to-reorder.ts"
kill $DEV_PID
```

Foreground only; `tail -60` the first run.

## Scope

**In scope** (only files you may modify/create):
- `packages/framer-motion/src/components/Reorder/Group.tsx`
- `packages/framer-motion/src/components/Reorder/Item.tsx`
- `packages/framer-motion/src/components/Reorder/types.ts`
- `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx`
- `dev/react/src/tests/reorder-keyboard.tsx` (create)
- `packages/framer-motion/cypress/integration/reorder-keyboard.ts` (create)

**Out of scope**:
- Automatic `tabIndex`, ARIA attributes, screen-reader announcements —
  deferred (gate item 1). Document the `tabIndex` requirement in JSDoc.
- `check-reorder.ts`, `auto-scroll.ts` — pointer-path internals.
- Grab/drop (Space) interaction mode.
- Drag gesture changes of any kind.

## Steps

### Step 1: Failing unit test first

Add to `__tests__/index.test.tsx` (this fails today because no key handler
exists — the right kind of failure for a feature is the asserted behavior
not happening, and `onReorder` not being called is exactly that):

```tsx
it("Reorders on ArrowDown when the item has focus", () => {
    const onReorder = jest.fn()
    const { getAllByRole } = render(
        <Reorder.Group values={["a", "b", "c"]} onReorder={onReorder}>
            {["a", "b", "c"].map((item) => (
                <Reorder.Item key={item} value={item} tabIndex={0} />
            ))}
        </Reorder.Group>
    )
    const [first] = getAllByRole("listitem")
    first.focus()
    fireEvent.keyDown(first, { key: "ArrowDown" })
    expect(onReorder).toHaveBeenCalledWith(["b", "a", "c"])
})
```

(If `getAllByRole("listitem")` doesn't resolve in this setup, fall back to
`container.querySelectorAll("li")`, matching the union-types test at the top
of the file.)

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"`
→ new test FAILS (`onReorder` not called). Existing tests pass.

### Step 2 (gate: row APPROVED): Implement

Apply the Design section: `types.ts` context method, `Group.tsx`
`moveByOffset`, `Item.tsx` composed `onKeyDown`. Add JSDoc to the `Props`
interface in `Item.tsx` noting keyboard reordering activates when the item
is focusable (`tabIndex={0}`) and which keys apply per axis. Keep output
size minimal (repo rule) — no helper modules, inline the key mapping.

**Verify**: Step 1 test passes.

### Step 3: Edge-case unit tests

Same file, same pattern:
- ArrowUp on first item / ArrowDown on last item → `onReorder` NOT called.
- `axis="x"`: ArrowRight moves forward, ArrowDown does nothing.
- Key event fired on a child element (render a `<button>` inside the item,
  `fireEvent.keyDown(button, { key: "ArrowDown" })`) → `onReorder` NOT called.
- User-supplied `onKeyDown` on `Reorder.Item` still fires (jest.fn called)
  for both handled and unhandled keys.
- ArrowDown twice in the same render cycle → only one reorder
  (`isReordering` guard; second call before re-render is ignored).

**Verify**: full Reorder pattern run → all pass.

### Step 4: Dev page + Cypress smoke

`dev/react/src/tests/reorder-keyboard.tsx` (named `App` export, modeled on
`dev/react/src/tests/drag-to-reorder.tsx`): vertical `Reorder.Group` with 3
items, `tabIndex={0}`, `id` per item, `useState` for values, item order also
rendered as text (e.g. `<div id="order">{items.join(",")}</div>`).

`packages/framer-motion/cypress/integration/reorder-keyboard.ts`:
1. `cy.visit("?test=reorder-keyboard")`, focus first item
   (`cy.get("#item-a").focus()`), `.trigger("keydown", { key: "ArrowDown" })`,
   assert `#order` text becomes `b,a,c` and DOM order of `li`s changed.
2. ArrowUp on the (now second) item returns order to `a,b,c`.
3. Drag-to-reorder still works on this page is covered by the existing
   `drag-to-reorder.ts` spec in the run list — don't duplicate it.

**Verify**: Cypress recipe on React 18 AND React 19 → both pass.

### Step 5: Full verification + PR

**Verify**: `yarn build`, `yarn lint` → exit 0; full Reorder jest pattern →
pass; `cd packages/framer-motion && yarn test-server` → Reorder SSR tests
unchanged (no default-rendered attribute changes).

Branch `feat/2658-reorder-keyboard`; commit: short imperative sentence
(e.g. `Add keyboard reordering to Reorder.Item`). PR links `Fixes #2658`,
states the deferred ARIA scope explicitly. Don't use `gh pr edit` (broken);
use `gh api -X PATCH repos/motiondivision/motion/pulls/<n>` for edits.

## Test plan

Unit (primary regression gate, Steps 1+3): happy path both axes, boundary
indices, child-target guard, handler composition, `isReordering` guard.
Cypress (Step 4): real-browser focus + keydown round trip on React 18/19,
plus existing `drag-to-reorder.ts` proving pointer path untouched.

## Done criteria

- [ ] All new unit tests present and passing; suite exits 0
- [ ] Cypress `reorder-keyboard.ts` + `drag-to-reorder.ts` pass on React 18 and 19
- [ ] SSR Reorder tests pass with zero changes to `server.ssr.test.tsx`
- [ ] `yarn lint`, `yarn build` exit 0; `git status` clean outside Scope
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Row not APPROVED → stop after Step 1; report.
- SSR markup tests change (means something now renders by default — it must not).
- Composing `onKeyDown` conflicts with a handler the motion component
  already attaches internally (check: `grep -rn "onKeyDown" packages/framer-motion/src/motion packages/framer-motion/src/gestures | grep -v test` — at planning time the press
  gesture handles keyboard via DOM listeners in motion-dom, not via React
  `onKeyDown` props; if that changed, reassess).
- Plan 018 is mid-flight on the same files and the operator hasn't said
  which lands first.

## Maintenance notes

- If plan issue-2603 (onReorder details) is approved, `moveByOffset` must
  pass `{ value: item, from: index, to: next }` as `onReorder`'s second
  argument — whichever lands second adds it to the other's call site.
- Follow-up candidates (separate plans, do not build now): `aria-live`
  announcement hook, Space-to-grab mode, automatic `tabIndex` behind an
  opt-in prop, Home/End to move to extremes.
- Reviewer should scrutinize: the child-target guard (a11y widgets nested in
  items), and that `preventDefault` never fires for unhandled keys.
