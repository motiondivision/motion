# Plan issue-2637: Forward custom props starting with "drag" to wrapped components

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update this issue's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2637 --jq .state` → `open`
>    (if `closed`, STOP — nothing to do).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/motion/utils/valid-prop.ts packages/framer-motion/src/render/dom/utils/filter-props.ts`
>    If either file changed, re-verify the "Current state" excerpts before
>    proceeding; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2637

## Why this matters

`motion(MyComponent)` filters out every prop whose name starts with `drag`
before forwarding props to the wrapped component, because Motion claims the
entire `drag*` prop namespace by prefix match. A user passing their own prop
such as `dragHandleProps` (react-beautiful-dnd interop) or `dragData` to a
motion-wrapped custom component silently never receives it. The actual drag
API is a fixed, known set of 10 props — claiming the whole prefix is
overreach. (The issue's CodeSandbox is Cloudflare-blocked, but the report is
fully self-describing and trivially reproducible from the description.)

## Current state

- `packages/framer-motion/src/motion/utils/valid-prop.ts` — `isValidMotionProp`,
  the predicate that decides which props Motion consumes vs forwards.
  Lines 51–61:

  ```ts
  export function isValidMotionProp(key: string) {
      return (
          key.startsWith("while") ||
          (key.startsWith("drag") && key !== "draggable") ||
          key.startsWith("layout") ||
          key.startsWith("onTap") ||
          key.startsWith("onPan") ||
          key.startsWith("onLayout") ||
          validMotionProps.has(key as keyof MotionProps)
      )
  }
  ```

  `validMotionProps` (lines 9–41) is a `Set` that already contains the drag
  event handlers: `onDragStart`, `onDrag`, `onDragEnd`,
  `onMeasureDragConstraints`, `onDirectionLock`, `onDragTransitionEnd`,
  `_dragX`, `_dragY`.

- `packages/framer-motion/src/render/dom/utils/filter-props.ts` —
  `filterProps` (lines 45–78) forwards a prop to a custom component when
  `!isDom && !isValidMotionProp(key)` (line 67). So any `drag*`-prefixed prop
  is swallowed for custom components, and likewise never forwarded to DOM
  elements (line 65 via `shouldForward`).

- The complete set of non-handler drag props (verified against
  `packages/motion-dom/src/node/types.ts:591-786`): `drag`,
  `dragDirectionLock`, `dragPropagation`, `dragConstraints`, `dragElastic`,
  `dragMomentum`, `dragTransition`, `dragControls`, `dragSnapToOrigin`,
  `dragListener`. `whileDrag` remains covered by the `while` prefix.

- Existing test exemplar:
  `packages/framer-motion/src/motion/__tests__/custom.test.tsx:38`
  ("doesn't forward motion props but does forward custom props").

- `isValidMotionProp` is exported public API
  (`packages/framer-motion/src/index.ts`) — keep name and signature.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="custom"` | all pass |
| Full client tests | `cd packages/framer-motion && yarn test-client` | pass (ignore pre-existing TextEncoder SSR + use-velocity failures) |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope**:
- `packages/framer-motion/src/motion/utils/valid-prop.ts`
- `packages/framer-motion/src/motion/__tests__/custom.test.tsx` (add test)

**Out of scope**:
- `key.startsWith("while")` / `"layout"` / `"onTap"` etc. — same overreach
  pattern, but not what this issue reports; do not change them.
- `filter-props.ts` — no change needed there.
- Do NOT remove `draggable` forwarding behavior (native HTML attribute must
  keep passing through; the `onDrag*`-with-`draggable` special case in
  `filter-props.ts:68-70` stays as is).

## Git workflow

- Branch: `fix/issue-2637-drag-prop-prefix`
- Commit style: imperative summary, e.g. `Fix custom drag-prefixed props being filtered from wrapped components`, body ends with `Co-Authored-By:` trailer per repo convention.
- Open a PR with `gh pr create` (note: `gh pr edit` is broken on this repo — if you need to amend the body use `gh api -X PATCH repos/motiondivision/motion/pulls/<n> -f body=...`).

## Steps

### Step 1: Write the failing test

In `packages/framer-motion/src/motion/__tests__/custom.test.tsx`, add a test
modeled on the existing "doesn't forward motion props but does forward custom
props" test (line 38): create a `forwardRef` component that records its
received props, wrap with `motion()`, render with both a real drag prop and a
custom drag-prefixed prop:

```tsx
<MotionComponent drag dragHandleProps={{ foo: true }} dragData="x" />
```

Assert: `dragHandleProps` and `dragData` ARE received by the wrapped
component; `drag` is NOT.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="custom"`
→ the new test FAILS (custom props missing), existing tests pass. If it
passes before any code change, STOP — the behavior already changed.

### Step 2: Replace the prefix match with the explicit prop set

In `valid-prop.ts`:
1. Add the 10 drag props to the `validMotionProps` set: `drag`,
   `dragDirectionLock`, `dragPropagation`, `dragConstraints`, `dragElastic`,
   `dragMomentum`, `dragTransition`, `dragControls`, `dragSnapToOrigin`,
   `dragListener`. (`_dragX`/`_dragY` and the `onDrag*` handlers are already
   there.)
2. Delete the line `(key.startsWith("drag") && key !== "draggable") ||`.

Note `validMotionProps` is typed `Set<keyof MotionProps>` — if any of the 10
names is not in `MotionProps`, the missing name reveals a type-surface gap;
add the prop name with a cast only if TypeScript rejects it, and mention it
in the PR body.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="custom"` → all pass, including Step 1's test.

### Step 3: Run the wider suites

**Verify**:
- `cd packages/framer-motion && yarn test-client` → no NEW failures vs a
  baseline run on `main` (pre-existing TextEncoder/use-velocity failures are
  known).
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="gestures/drag"` → all pass (drag still recognized as a motion prop).
- `yarn lint` → exit 0.

## Test plan

- New Jest test (Step 1): custom drag-prefixed props forwarded; real drag
  props still consumed. No Cypress needed — this is pure prop-filtering
  logic, fully testable in JSDOM.

## Done criteria

- [ ] New test in `custom.test.tsx` passes; failed before the fix
- [ ] `grep -n 'startsWith("drag")' packages/framer-motion/src/motion/utils/valid-prop.ts` → no matches
- [ ] `yarn test-client` shows no new failures; `yarn lint` exits 0
- [ ] Only in-scope files modified (`git status`)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 1's test passes before the fix (behavior drifted).
- Any drag Cypress/Jest test newly fails after Step 2 — that would mean some
  internal code path relied on the prefix match; report rather than patch
  around it.
- You find `isValidMotionProp` consumers beyond `filter-props.ts` inside
  `src/` whose behavior would change in a way not covered here
  (`grep -rn "isValidMotionProp" packages/framer-motion/src --include="*.ts*" | grep -v __tests__`
  currently shows only `index.ts` re-export, `filter-props.ts`, and the
  definition).

## Maintenance notes

- Behavior change to document in the PR: unknown `drag*` props now also pass
  through to DOM elements for `motion.div` etc. (e.g. `dragFoo` will trigger
  React's unknown-prop warning) — this is parity with plain `<div dragFoo>`.
- Any future drag prop (e.g. `dragSnapToCursor` from PR #3723, or new props
  from plans 019–021) MUST be added to `validMotionProps` or it will leak to
  the DOM / wrapped components. Call this out in the PR body and consider a
  comment in `valid-prop.ts`.
- `whileFoo`, `layoutFoo` prefixes still over-claim; deliberately untouched.
