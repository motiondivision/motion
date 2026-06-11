# Plan issue-2579: Make `useInView` observe elements that mount after the first render

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. On
> any STOP condition, stop and report. When done, update the status row for
> this issue in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2579 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/utils/use-in-view.ts packages/framer-motion/src/utils/__tests__/use-in-view.test.tsx`
> On changes, compare the "Current state" excerpt with live code; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes effect timing of a widely used hook)
- **Depends on**: none
- **Category**: feature (behaves like a bug fix; issue filed as FEATURE)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2579

## Why this matters

If the component calling `useInView` renders `null` first (loading gate,
conditional content) and attaches the ref to an element on a later render,
the hook never observes that element: its effect ran once with
`ref.current === null`, bailed, and its dependency array gives it no reason
to run again. `isInView` stays `false` forever. The reporter asks for a way
to re-register; the right fix is for the hook to notice the element
appearing (or changing identity) on subsequent renders — same class of
late-binding problem `useScroll` already fixed for refs (`5401a9e4a`).

## Current state

- `packages/framer-motion/src/utils/use-in-view.ts:26-42` — the whole hook
  body; the permanent bail is line 27:
  ```ts
  useEffect(() => {
      if (!ref.current || (once && isInView)) return
      const onEnter = () => {
          setInView(true)
          return once ? undefined : () => setInView(false)
      }
      const options: InViewOptions = {
          root: (root && root.current) || undefined,
          margin, amount,
      }
      return inView(ref.current, onEnter, options)
  }, [root, ref, margin, once, amount])
  ```
  `ref` is a stable RefObject, so `ref.current` changing never re-fires the
  effect. The same hole applies to elements swapped via key changes (ref
  points at a NEW element, observer still watches the old one — actually the
  old observer was cleaned up on unmount of nothing; the effect simply never
  re-ran, so the new element is unobserved).
- `inView` (the underlying API): `packages/framer-motion/src/render/dom/viewport/index.ts`
  — takes a resolved Element, returns a stop function. No changes needed there.
- Test infra: `packages/framer-motion/src/utils/__tests__/use-in-view.test.tsx`
  with `getActiveObserver()` from `./mock-intersection-observer` — fires
  synthetic `[{ target, isIntersecting }]` entries. Model new tests on the
  existing "Returns false on mount" test (renders + multiple `rerender`s).
- Related precedent on main: `b0139c4d4` "Fix whileInView not triggering
  after remount (soft navigation)" — the feature-component path had a sibling
  bug; read that commit before implementing for conventions
  (`git show b0139c4d4`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build | `yarn build` (repo root) | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-in-view"` | all pass |
| Full client suite (regression sweep) | `cd packages/framer-motion && yarn test-client` | pass (ignore known pre-existing failures listed in memory: SSR TextEncoder, use-velocity) |

## Scope

**In scope**:
- `packages/framer-motion/src/utils/use-in-view.ts`
- `packages/framer-motion/src/utils/__tests__/use-in-view.test.tsx`

**Out of scope**:
- `render/dom/viewport/index.ts` (`inView`) — works on resolved elements.
- `motion/features/viewport` (`whileInView`) — separate code path, already
  fixed by `b0139c4d4`.
- API changes (accepting `Element` directly, callback refs) — bigger design,
  not needed for this fix.

## Git workflow

- Branch: `fix/issue-2579-use-in-view-late-element`
- Plain imperative commit messages + Claude co-author trailer (CLAUDE.md).

## Steps

### Step 1: Failing test first

Add to `use-in-view.test.tsx`:

```tsx
test("Observes element that mounts after first render", async () => {
    const Component = ({ show }: { show: boolean }) => {
        const ref = useRef(null)
        const isInView = useInView(ref)
        return show ? <div ref={ref} data-inview={isInView} /> : null
    }
    const { rerender, container } = render(<Component show={false} />)
    rerender(<Component show={true} />)
    // The bug: no active observer exists at this point.
    act(() => enter())
    rerender(<Component show={true} />)
    expect(container.firstChild).toHaveAttribute("data-inview", "true")
})
```

