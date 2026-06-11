# Plan issue-2263: Hydrate the new external ref when a motion component's `ref` prop changes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/motion/utils/use-motion-ref.ts packages/framer-motion/src/motion/__tests__/component.test.tsx`
> If either file changed, compare the "Current state" excerpts against the
> live code; on a mismatch treat it as a STOP condition.
> Also: `gh api repos/motiondivision/motion/issues/2263 --jq .state` → `"open"`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — touches ref plumbing that was deliberately reworked for
  Radix UI `asChild` (#3455, commit `8ba5f13f9`, v12.24.10); regressions there
  break AnimatePresence exit animations
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2263

## Why this matters

With a plain `<div ref={...}>`, React detaches the old ref (sets
`.current = null` / calls the old callback with `null`) and attaches the new
one whenever the `ref` prop's identity changes between renders. With
`motion.div`, the callback ref actually attached to the DOM element is the
stable function returned by `useMotionRef` — its `useCallback` deps are
`[visualElement]` only — so React never re-invokes it when the user swaps
their `ref` prop. The replacement ref is stored in a container but **never
called/assigned with the instance**, so the new `ref.current` stays `null`
until the component unmounts. That breaks the standard React ref contract
(issue's repro: swap to a fresh ref object, `ref.current` is `null`). The
issue's CodeSandbox (`26zghl`) is Cloudflare-gated, but the contract violation
is fully reproducible from the description and verified by the failing test in
Step 1.

## Current state

- `packages/framer-motion/src/motion/utils/use-motion-ref.ts` — the whole
  file (62 lines). Key parts at `42bfbe3ed`:
  ```ts
  // :24-27 — latest external ref is stored but never (re)hydrated
  const externalRefContainer = useRef(externalRef)
  useInsertionEffect(() => {
      externalRefContainer.current = externalRef
  })

  // :30 — React 19 callback-ref cleanup storage
  const refCleanup = useRef<(() => void) | null>(null)

  // :32-60 — stable callback; deps [visualElement]; hydrates
  // externalRefContainer.current only when React calls it (mount/unmount)
  return useCallback(
      (instance: Instance) => {
          if (instance) { visualState.onMount?.(instance) }
          if (visualElement) {
              instance ? visualElement.mount(instance) : visualElement.unmount()
          }
          const ref = externalRefContainer.current
          if (typeof ref === "function") { ... } else if (ref) {
              ;(ref as React.MutableRefObject<Instance>).current = instance
          }
      },
      [visualElement]
  )
  ```
- Why it's shaped this way: commit `8ba5f13f9` ("Fix AnimatePresence exit
  animations with Radix UI asChild", fixes #3455) removed `externalRef` from
  the deps because Radix creates a new composed callback ref every render;
  recreating the motion ref callback made React detach/reattach it, calling
  `visualElement.unmount()` mid-life and breaking exit animations. **The fix
  below must not reintroduce that** — the callback attached to the element
  stays stable; only the *external* ref is re-hydrated manually.
- Existing regression gates for the Radix behaviour:
  - `dev/react/src/tests/motion-ref-forwarding.tsx` +
    `packages/framer-motion/cypress/integration/motion-ref-forwarding.ts`
  - `dev/react/src/tests/animate-presence-radix-dialog.tsx` +
    `packages/framer-motion/cypress/integration/animate-presence-radix-dialog.ts`
- Jest pattern to model on: `packages/framer-motion/src/motion/__tests__/component.test.tsx`
  ("accepts createref", ~line 130).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build (after src changes, before Cypress) | `yarn build` (repo root) | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="component.test"` | all pass |
| Cypress React 18/19 | CLAUDE.md recipe (start Vite directly, random port) | specs pass |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope**:
- `packages/framer-motion/src/motion/utils/use-motion-ref.ts`
- `packages/framer-motion/src/motion/__tests__/component.test.tsx` (add tests)

**Out of scope**:
- `VisualElement.mount/unmount` — must NOT be called on external-ref changes.
- `use-visual-element.ts`, AnimatePresence internals.
- Do not add `externalRef` back to the `useCallback` deps (re-breaks #3455).

## Git workflow

- Branch: `fix/issue-2263-ref-swap` from `main`.
- Commit style: imperative summary + body, e.g. existing
  `Fix AnimatePresence exit animations with Radix UI asChild`. Include
  `Fixes #2263` and the Claude co-author trailer per repo convention.
- Open a PR when green; `gh pr edit` is broken on this repo — use
  `gh api -X PATCH repos/motiondivision/motion/pulls/<n>` if edits are needed.

## Steps

### Step 1: Write the failing tests FIRST

In `packages/framer-motion/src/motion/__tests__/component.test.tsx` add:

```tsx
it("hydrates a replaced object ref and detaches the old one", () => {
    const refA = createRef<HTMLDivElement>()
    const refB = createRef<HTMLDivElement>()
    const Component = ({ r }: { r: React.Ref<HTMLDivElement> }) => (
        <motion.div ref={r} />
    )
    const { rerender } = render(<Component r={refA} />)
    expect(refA.current).toBeInstanceOf(HTMLDivElement)

    rerender(<Component r={refB} />)
    expect(refB.current).toBeInstanceOf(HTMLDivElement) // FAILS today (null)
    expect(refA.current).toBeNull() // FAILS today (still set)
})

it("invokes a replaced callback ref with the instance", () => {
    const calls: Array<HTMLDivElement | null> = []
    const Component = ({ r }: { r: React.Ref<HTMLDivElement> }) => (
        <motion.div ref={r} />
    )
    const { rerender } = render(<Component r={(el) => calls.push(el)} />)
    rerender(<Component r={(el) => calls.push(el)} />)
    // React contract for swapped callback refs: old(null) then new(instance)
    expect(calls[calls.length - 1]).toBeInstanceOf(HTMLDivElement) // FAILS today
})
```

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="component.test"`
→ exactly the 2 new tests fail with the assertions marked above (the bug),
everything else passes. If they pass out of the box, STOP — the verdict is
wrong, report back.

### Step 2: Implement the fix in `use-motion-ref.ts`

Keep the returned callback and its `[visualElement]` deps untouched. Track the
current instance, and re-hydrate external refs inside the existing
`useInsertionEffect` when the ref identity changes while mounted:

```ts
const externalRefContainer = useRef(externalRef)
const instanceContainer = useRef<Instance | null>(null)

useInsertionEffect(() => {
    const prevRef = externalRefContainer.current
    externalRefContainer.current = externalRef

    if (prevRef === externalRef) return
    const instance = instanceContainer.current
    if (instance === null) return

    // Detach the old ref per React semantics
    if (refCleanup.current) {
        refCleanup.current()
        refCleanup.current = null
    } else if (typeof prevRef === "function") {
        prevRef(null)
    } else if (prevRef) {
        ;(prevRef as React.MutableRefObject<Instance | null>).current = null
    }

    // Attach the new ref
    if (typeof externalRef === "function") {
        const cleanup = externalRef(instance)
        if (typeof cleanup === "function") refCleanup.current = cleanup
    } else if (externalRef) {
        ;(externalRef as React.MutableRefObject<Instance>).current = instance
    }
})
```

In the returned callback, record the instance: set
`instanceContainer.current = instance` at the top (it is `null` on unmount,
which is exactly what we want). Match repo style: optional chaining, no `var`,
arrow callbacks, small output size.

Note: for Radix `asChild` (new composed callback ref every render) this now
performs old(null)/new(instance) per render — identical to what React itself
does for inline callback refs on host elements, and it never touches
`visualElement.mount/unmount`, so exit animations are unaffected. Step 4
proves that.

**Verify**: Step 1's Jest command → all tests pass, including the 2 new ones.

### Step 3: Full unit suite

`npx jest --config packages/framer-motion/jest.config.json --testPathPattern="motion/__tests__"`
→ no new failures (pre-existing known failures: SSR TextEncoder,
use-velocity — ignore those only).

### Step 4: Radix/ref-forwarding Cypress regression gates (React 18 AND 19)

`yarn build` from repo root first (Cypress dev apps consume built packages).
Then per the CLAUDE.md recipe (start Vite directly on a random port, run
specs in the foreground, capture output with `tail -60`):

- `cypress/integration/motion-ref-forwarding.ts`
- `cypress/integration/animate-presence-radix-dialog.ts`

against `dev/react` (React 18) and `dev/react-19`
(`--config-file=cypress.react-19.json`).

**Verify**: both specs pass on both React versions. A failure here means the
fix regressed #3455 — STOP and report rather than tweaking blindly.

### Step 5: Lint, changelog, PR

`yarn lint` → exit 0. Add CHANGELOG.md "Fixed" entry under Unreleased:
"Replaced `ref` props on motion components now hydrate the new ref with the
current element." Commit, push branch, `gh pr create` referencing
`Fixes #2263`.

## Test plan

- New: the 2 Jest tests of Step 1 (object-ref swap incl. old-ref detach;
  callback-ref swap) in `component.test.tsx`, modeled on "accepts createref".
- Existing gates: full `component.test` file; Cypress
  `motion-ref-forwarding` + `animate-presence-radix-dialog` on React 18 + 19.

## Done criteria

- [ ] Both new Jest tests pass; they failed before the fix (right reason)
- [ ] Full framer-motion Jest suite: no new failures
- [ ] 2 Cypress specs pass on React 18 and React 19
- [ ] `yarn lint` exits 0; only in-scope files modified (`git status`)
- [ ] PR opened referencing #2263; `plans/issues/README.md` row updated

## STOP conditions

- Step 1 tests pass without the fix (codebase drifted / verdict wrong).
- Step 4 Cypress fails twice after one reasonable fix attempt (Radix
  regression — needs maintainer input on trade-off).
- The fix appears to require touching `use-visual-element.ts` or
  `VisualElement` — out of scope, report instead.

## Maintenance notes

- This file now encodes React's swap-semantics manually; if React changes
  callback-ref cleanup semantics again (as in 19), revisit the
  detach branch ordering (cleanup function takes precedence over `ref(null)`).
- Reviewer should scrutinize: no `visualElement.unmount()` on ref swaps, and
  `useInsertionEffect` body stays cheap (it runs every render for inline
  callback refs).
