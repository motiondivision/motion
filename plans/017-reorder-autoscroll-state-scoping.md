# Plan 017: Scope Reorder auto-scroll state per group instead of module singletons

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/components/Reorder/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (merge before plan 018, which rewrites `Item.tsx`'s drag handlers around these call sites)
- **Category**: tech-debt
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

The Reorder auto-scroll utility tracks "which group is currently dragging" in a module-level variable (`currentGroupElement`). With two concurrent drags — multi-touch, or two Reorder groups on one page — the second drag overwrites the first's tracking, and the first `pointerup`'s `resetAutoScrollState()` clears the *other* drag's scroll state mid-drag (its edge activation and scroll limit are dropped, so its auto-scroll de-arms until the pointer re-enters a threshold with matching velocity). Scoping the state per group element removes the cross-talk and makes cleanup deterministic, without changing single-drag behavior.

## Current state

- `packages/framer-motion/src/components/Reorder/utils/auto-scroll.ts` — the whole utility. Only importer is `Reorder/Item.tsx` (verified at planning time; re-verify with `grep -rln "auto-scroll" packages/framer-motion/src/ | grep -v __tests__`).

The module-level state and reset (lines 6–37):

```ts
// auto-scroll.ts:6-14
// Track initial scroll limits per scrollable element (Bug 1 fix)
const initialScrollLimits = new WeakMap<HTMLElement, number>()

// Track auto-scroll active state per edge: "start" (top/left) or "end" (bottom/right)
type ActiveEdge = "start" | "end" | null
const activeScrollEdge = new WeakMap<HTMLElement, ActiveEdge>()

// Track which group element is currently dragging to clear state on end
let currentGroupElement: Element | null = null
```

```ts
// auto-scroll.ts:16-37
export function resetAutoScrollState(): void {
    if (currentGroupElement) {
        const scrollableAncestor = findScrollableAncestor(currentGroupElement, "y")
        if (scrollableAncestor) {
            activeScrollEdge.delete(scrollableAncestor)
            initialScrollLimits.delete(scrollableAncestor)
        }
        // Also try x axis
        const scrollableAncestorX = findScrollableAncestor(currentGroupElement, "x")
        if (scrollableAncestorX && scrollableAncestorX !== scrollableAncestor) {
            activeScrollEdge.delete(scrollableAncestorX)
            initialScrollLimits.delete(scrollableAncestorX)
        }
        currentGroupElement = null
    }
}
```

`autoScrollIfNeeded(groupElement, pointerPosition, axis, velocity)` (lines 88–171) sets `currentGroupElement = groupElement` on every call (line 97), then arms `activeScrollEdge`/`initialScrollLimits` keyed by the scrollable ancestor when the pointer enters a threshold zone with velocity toward the edge.

- `packages/framer-motion/src/components/Reorder/Item.tsx` — the call sites:

```ts
// Item.tsx:112-117 (inside onDrag)
autoScrollIfNeeded(
    groupRef.current,
    pointerPoint[axis],
    axis,
    velocity[axis]
)
```

```ts
// Item.tsx:121-124 (inside onDragEnd)
onDragEnd={(event, gesturePoint) => {
    resetAutoScrollState()
    onDragEnd && onDragEnd(event, gesturePoint)
}}
```

- Existing E2E regression gates: `packages/framer-motion/cypress/integration/reorder-auto-scroll.ts` with test pages `dev/react/src/tests/reorder-auto-scroll.tsx`, `reorder-auto-scroll-page.tsx`, `reorder-auto-scroll-container.tsx`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build (once) | `yarn build` from repo root | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="auto-scroll"` from repo root | all pass |
| All Reorder unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"` | all pass |
| Lint | `yarn lint` from repo root | exit 0 |
| Cypress (React 18 + 19) | see "Cypress procedure" below | both runs pass |

### Cypress procedure (from repo CLAUDE.md — run in foreground, never background)

```bash
# React 18
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/reorder-auto-scroll.ts
kill $DEV_PID

# React 19
PORT=$((10000 + RANDOM % 50000))
cd ../../dev/react-19 && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --config-file=cypress.react-19.json --config baseUrl=http://localhost:$PORT --headed --spec cypress/integration/reorder-auto-scroll.ts
kill $DEV_PID
```

Capture output with `tail -60` on the first run; do not re-run to fish for errors.

## Scope

**In scope** (the only files you should modify):
- `packages/framer-motion/src/components/Reorder/utils/auto-scroll.ts`
- `packages/framer-motion/src/components/Reorder/Item.tsx` (only the `resetAutoScrollState` call — pass the group element)
- `packages/framer-motion/src/components/Reorder/utils/__tests__/auto-scroll.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- The scroll-amount math, thresholds, velocity arming, or scroll-limit capping in `auto-scroll.ts` — behavior for a single drag must be byte-for-byte equivalent in effect.
- `Group.tsx`, `check-reorder.ts`, `types.ts` — other plans.
- Sharing of `activeScrollEdge` between two groups that scroll the *same* container — acceptable known limitation, document it (Maintenance notes), don't engineer around it.

## Git workflow

- Branch: `improve/017-reorder-autoscroll-scoping` off `main`.
- Commit style: short imperative sentence (e.g. `Scope Reorder auto-scroll state per group`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the failing unit test

Create `packages/framer-motion/src/components/Reorder/utils/__tests__/auto-scroll.test.ts`. JSDOM has no real layout, so mock per element:

- `getComputedStyle` for the scroll containers → `overflowY: "auto"` (use `jest.spyOn(window, "getComputedStyle")` returning a minimal object for the two container elements, real impl otherwise).
- `getBoundingClientRect` on each container → e.g. `{ top: 0, bottom: 300, left: 0, right: 200 }` (cast partial objects with `as DOMRect`).
- `Object.defineProperty` for `scrollHeight` (e.g. 1000) and `clientHeight` (300) on the containers; `scrollTop` works natively in JSDOM as a plain property.
- `window.innerHeight`/`innerWidth` as needed (default JSDOM 768/1024 is fine if rects stay inside).

Test scenario ("reset of one group must not clear another group's state"):

1. Build two DOM trees: `containerA > groupA` and `containerB > groupB`, both containers scrollable per the mocks.
2. Arm group B: call `autoScrollIfNeeded(groupB, 290, "y", 5)` (pointer within 50px of `bottom: 300`, positive velocity) → `containerB.scrollTop` increases. Record it.
3. Arm group A the same way, then call `resetAutoScrollState(groupA)` (new signature — see Step 2).
4. Call `autoScrollIfNeeded(groupB, 290, "y", 0)` — **zero velocity**. Once an edge is armed, scrolling continues regardless of velocity (the velocity check only gates *activation*, `auto-scroll.ts:128-133`). Assert `containerB.scrollTop` increased again.

Against current code this fails at step 3/4 in signature first — so write the test against the **new** signature and stub the old behavior check separately: also add a sibling test asserting single-group behavior (arm, scroll, reset, then zero-velocity call does NOT scroll — state was cleared). To satisfy the "fails for the right reason" rule: before implementing, temporarily adapt the cross-talk test to the current no-arg `resetAutoScrollState()` and confirm step 4 fails (B's state was wiped by A's reset — zero-velocity call does not scroll). Note the observed failure in your report, then switch the test to the new signature.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="auto-scroll"` → cross-talk test fails against current behavior (as described above).

### Step 2: Scope the state per group

In `auto-scroll.ts`:

1. Delete `let currentGroupElement: Element | null = null`.
2. Add: `const touchedScrollContainers = new WeakMap<Element, Set<HTMLElement>>()` — maps a group element to the scroll containers it armed during the current drag.
3. In `autoScrollIfNeeded`, remove `currentGroupElement = groupElement` (line 97). Where an edge is *activated* (the `activeScrollEdge.set(scrollableAncestor, edge)` block, lines 136–144), also record the container:
   ```ts
   let touched = touchedScrollContainers.get(groupElement)
   if (!touched) {
       touched = new Set()
       touchedScrollContainers.set(groupElement, touched)
   }
   touched.add(scrollableAncestor)
   ```
4. Change the reset signature to `export function resetAutoScrollState(groupElement: Element | null): void` and reimplement: iterate `touchedScrollContainers.get(groupElement)`, delete each container's `activeScrollEdge` and `initialScrollLimits` entries, then `touchedScrollContainers.delete(groupElement)`. No more `findScrollableAncestor` walks at reset time.

5. In `Item.tsx` `onDragEnd`, change the call to `resetAutoScrollState(groupRef.current)`.

Keep the file's existing comment style; prioritise small output size (this change should be roughly size-neutral or smaller — the double `findScrollableAncestor` walk in the old reset is removed).

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="auto-scroll"` → all tests pass, including the cross-talk test.

### Step 3: Regression verification

**Verify**:
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="Reorder"` → all pass.
- `yarn lint` → exit 0.
- Cypress `reorder-auto-scroll.ts` against React 18 AND React 19 (procedure above) → both pass. Both versions are mandatory before any PR (CI runs both).

## Test plan

- New `utils/__tests__/auto-scroll.test.ts`: (a) single-group arm → scroll → reset → de-armed (zero-velocity call doesn't scroll); (b) two groups: resetting group A leaves group B armed (zero-velocity call still scrolls). Model the file structure on `Reorder/__tests__/index.test.tsx` (plain Jest, no React needed here).
- Existing Cypress `reorder-auto-scroll.ts` is the behavioral regression gate for single-drag auto-scroll across container/page scroll scenarios.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="(auto-scroll|Reorder)"` exits 0; both new tests present
- [ ] `grep -n "currentGroupElement" packages/framer-motion/src/components/Reorder/utils/auto-scroll.ts` returns no matches
- [ ] `grep -n "resetAutoScrollState(groupRef.current)" packages/framer-motion/src/components/Reorder/Item.tsx` matches
- [ ] Cypress `reorder-auto-scroll.ts` passes on React 18 and React 19
- [ ] `yarn lint` exits 0; `git status` clean outside in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `auto-scroll.ts` no longer matches the excerpts (drift — it had heavy recent churn: 5 commits in the last release cycle).
- The JSDOM mocks can't make `autoScrollIfNeeded` scroll at all after 2–3 attempts (per repo CLAUDE.md: don't burn time forcing environment-specific failures — report what blocked the mock).
- The Cypress auto-scroll spec fails on either React version and the cause isn't an obvious test-side issue.
- You find another importer of `auto-scroll.ts` besides `Item.tsx`.

## Maintenance notes

- Known accepted limitation: two groups sharing one scroll container still share that container's `activeScrollEdge`/`initialScrollLimits` slot (WeakMaps are keyed by container). Fixing that would require keying by (group, container); not worth it until someone reports it.
- Plan 018 (2D reorder) will call `autoScrollIfNeeded` for both axes and `resetAutoScrollState(groupRef.current)` — land this plan first so 018 builds on the new signature.
- Reviewer should scrutinize: the arming-time `touched.add` placement (must be inside the activation branch so containers that never armed don't accumulate), and that reset no longer walks the DOM.
