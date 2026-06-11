# Plan 011: Stop `useCombineMotionValues` re-executing transformers and resubscribing on every React render

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/value/use-combine-values.ts packages/framer-motion/src/value/use-computed.ts packages/framer-motion/src/value/use-transform.ts packages/framer-motion/src/value/__tests__/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`useCombineMotionValues` is the engine behind the public hooks `useTransform`, `useMotionTemplate`, and `useComputed` (the function form of `useTransform`). Today, **every React render** of a component that uses these hooks: (a) executes the user's transformer function twice (three times for the function form), and (b) tears down and re-creates the `change` subscription on every input `MotionValue` — and each teardown of a `change` subscription allocates and schedules a `frame.read` callback inside `MotionValue.on` (the auto-stop check). Components with several `useTransform`s under a frequently re-rendering parent (a common pattern: scroll-linked or pointer-linked UI inside stateful React trees) pay this cost on every render for no behavioral benefit. Transformers can be expensive (color/shadow interpolation). This plan makes re-renders execute the transformer exactly once and resubscribe only when the set of input values actually changes — with no observable behavior change.

## Current state

Relevant files:

- `packages/framer-motion/src/value/use-combine-values.ts` — the hook being changed (45 lines, full file shown below).
- `packages/framer-motion/src/value/use-computed.ts` — function-form wrapper; runs an extra dependency-collection pass of the transformer every render.
- `packages/framer-motion/src/value/use-transform.ts` — public hook; routes to `useComputed` (function form) or `useListTransform` → `useCombineMotionValues` (range form). **Not modified by this plan**, but read it to understand callers.
- `packages/framer-motion/src/value/use-motion-template.ts` — caller; passes a fresh filtered array every render. Not modified.
- `packages/framer-motion/src/utils/use-constant.ts` — repo's lazy-init-once hook. Used by the fix.
- `packages/motion-dom/src/value/index.ts:247-274` — `MotionValue.on("change")`: the returned unsubscribe schedules a `frame.read` callback that stops animations if no change listeners remain. This is why per-render unsubscribe/resubscribe churn allocates frame callbacks.

`use-combine-values.ts` as it exists today (entire file):

```ts
"use client"

import { cancelFrame, frame, MotionValue } from "motion-dom"
import { useIsomorphicLayoutEffect } from "../utils/use-isomorphic-effect"
import { useMotionValue } from "./use-motion-value"

export function useCombineMotionValues<R>(
    values: MotionValue[],
    combineValues: () => R
) {
    /**
     * Initialise the returned motion value. This remains the same between renders.
     */
    const value = useMotionValue(combineValues())

    /**
     * Create a function that will update the template motion value with the latest values.
     * This is pre-bound so whenever a motion value updates it can schedule its
     * execution in Framesync. If it's already been scheduled it won't be fired twice
     * in a single frame.
     */
    const updateValue = () => value.set(combineValues())

    /**
     * Synchronously update the motion value with the latest values during the render.
     * This ensures that within a React render, the styles applied to the DOM are up-to-date.
     */
    updateValue()

    /**
     * Subscribe to all motion values found within the template. Whenever any of them change,
     * schedule an update.
     */
    useIsomorphicLayoutEffect(() => {
        const scheduleUpdate = () => frame.preRender(updateValue, false, true)
        const subscriptions = values.map((v) => v.on("change", scheduleUpdate))

        return () => {
            subscriptions.forEach((unsubscribe) => unsubscribe())
            cancelFrame(updateValue)
        }
    })

    return value
}
```

The three per-render wastes:

1. `useMotionValue(combineValues())` — the argument is evaluated every render but `useMotionValue` (via `useConstant`) discards it after the first. One wasted transformer execution per re-render.
2. `useIsomorphicLayoutEffect` has **no dependency array** — it runs on every render, unsubscribing and resubscribing every input value. Each `change` unsubscribe allocates and schedules a `frame.read` closure (`motion-dom/src/value/index.ts:258-270`).
3. `use-computed.ts` runs `compute()` once per render purely to collect dependencies:

```ts
export function useComputed<O>(compute: () => O): MotionValue<O> {
    collectMotionValues.current = []

    compute()

    const value = useCombineMotionValues(collectMotionValues.current, compute)

    collectMotionValues.current = undefined

    return value
}
```

