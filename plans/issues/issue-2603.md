# Plan issue-2603: Expose moved-item details as a second argument to onReorder

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2603 --jq '.state'` → `open`
>    (if closed, mark DONE and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/components/Reorder/`
>    Plans 015–018 intentionally touch these files. **Specifically check
>    whether plan 018 landed** (`grep -n '"both"' packages/framer-motion/src/components/Reorder/Group.tsx`
>    matches ⇒ 018 landed): this plan documents both the pre-018 and
>    post-018 implementation of Step 3. Any other drift in `updateOrder` = STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (additive API; gated on maintainer approval of the shape)
- **Depends on**: none hard; prefer landing AFTER plans/018-reorder-multidimensional.md
  (018 rewrites `updateOrder` and already computes from/to indices — its
  maintenance notes name this issue: "The richer `onReorder` signature
  requested in #2603 ... falls out almost for free")
- **Category**: dx / direction
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2603

## Classification: FEATURE — maintainer decision gate on API shape

## Why this matters

`onReorder` only receives the new array. Consumers persisting order to
backends that move single items (the reporter's Redis `LREM`+`LINSERT` case,
or any "PATCH item position" API) must diff the old and new arrays to
recover which item moved — awkward and O(n) for information the Group
already has at the moment it computes the swap. Exposing
`{ value, from, to }` as an optional-to-consume second argument keeps
`onReorder={setItems}` working untouched (a function taking fewer
parameters is assignable in TypeScript, and React state setters ignore
extra arguments) while making the common persistence pattern one line.

## Maintainer decision gate (BEFORE implementing)

API addition. Proposed shape (recommend in the README row note):

```ts
onReorder: (newOrder: V[], details: { value: V; from: number; to: number }) => void
```

`from`/`to` are indices into the `values` array as passed in / as returned.
The maintainer must set this plan's row in `plans/issues/README.md` to
`APPROVED` (optionally amending the shape) before Steps 2+ run. If
`REJECTED`: comment the recommended userland diff snippet on the issue and
close as not_planned (`gh api -X PATCH repos/motiondivision/motion/issues/2603 -f state=closed -f state_reason=not_planned`)
— close only with an APPROVED-CLOSE row.

## Current state

- `packages/framer-motion/src/components/Reorder/Group.tsx:43` — prop type:
  `onReorder: (newOrder: V[]) => void`; re-declared in the forwardRef cast at
  lines 181–187 (`onReorder: (newOrder: Values) => void`) — both must change.
- `Group.tsx:115-139` — `updateOrder` (pre-018 shape): computes `newValues`
  by swapping two entries, then `onReorder(newValues)` at line 137. The
  dragged value is the `item` parameter, so the move is recoverable as
  `from = values.indexOf(item)`, `to = newValues.indexOf(item)` — no need to
  thread anything out of the swap loop.
- Post-018 shape (if landed): `updateOrder` computes `fromIndex`/`toIndex`
  directly and calls `onReorder(moveItem(values, fromIndex, toIndex))` — the
  details object is `{ value: order[move.from].value, from: fromIndex, to: toIndex }`.
- `packages/framer-motion/src/components/Reorder/types.ts` — context/type
  definitions; put the new exported `interface` here (repo rule: `interface`,
  no default exports).
- Existing unit-test pattern to copy: "Preserves unmeasured items during
  reorder (virtualized list support)" in
  `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx`
  — captures `ReorderContext` via a child component, calls
  `capturedContext.registerItem(...)` with box fixtures and
  `capturedContext.updateOrder(...)`, then asserts on an `onReorder` jest.fn.
  This drives the real Group logic in JSDOM without real layout.
- If plan 2658 (keyboard reordering) lands, its `onReorder` call site must
  pass the same details object — cross-link in the PR.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` from repo root | exit 0 |
| Reorder unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"` from repo root | pass |
| SSR tests | `cd packages/framer-motion && yarn test-server` | Reorder SSR tests unchanged (ignore pre-existing TextEncoder failures) |
| Lint | `yarn lint` from repo root | exit 0 |

No Cypress needed: the change is pure callback-payload logic, fully
exercised through the captured-context unit pattern (the existing
virtualization test already validates that pattern against real drag
behavior).

## Scope

**In scope** (only files you may modify):
- `packages/framer-motion/src/components/Reorder/Group.tsx`
- `packages/framer-motion/src/components/Reorder/types.ts`
- `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx`

**Out of scope**:
- `Item.tsx`, `check-reorder.ts`, `auto-scroll.ts` — owned by plans 015–018.
- Changing when/how often `onReorder` fires — payload only.
- A separate `onMove` callback or `{before}/{after}` API from the issue's
  alternatives — only the approved shape.

## Steps

### Step 1: Failing test first

Add to `__tests__/index.test.tsx`, modeled on the virtualization test
(context capture + box fixtures + `updateOrder` call). **Match the
`updateOrder`/`registerItem` signatures live in the file** — pre-018 it is
`updateOrder(value, offset, velocity)` with `registerItem(value, box)`;
post-018 it is `updateOrder(value, {x, y})`. Pre-018 sketch:

```tsx
it("Calls onReorder with moved item details", () => {
    const onReorder = jest.fn()
    // ...render Reorder.Group values={[1, 2, 3]} with ContextCapture child,
    // register three boxes stacked vertically (use the same Box fixtures as
    // the virtualization test), then:
    capturedContext.updateOrder(1, 60, 1) // drag item 1 past item 2's center
    expect(onReorder).toHaveBeenCalledWith(
        [2, 1, 3],
        { value: 1, from: 0, to: 1 }
    )
})
```

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"`
→ the new test FAILS with the second argument `undefined` (`toHaveBeenCalledWith`
mismatch). The existing virtualization test must still pass (it doesn't
assert on a second arg).

### Step 2 (gate: row APPROVED): Add the type

In `types.ts`:

```ts
export interface ReorderDetails<V> {
    value: V
    from: number
    to: number
}
```

In `Group.tsx`, update both `onReorder` declarations (Props line 43 and the
forwardRef cast lines 181–187) to
`(newOrder: V[]/Values, details: ReorderDetails<...>) => void`, and extend
the prop's JSDoc (keep `@public`) noting `details` identifies the moved
value and its old/new indices, and that `onReorder={setState}` keeps working.

### Step 3: Pass the details

Pre-018 `updateOrder` (Group.tsx:137): replace `onReorder(newValues)` with:

```ts
onReorder(newValues, {
    value: item,
    from: values.indexOf(item),
    to: newValues.indexOf(item),
})
```

(If the swap loop didn't change `item`'s position — can't happen, since
`checkReorder` only ever moves the dragged item — `from === to` is
impossible; don't guard for it.)

Post-018: in the rewritten `updateOrder`, call
`onReorder(moveItem(values, fromIndex, toIndex), { value: item, from: fromIndex, to: toIndex })`.

**Verify**: Step 1 test passes; full Reorder pattern run passes.

### Step 4: Full verification + PR

**Verify**: `yarn build`, `yarn lint` → exit 0;
`npx jest ... --testPathPattern="Reorder"` → pass;
`cd packages/framer-motion && yarn test-server` → Reorder SSR tests unchanged.

Branch `feat/2603-onreorder-details`; commit: short imperative sentence
(e.g. `Expose moved item details in onReorder`). PR body links
`Fixes #2603`; do NOT use `gh pr edit` (broken — use
`gh api -X PATCH repos/motiondivision/motion/pulls/<n>` for edits).

## Test plan

- New test (Step 1): swap forward → `{ value, from: 0, to: 1 }` payload.
- Add one more case in the same style: swap backward (drag item 2 up past
  item 1) → `{ value: 2, from: 1, to: 0 }`.
- Existing tests (union types, ref hydration, virtualization) pass unchanged
  — proving `onReorder={setItems}` consumers are unaffected.

## Done criteria

- [ ] Both new tests present and passing; suite exits 0
- [ ] `grep -n "ReorderDetails" packages/framer-motion/src/components/Reorder/types.ts` matches
- [ ] `yarn lint`, `yarn build` exit 0; SSR Reorder tests unchanged
- [ ] No files outside Scope modified (`git status`)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Row not APPROVED → stop after Step 1; report.
- `updateOrder` matches neither the pre-018 excerpt nor 018's documented
  shape (unexpected drift).
- TypeScript errors surface in consumers of `Reorder.Group` inside the repo
  (dev apps, tests) that can't be fixed by the two declared signature edits
  — the "fewer params is assignable" assumption would be violated somewhere.

## Maintenance notes

- If plan 2658 (keyboard reordering) lands, its `moveByOffset` path must
  construct the same `ReorderDetails` — reviewer should check both call
  sites stay consistent.
- Doc site (motion.dev) needs a matching API note — outside this repo;
  mention in the PR description.
