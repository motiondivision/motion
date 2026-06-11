# Plan issue-2365: Fix SVG `style` prop changes being swallowed by a stale memoized merge

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2365 --jq .state` → expected `open`. If closed, STOP.
> 2. `git log --oneline 42bfbe3ed..HEAD -- packages/framer-motion/src/render/svg/use-props.ts`
>    If commits appear (PR #3749 touches the `useMemo` body of this file),
>    re-read the file and confirm the buggy merge excerpted below still
>    exists at the bottom of `useSVGProps`. If it's gone, STOP and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none. NOT fixed by PR #3749 (`worktree-style-effect`) — its
  diff to `use-props.ts` only swaps `buildSVGAttrs` for `buildSVGProps`
  inside the memo and leaves the buggy merge untouched (verified against the
  local `worktree-style-effect` branch). Expect a trivial textual conflict if
  #3749 lands first; the fix below applies identically on top of it.
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2365

## Why this matters

Changing a plain (non-MotionValue) `style` prop value on any SVG motion
component (`motion.svg`, `motion.rect`, …) has no effect after the first
render: the first render's raw style values win forever. The reporter's
repro: `motion.svg` with `style={{ background: clicked ? "blue" : "red" }}`
stays red. The same pattern works on `motion.div`. Users are forced to wrap
every style value in a MotionValue as a workaround. CodeSandbox repro
(https://codesandbox.io/s/quirky-bhabha-qh8hrn) is Cloudflare-blocked at
planning time, but the issue text fully specifies the repro and the root
cause is confirmed statically below.

## Current state

Root cause — `packages/framer-motion/src/render/svg/use-props.ts:16-39`:

```ts
const visualProps = useMemo(() => {
    const state = createSvgRenderState()
    buildSVGAttrs(state, visualState, isSVGTag(Component), props.transformTemplate, props.style)
    return {
        ...state.attrs,
        style: { ...state.style },
    }
}, [visualState])

if (props.style) {
    const rawStyles = {}
    copyRawValuesOnly(rawStyles, props.style as any, props)
    visualProps.style = { ...rawStyles, ...visualProps.style }
}