Dependency collection only needs to happen once: the transformer contract (documented on `transformValue` in `motion-dom/src/value/transform-value.ts:23`) is "this function must be pure with no side-effects or conditional statements", so its `MotionValue` dependencies are static. `transformValue` itself already collects only once, at creation.

**Why there is no deps array today (critical to preserve):** the `combineValues` closure is recreated every render and may capture fresh props (e.g. `useTransform(x, [0, b], [0, d])` where `b`/`d` are props). If the subscription captured the first render's closure and never resubscribed, later input changes would run a stale transformer. The existing test `"updates when values change"` at `packages/framer-motion/src/value/__tests__/use-transform.test.tsx:103-133` covers exactly this: it rerenders with new range props, then calls `x.set(40)` and asserts the output reflects the **latest** range. The fix below preserves this via a latest-ref, not by capturing closures in subscriptions.

Repo conventions that apply (from `CLAUDE.md`): prioritise small output size; prefer optional chaining; named exports; arrow callbacks; `interface` for types. The fix must not grow the bundle meaningfully — it should be roughly size-neutral.

## Commands you will need

Run from the repo root.

| Purpose | Command | Expected on success |
|---|---|---|
| Install (only if `node_modules` missing) | `yarn install` | exit 0 (run once, foreground) |
| Build all packages | `yarn build` | exit 0 |
| Targeted tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-transform\|use-motion-template\|use-combine"` | all pass |
| Full framer-motion client tests | `cd packages/framer-motion && yarn test-client` | all pass (pre-existing failures: SSR `TextEncoder` errors and `use-velocity` — ignore those two, they fail on `main` too) |
| Lint | `yarn lint` | exit 0 |

Jest for framer-motion runs against source (not dist), so you do not need to rebuild between test iterations of `packages/framer-motion/src` changes.

## Scope

**In scope** (the only files you should modify):

- `packages/framer-motion/src/value/use-combine-values.ts`
- `packages/framer-motion/src/value/use-computed.ts`
- `packages/framer-motion/src/value/__tests__/use-transform.test.tsx` (add tests)

**Out of scope** (do NOT touch, even though they look related):

- `packages/motion-dom/src/value/index.ts` (`MotionValue`, including the auto-stop `frame.read` in `on`) — public semantics, separately owned; plan 012 covers the architectural follow-up.
- `packages/motion-dom/src/value/subscribe-value.ts` / `transform-value.ts` — the non-React equivalents create their graph once and don't have this problem.
- `packages/framer-motion/src/value/use-transform.ts`, `use-motion-template.ts`, `use-motion-value.ts` — callers; no changes needed.
- `packages/framer-motion/src/utils/use-constant.ts` — use it, don't change it.
- Any public API signature. No new exports.

## Git workflow

- Branch: `improve/011-use-combine-values-render-churn` off `main`.
- Commit per step; message style matches repo (`git log --oneline`): short imperative sentence, no conventional-commit prefixes.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a failing/charcterizing execution-count test

In `packages/framer-motion/src/value/__tests__/use-transform.test.tsx`, add a test that counts transformer executions across re-renders. Model the structure on the existing `"updates when values change"` test (`use-transform.test.tsx:103`) — it shows the `render`/`rerender` pattern and the `motion.div style` wiring used in this file.

```tsx
test("executes the transformer once per re-render", () => {
    const x = motionValue(0)
    let executionCount = 0
    const Component = () => {
        const opacity = useTransform(x, (v) => {
            executionCount++
            return v
        })
        return <motion.div style={{ opacity }} />
    }

    const { rerender } = render(<Component />)
    const countAfterMount = executionCount
    rerender(<Component />)
    rerender(<Component />)

    // One execution per re-render (the sync update), nothing more
    expect(executionCount - countAfterMount).toBe(2)
})
```

Note: with the current code this asserts the bug — the function form executes 3× per re-render (collect pass + `useMotionValue` argument + sync update), so `executionCount - countAfterMount` is 6.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-transform"` → the new test FAILS with received `6`, expected `2`. All other tests in the file still pass. If the new test passes before any fix, STOP — the codebase has drifted.

### Step 2: Rewrite `useCombineMotionValues`

Replace the body of `packages/framer-motion/src/value/use-combine-values.ts` with the following shape (keep the existing doc comments where they still apply):