(Adapt to the file's existing helpers: `enter()` drives
`getActiveObserver()`; check how `target` is matched in
`mock-intersection-observer` — if the mock matches the observed element,
fire the entry with the actual rendered element instead of the module-level
`target`.) Also add: a test that the observer is torn down and re-created
when the ref element identity changes (conditional `key`), and a test that
`once: true` + already-in-view does not re-observe.

**Verify**: new "late mount" test FAILS on current code (isInView stays
false / no active observer). Existing tests still pass.

### Step 2: Implement element-aware re-registration

Replace the single effect with an every-render effect that diffs what it
observes (small-bytes pattern, no new module):

```ts
const observed = useRef<Element | null>(null)
const stop = useRef<VoidFunction | undefined>(undefined)

useEffect(() => {
    const element = ref.current
    if (
        element === observed.current ||
        (once && isInView)
    ) return

    stop.current?.()
    observed.current = element
    if (!element) return (stop.current = undefined)

    const onEnter = () => {
        setInView(true)
        return once ? undefined : () => setInView(false)
    }
    stop.current = inView(element, onEnter, {
        root: root?.current || undefined,
        margin, amount,
    })
}) // no dependency array: re-check each render, cheap identity compare

useEffect(() => () => { stop.current?.(); observed.current = null }, [])
```

Behavioral contract to preserve:
- Same-element re-renders are no-ops (identity check) — no
  observer churn (the existing "Returns false on mount" test with 5
  rerenders guards this; observer creation count can be asserted via the
  mock if it exposes it).
- Option changes (`root`/`margin`/`amount`/`once`) previously re-registered
  via the dep array; with the diff-based effect they no longer would. Reset
  `observed.current = null` when options change — keep a second tiny effect
  with the old dep list:
  `useEffect(() => { observed.current = null }, [root, margin, once, amount])`
  placed BEFORE the main effect so the next pass re-registers.
- `once && isInView` must still stop observation permanently (existing
  "once" tests).

Keep total added bytes minimal (CLAUDE.md size discipline); prefer exactly
this shape over abstractions.

**Verify**: Step 1 tests pass; whole `use-in-view` suite green.

### Step 3: Regression sweep

`cd packages/framer-motion && yarn test-client` — confirm no other suite
depends on the old effect timing (in particular nothing asserts
`IntersectionObserver` is constructed during layout-effect phase).

**Verify**: pass (modulo pre-existing known failures: SSR TextEncoder,
use-velocity).

## Test plan

- New: late-mount registration (the issue's exact scenario); element identity
  swap re-registers; `once` semantics preserved; no observer churn on
  same-element re-renders; option-change re-registration still works
  (e.g. margin change → new observer).
- Pattern: model on existing tests in `use-in-view.test.tsx` (render +
  rerender + `act(() => enter())`).
- Command: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-in-view"` → all pass, ≥4 new tests.

## Done criteria

- [ ] Step 1 test failed before implementation (note it in the PR)
- [ ] All `use-in-view` tests pass; `yarn test-client` no new failures
- [ ] `yarn build` exits 0
- [ ] Only in-scope files modified (`git status`)
- [ ] PR references #2579; `plans/issues/README.md` row updated

## STOP conditions

- The mock IntersectionObserver can't express "no observer registered yet"
  (Step 1 can't fail for the right reason) → extend the mock minimally; if
  that requires touching other suites' expectations, STOP and report.
- Step 3 surfaces a consumer relying on the dep-array re-registration
  semantics beyond the option-change case handled above.
- Implementing requires changing `inView` itself.

## Maintenance notes

- This makes `useInView` resilient to conditional rendering but still
  ref-based; if demand appears for observing changing elements eagerly
  (before a re-render), the API-level answer is accepting a callback ref —
  deliberately deferred.
- Reviewer should scrutinize: the dependency-less effect (runs every render —
  confirm the early-return identity check keeps it O(1)) and StrictMode
  double-invoke (effect cleanup via the unmount effect only; verify no
  double-observe in React 18 dev).
- Docs note for motion.dev (external): document that the hook now picks up
  late-mounted elements.