return visualProps
```

The bug is the last block, which runs every render but **mutates the
memoized object**:

1. `visualState` is a stable reference (created once via `useConstant` in
   `packages/framer-motion/src/motion/utils/use-visual-state.ts:134-142`),
   so the `useMemo` never recomputes and `visualProps` is the same object on
   every render.
2. Render 1: `visualProps.style` is replaced with
   `{ ...raw(red), ...builtStyles }` — the raw values are now baked into the
   memoized object.
3. Render 2 (style prop changed to blue):
   `visualProps.style = { ...raw(blue), ...visualProps.style }` — the spread
   of the *previous* merged object (containing red) comes **last** and
   overwrites the fresh raw value. Red wins on every subsequent render, and
   stale keys accumulate.

Contrast with the HTML path, which is correct because it builds a **fresh**
object every render — `packages/framer-motion/src/render/html/use-props.ts:34-49`:

```ts
function useStyle(props, visualState) {
    const styleProp = props.style || {}
    const style = {}
    copyRawValuesOnly(style, styleProp as any, props)
    Object.assign(style, useInitialMotionValues(props, visualState))
    return style
}
```

Existing test exemplar for `useSVGProps`:
`packages/framer-motion/src/render/svg/__tests__/use-props.test.ts` (uses
`renderHook` from `@testing-library/react`).

## Commands you will need

| Purpose | Command (repo root) | Expected on success |
|---|---|---|
| Build | `yarn build` | exit 0 |
| Targeted Jest | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="svg/__tests__/use-props"` | all pass |
| SVG-related Jest | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="svg"` | all pass |
| Full client Jest | `cd packages/framer-motion && yarn test-client` | no new failures |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `packages/framer-motion/src/render/svg/use-props.ts`
- `packages/framer-motion/src/render/svg/__tests__/use-props.test.ts` (extend)

**Out of scope**:
- `packages/framer-motion/src/render/html/use-props.ts` — already correct.
- Making the `useMemo` recompute on `props.style` changes — built styles come
  from `visualState`, not the style prop; the raw-value merge is the only
  per-render concern. Do not add `props.style` to the dependency array.
- Any motion-dom file.

## Git workflow

- Branch: `fix/issue-2365-svg-style-prop` from `main`.
- Commit message style: `Fix SVG style prop changes not applying across re-renders (#2365)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing test first

Add to `packages/framer-motion/src/render/svg/__tests__/use-props.test.ts`:

```ts
test("re-applies changed raw style prop values across re-renders", () => {
    const visualState = {} // stable reference, matching useConstant behaviour
    const { result, rerender } = renderHook(
        ({ fill }: { fill: string }) =>
            useSVGProps(
                { style: { fill } } as any,
                visualState,
                false,
                "svg"
            ),
        { initialProps: { fill: "red" } }
    )

    expect((result.current.style as any).fill).toBe("red")

    rerender({ fill: "blue" })

    expect((result.current.style as any).fill).toBe("blue")
})
```

Also add a component-level test (same file or
`packages/framer-motion/src/render/svg/__tests__/`), mirroring the issue:
render `<motion.svg style={{ background: "red" }} />` via the repo's
`render` helper (`import { render } from "../../../jest.setup"`), rerender
with `background: "blue"`, assert
`expect(container.firstChild).toHaveStyle("background: blue")`.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="svg/__tests__/use-props"`
→ the new tests FAIL with the stale value (`"red"`). If they pass, STOP —
re-ground the root cause before changing anything.

### Step 2: Stop mutating the memoized object

In `packages/framer-motion/src/render/svg/use-props.ts`, replace the final
block (lines 33-39 at planning time) so each render returns a fresh
top-level object and the memoized `visualProps` is never written to:

```ts
if (!props.style) return visualProps

const rawStyles = {}
copyRawValuesOnly(rawStyles, props.style as any, props)

return {
    ...visualProps,
    style: { ...rawStyles, ...visualProps.style },
}
```

Notes:
- `visualProps.style` (built, animated values) must still win over raw
  values — keep it last in the spread.
- Keep the repo's size-first style; the shape above is the intent, not
  sacred text.

**Verify**: Step 1's Jest command → all tests pass, including the two new ones.

### Step 3: Regression pass

**Verify**:
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="svg"` → all pass.
- `cd packages/framer-motion && yarn test-client` → no new failures
  (pre-existing SSR TextEncoder / use-velocity failures are known).
- `yarn lint` → exit 0.

Cypress is not required: this is pure React-render/object-identity logic,
fully observable in JSDOM (no WAAPI, no layout). The existing SVG Cypress
specs (`svg.ts`, `svg-style-on-mount.ts`) guard the mount-time behaviour and
must stay green in CI.

## Test plan

- Hook-level: raw style value updates across rerenders (the bug); built/
  animated style still overrides raw style (covered by existing
  "should return correct styles for element" test — must stay green).
- Component-level: `motion.svg` style prop change reflected in DOM.
- Pattern exemplar: `packages/framer-motion/src/render/svg/__tests__/use-props.test.ts`.

## Done criteria

- [ ] `yarn build` exits 0
- [ ] Both new tests exist and pass; all existing `use-props` tests still pass
- [ ] `grep -n "visualProps.style =" packages/framer-motion/src/render/svg/use-props.ts` returns no matches (no more mutation)
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Step 1's tests pass before the fix (codebase drifted; the mutation may
  already be gone — report and reclassify).
- The excerpted merge block no longer matches `use-props.ts` (e.g. #3749
  follow-ups landed) and the conflict is more than textual.
- Existing `use-props.test.ts` assertions fail after Step 2 — particularly
  the `toStrictEqual` shapes; that would mean the fresh-object return changed
  observable prop identity in a way tests pin down. Report rather than
  loosening assertions.

## Maintenance notes

- The asymmetry between `useHTMLProps` (fresh object per render) and
  `useSVGProps` (memoized + per-render merge) is what allowed this bug;
  if #3749's effects pipeline later unifies SVG prop building, this test is
  the regression gate for raw-style updates.
- Reviewer should check: returning a new object every render is exactly what
  the HTML path already does — no extra re-render cost is introduced.
- Closing issue 2365 after merge: only when the `plans/issues/README.md` row
  for this plan is marked APPROVED.