```tsx
"use client"

import { cancelFrame, frame, MotionValue } from "motion-dom"
import { useRef } from "react"
import { useConstant } from "../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../utils/use-isomorphic-effect"
import { useMotionValue } from "./use-motion-value"

export function useCombineMotionValues<R>(
    values: MotionValue[],
    combineValues: () => R
) {
    const value = useMotionValue(useConstant(combineValues))

    /**
     * combineValues is recreated every render and may capture fresh props.
     * Subscriptions are long-lived, so they read the latest closure via a ref.
     */
    const combineRef = useRef(combineValues)
    combineRef.current = combineValues

    const updateValue = useConstant(() => () => value.set(combineRef.current()))
    const scheduleUpdate = useConstant(
        () => () => frame.preRender(updateValue, false, true)
    )

    /**
     * Synchronously update the motion value with the latest values during the render.
     * This ensures that within a React render, the styles applied to the DOM are up-to-date.
     */
    updateValue()

    const subscriptions = useConstant<{
        values: MotionValue[]
        cancel: VoidFunction[]
    }>(() => ({ values: [], cancel: [] }))

    const unsubscribe = () => {
        for (const cancel of subscriptions.cancel) cancel()
    }

    useIsomorphicLayoutEffect(() => {
        /**
         * Only resubscribe if the set of input values has actually changed.
         * Callers pass a fresh array every render, so compare contents.
         */
        if (
            values.length !== subscriptions.values.length ||
            values.some((v, i) => v !== subscriptions.values[i])
        ) {
            unsubscribe()
            subscriptions.cancel = values.map((v) =>
                v.on("change", scheduleUpdate)
            )
            subscriptions.values = values
        }
    })

    useIsomorphicLayoutEffect(
        () => () => {
            unsubscribe()
            cancelFrame(updateValue)
        },
        []
    )

    return value
}
```

Load-bearing details — do not "simplify" these away:

- `useMotionValue(useConstant(combineValues))`: `useConstant` executes `combineValues` only on the first render; keep routing through `useMotionValue` (not a bare `motionValue`) because it handles `isStatic` mode (Framer canvas re-renders).
- `updateValue` and `scheduleUpdate` must have **stable identities** (`useConstant`) so the frame loop's `Set` dedupes them across renders and `cancelFrame(updateValue)` on unmount cancels the real pending callback.
- The content comparison (`length` + `some`) — not React deps — handles `values` arrays whose length could differ between renders without React's "deps array size changed" dev warning.
- Subscribing inside the effect (not during render) preserves SSR safety: `useIsomorphicLayoutEffect` is a no-op on the server, exactly as today.
- The unmount cleanup is a **separate** effect with `[]` deps; the resubscribe effect must NOT return a cleanup (otherwise it would tear down on every render again).

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-transform|use-motion-template"` → the Step 1 test now expects `4` and gets… still fails (the `useComputed` collect pass still runs — `2` per re-render: collect + sync update). All **pre-existing** tests pass, especially `"updates when values change"` (the stale-closure gate) and `"frame scheduling"`. If any pre-existing test fails, fix before proceeding.

### Step 3: Collect dependencies once in `useComputed`

In `packages/framer-motion/src/value/use-computed.ts`, wrap the collection pass in `useConstant` so it runs only on first render, matching `transformValue`'s create-time collection (`motion-dom/src/value/transform-value.ts:29-37`):

```tsx
"use client"

import { collectMotionValues, type MotionValue } from "motion-dom"
import { useConstant } from "../utils/use-constant"
import { useCombineMotionValues } from "./use-combine-values"

export function useComputed<O>(compute: () => O): MotionValue<O> {
    /**
     * Collect dependencies once on first render. The compute function is
     * documented as pure with no conditionals, so its dependencies are static.
     */
    const values = useConstant(() => {
        collectMotionValues.current = []
        compute()
        const collected = collectMotionValues.current
        collectMotionValues.current = undefined
        return collected
    })

    return useCombineMotionValues(values, compute)
}
```

Note the original closed the collection session *after* calling `useCombineMotionValues`; since `useCombineMotionValues` no longer calls `combineValues()` as a hook argument during the collection window, closing it inside the `useConstant` initializer is correct and keeps the session as narrow as possible.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-transform|use-motion-template"` → ALL tests pass, including Step 1's count test (`2` executions across 2 re-renders) and the function-form tests at the top of the file (`"as function"`, `"as function with multiple values"`).

