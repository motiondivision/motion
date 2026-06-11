# Plan issue-3173: Decide on, then design, `AnimateSuspense` (animated transitions between Suspense fallback and content)

> **Executor instructions**: This plan is decision-gated. Do NOT write feature
> code until the maintainer records a decision in the `plans/issues/README.md`
> row for issue-3173. Run the drift check first.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/3173 --jq .state`
> → expect `"open"`.

## Status

- **Priority**: P2 (feature; aligned with React 19/streaming direction)
- **Effort**: L
- **Risk**: MED-HIGH — new public component touching presence + Suspense semantics
- **Depends on**: maintainer API decision (gate below)
- **Category**: feature — decision-gated design
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/3173

## Why this matters

Filed 2025-04-27, revisiting #1193 (closed, 14 comments). React 19/Next App
Router make Suspense/streaming central, but Motion has no first-class way to
animate the swap between a Suspense `fallback` and its resolved children —
React removes the fallback synchronously, so `AnimatePresence` alone can't
run its exit animation. mattgperry already signalled openness in #1193:
"`<AnimateSuspense fallback={fallback}>{children}</AnimateSuspense>`" (same
signature as `Suspense`). The reporter has a working prototype and offered to
contribute. The community workaround (lpic10's sandbox `hy3yvq` — CodeSandbox
is Cloudflare-gated, could not be fetched at planning time) keeps the fallback
mounted outside the boundary and toggles it from inside.

## Decision gate (maintainer)

Record ONE in the README row:

- **APPROVED-BUILD** — build `AnimateSuspense` in this repo (design below).
- **APPROVED-DOCS** — decline the component; instead publish the recipe as a
  motion.dev guide (close the issue pointing at the guide once it exists).
- **REJECTED** — close, explaining the component is deliberately userland.

Questions the decision should settle (list them in the row or a comment):
1. Package home: `framer-motion` React layer
   (`packages/framer-motion/src/components/AnimateSuspense/`) — sibling of
   `AnimatePresence` — and re-export via `motion/react`?
2. Minimum React version: requires reliable `useDeferredValue`/transition
   semantics — React 18+, with React 19 streaming as the headline use case.
3. Does it expose `mode` (`"wait"` | `"sync"` | `"popLayout"`) like
   `AnimatePresence`, or start with `"wait"` only (recommended: `"wait"` only,
   smallest API surface)?
4. SSR/streaming semantics: when content streams in before hydration, must the
   fallback exit animation be skipped (no JS yet)? (Recommended: yes — treat
   as `initial={false}`.)

## Design sketch (for APPROVED-BUILD)

Signature mirrors `Suspense`:

```tsx
<AnimateSuspense fallback={<Skeleton />}>{children}</AnimateSuspense>
```

Mechanism (the only robust pattern without `<Activity>`/unstable APIs):

1. Internally render a real `<Suspense>` whose children are the user's
   children **plus a zero-size "resolved" probe** — a component that mounts
   only when the boundary's children have resolved and reports via state
   (`useEffect` on mount/unmount → `setResolved(true/false)`).
2. Render the user's `fallback` OUTSIDE the `Suspense`, wrapped in
   `<AnimatePresence>`, keyed and conditionally rendered on `!resolved` —
   so its exit animation can run after content resolves.
3. The real `Suspense` `fallback` prop is `null` (or the probe's inverse), so
   React never hard-swaps visible DOM; visual swap is fully owned by
   AnimatePresence. Content enters via a `motion` wrapper (or accepts user
   `motion` children with `initial`/`animate`).
4. Re-suspension (React 18 transitions / 19 streaming): probe unmounts →
   `resolved=false` → fallback re-enters. Must verify behaviour when
   `startTransition` keeps stale content visible (probe should NOT unmount
   during transitions — that's correct UX).
5. Reuse `PresenceContext`/`AnimatePresence` internals — no new presence
   machinery. Files: `packages/framer-motion/src/components/AnimateSuspense/index.tsx`
   (+ `types.ts`), export from `packages/framer-motion/src/index.ts` and the
   `motion` package's `react` entry (`packages/motion/src/react.ts` — verify
   exact entry file at implementation time).

Known risks to spike before committing to the API:
- Probe-based detection runs effects an extra commit after resolve (1-frame
  fallback overlap) — acceptable for `mode="wait"`, problematic for `"sync"`.
- React 19 `use()`/streaming hydration: fallback present in server HTML;
  ensure no hydration mismatch when client immediately animates it out.
- Nested Suspense boundaries: the probe must not swallow suspension of
  siblings.

## Steps (after APPROVED-BUILD)

### Step 1: Spike + dev fixtures
Build the probe pattern in `dev/react/src/tests/animate-suspense.tsx` using
`React.lazy` with a controllable delay; verify fallback exit + content enter
in the browser. Per CLAUDE.md: Suspense/React.lazy behaviour MUST be tested
with Cypress, not JSDOM.

### Step 2: Component + types
Implement `AnimateSuspense` as designed; no default exports; `interface` for
props; keep bundle impact minimal (compose `AnimatePresence`, don't fork it).

### Step 3: Tests
- Cypress: `packages/framer-motion/cypress/integration/animate-suspense.ts`
  — fallback animates out (opacity mid-exit check via `.then()`, long linear
  duration), content animates in; re-suspension cycle. Run on React 18 AND 19
  per the CLAUDE.md recipe.
- Jest: SSR render test in `packages/framer-motion/src/components/__tests__/`
  (renders fallback markup without crashing; `initial={false}` semantics).

### Step 4: Docs + changelog + PR
CHANGELOG.md "Added" entry; PR references #3173 and #1193; invite the
reporter's review since they offered a prototype.

## Done criteria

- [ ] Maintainer decision recorded in the README row
- [ ] (BUILD) Cypress suite passes on React 18 + 19; Jest SSR test passes;
      `yarn build` + `yarn lint` exit 0
- [ ] (DOCS/REJECTED) Issue commented + closed per decision, only after the
      row is APPROVED for that action

## STOP conditions

- No decision in the README row → do nothing.
- Spike shows the probe pattern cannot avoid visible double-rendering of
  content (e.g. under React 19 streaming) → report findings with the fixture,
  do not ship a flaky component.