### Step 4: Add a resubscription test

In the same test file, add a test proving that swapping the input `MotionValue` between renders rewires the subscription (the case the content-comparison must catch):

```tsx
test("resubscribes when input values change identity", async () => {
    const a = motionValue(1)
    const b = motionValue(2)
    let output = motionValue(0)
    const Component = ({ input }: { input: MotionValue<number> }) => {
        output = useTransform(input, (v) => v * 10)
        return <motion.div style={{ opacity: output }} />
    }

    const { rerender } = render(<Component input={a} />)
    rerender(<Component input={b} />)

    b.set(5)
    await nextFrame()
    expect(output.get()).toBe(50)

    // The old input must no longer drive the output
    a.set(100)
    await nextFrame()
    expect(output.get()).toBe(50)
})
```

Use the `nextFrame` helper already defined/imported in this test file (see top of `use-transform.test.tsx`; if it uses `nextMicrotask`, follow whichever async helper the neighbouring tests use — derived values update on `frame.preRender`, so `nextFrame` is the safe choice).

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-transform"` → all pass.

### Step 5: Full verification

**Verify**:
1. `cd packages/framer-motion && yarn test-client` → no new failures vs `main` (known pre-existing failures: SSR `TextEncoder`, `use-velocity`).
2. `yarn lint` from repo root → exit 0.
3. `yarn build` from repo root → exit 0.

## Test plan

New tests (all in `packages/framer-motion/src/value/__tests__/use-transform.test.tsx`, modeled on the existing `"updates when values change"` test):

1. Transformer execution count per re-render (Step 1) — the regression gate for the waste this plan removes.
2. Input-value identity swap resubscribes; stale input disconnected (Step 4).

Existing tests acting as behavior gates (must stay green, do not modify them):

- `"updates when values change"` (`use-transform.test.tsx:103`) — fresh transformer closures (changed props) are used by post-rerender value changes. This is the test that breaks if the latest-ref is wired wrong.
- `"frame scheduling"` (`use-transform.test.tsx:147`) — update batching on `frame.preRender`.
- All of `use-motion-template.test.tsx` — second consumer of the hook.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-transform|use-motion-template"` exits 0; the two new tests exist and pass.
- [ ] `cd packages/framer-motion && yarn test-client` shows no new failures vs `main`.
- [ ] `yarn lint` exits 0.
- [ ] `yarn build` exits 0.
- [ ] `git status` shows modifications only to the three in-scope files.
- [ ] `plans/README.md` status row for 011 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `use-combine-values.ts` or `use-computed.ts` changed since `42bfbe3ed`, or the live code doesn't match the excerpts above (the effects/VisualElement unification branch may have landed and reshaped this area).
- Step 1's count test does not fail with exactly `6` before the fix (your understanding of the execution paths is then wrong — re-derive before changing code).
- `"updates when values change"` fails after Step 2 and one fix attempt — the latest-ref wiring is the highest-risk part; do not weaken or modify that test to pass.
- Fixing a failure appears to require changing `MotionValue` in motion-dom (out of scope; report instead).
- Any `use-scroll` / `use-spring` test starts failing (these consume `useTransform` outputs indirectly; a failure means the subscription lifecycle change has a side effect this plan didn't predict).

## Maintenance notes

- **Reviewer scrutiny**: the latest-ref pattern (`combineRef.current = combineValues` during render) is the standard React idiom but is technically a render-phase mutation; this hook already mutates external state during render (`updateValue()`), a documented, intentional trade-off ("styles applied to the DOM are up-to-date" within a render). Concurrent-mode tearing characteristics are unchanged by this plan.
- **Interaction with plan 012**: the design spike on a unified mark-dirty/pull derivation graph would eventually subsume this hook's subscription management. This fix is worth landing regardless — it's the React adapter layer, not the graph itself.
- **`values.length` changes between renders** (only possible by violating the documented "no conditionals in transformers" contract): old behavior silently resubscribed every render and so masked it; new behavior also resubscribes (the length check catches it). No regression, but a conditional-deps transformer remains officially unsupported.
- **Deferred**: the per-unsubscribe `frame.read` auto-stop allocation inside `MotionValue.on` (`motion-dom/src/value/index.ts:258-270`) still exists; after this plan it simply fires far less often. Making auto-stop allocation-free belongs to plan 012's territory.
