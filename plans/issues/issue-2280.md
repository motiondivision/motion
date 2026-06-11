# Plan issue-2280: Fix dropped same-frame updates in diamond-shaped MotionValue chains (useTransform/transformValue)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update the status row for this plan in
> `plans/issues/README.md` (NOT `plans/README.md`).
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2280 --jq .state` → expect `"open"`. If closed, mark this plan DONE/REJECTED accordingly and stop.
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/frameloop/render-step.ts packages/motion-dom/src/value/subscribe-value.ts packages/framer-motion/src/value/use-combine-values.ts`
>    If any of these changed, compare the "Current state" excerpts below against
>    the live code before proceeding; on a mismatch, STOP and report.

## Status

- **Classification**: FIX
- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the core frame loop; all schedulers share it)
- **Depends on**: none (see "Relationship to plans 011/012" for coordination)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2280

## Why this matters

A `useTransform` (or vanilla `transformValue`) that depends on both a value
and a *derived descendant* of that value (a diamond: `a → aHalf → aQuarter`,
`result = f(a, aQuarter)`) computes with a stale input and then **never
corrects itself** — the value is permanently wrong, not one-frame-late. The
issue (open since 2023, plus a 2024 `useScroll` report in the comments) is a
real correctness bug, confirmed reproducible at planning time on `main`
`42bfbe3ed` with this command (run from repo root; requires a prior
`yarn build`):

```bash
node -e "
global.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
const { motionValue, transformValue } = require('./packages/motion-dom/dist/cjs/index.js');
const a = motionValue(0);
const aHalf = transformValue(() => a.get() / 2);
const aQuarter = transformValue(() => aHalf.get() / 2);
const result = transformValue(() => a.get() + aQuarter.get());
a.set(100);
setTimeout(() => console.log(result.get(), aQuarter.get()), 200);"
# prints: 100 25   — result should be 125
```

## Root cause (verified)

Derived-value updates are scheduled on `frame.preRender` with the `immediate`
flag, both in vanilla and React layers:

`packages/motion-dom/src/value/subscribe-value.ts:9-12`:
```ts
const update = () => outputValue.set(getLatest())
const scheduleUpdate = () => frame.preRender(update, false, true)
```

`packages/framer-motion/src/value/use-combine-values.ts:34-36`:
```ts
useIsomorphicLayoutEffect(() => {
    const scheduleUpdate = () => frame.preRender(updateValue, false, true)
```

`immediate` scheduling during step processing adds the callback to the
**currently iterating** Set — `packages/motion-dom/src/frameloop/render-step.ts:51-60`:

```ts
schedule: (callback, keepAlive = false, immediate = false) => {
    const addToCurrentFrame = immediate && isProcessing
    const queue = addToCurrentFrame ? thisFrame : nextFrame
    if (keepAlive) toKeepAlive.add(callback)
    queue.add(callback)
    return callback
},
```

`Set.prototype.forEach` visits members *added* during iteration — but a member
that **already ran and is still in the set** is not re-visited, and
`queue.add()` of an existing member is a no-op. Executed callbacks are never
removed from `thisFrame` until `thisFrame.clear()` at the end of `process()`
(`render-step.ts:94-106`). Trace for the diamond after `a.set(100)`:

1. `a`'s change fires → `update_aHalf` and `update_result` queued for next frame's preRender (insertion order matters).
2. preRender processes: `update_aHalf` runs → `aHalf.set(50)` → `update_aQuarter` scheduled immediate → appended to `thisFrame`, will be visited. ✓
3. `update_result` runs → reads `a=100`, `aQuarter=0` (stale) → result = 100.
4. `update_aQuarter` runs → `aQuarter.set(25)` → its change handler schedules `update_result` immediate → `thisFrame.add(update_result)` is a **no-op** (already a member, already visited).
5. `thisFrame.clear()` discards it. Nothing remains scheduled → `result` is stuck at 100 forever.

The fix: in `triggerCallback` (`render-step.ts:37-45`), delete the callback
from `thisFrame` *before* executing it. Per the Set spec, a member deleted and
re-added during `forEach` **is** visited again — so step 4's re-schedule
re-enters the pass and `update_result` re-runs with `aQuarter=25` in the same
frame. Verified at planning time with a Node Set-semantics check
(delete-before-execute → execution order `b, a, b`; without → `b, a`).

`MotionValue.updateAndNotify` (`packages/motion-dom/src/value/index.ts:366`)
only notifies when `this.current !== this.prev`, so converging value graphs
terminate — re-running a callback whose output didn't change schedules nothing.

## Commands you will need

| Purpose | Command (repo root) | Expected on success |
|---|---|---|
| Install (only if needed) | `yarn install` (once, foreground) | exit 0 |
| Build | `yarn build` | exit 0 |
| motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop\|transform-value"` | pass |
| framer-motion tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-transform"` | pass |
| Full client suites | `npx jest --config packages/motion-dom/jest.config.json` and `cd packages/framer-motion && yarn test-client` | no new failures vs main (known pre-existing: SSR `TextEncoder`, `use-velocity`) |
| Lint | `yarn lint` | exit 0 |

Jest runs against source, so no rebuild needed between test iterations.
Note: `frameData.timestamp` is a module-level singleton that persists across
tests — if a new test misbehaves only in-suite, that's the first suspect.

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/frameloop/render-step.ts` (the fix)
- `packages/motion-dom/src/frameloop/__tests__/index.test.ts` (new test)
- `packages/motion-dom/src/value/__tests__/transform-value.test.ts` (new test)
- `packages/framer-motion/src/value/__tests__/use-transform.test.tsx` (new test)

**Out of scope**:
- `subscribe-value.ts` / `use-combine-values.ts` — their scheduling is correct; the bug is in the step. Plan 011 rewrites `use-combine-values.ts` separately.
- Topological ordering of subscribers, lazy/pull recomputation — that is plan 012's derivation-graph territory.
- `batcher.ts` — `flushNextFrame` handling is unrelated.

## Git workflow

- Branch: `fix/2280-diamond-value-propagation` off `main`.
- Commit style: short imperative sentence (match `git log --oneline`).
- `gh pr edit` is broken on this repo (Projects Classic deprecation) — use `gh api -X PATCH repos/motiondivision/motion/pulls/<n>` if PR metadata must change. If `gh pr create` succeeds, move on.

## Steps

### Step 1: Failing tests first (three layers)

1a. In `packages/motion-dom/src/frameloop/__tests__/index.test.ts`, model on the
existing `"fires callback on current frame if scheduled with `true` within the same step"`
test (line 41):

```ts
it("re-runs a process re-scheduled immediately after it already ran this frame", () => {
    return new Promise<void>((resolve, reject) => {
        const order: string[] = []
        const b = () => order.push("b")
        let rescheduled = false
        const a = () => {
            order.push("a")
            if (!rescheduled) {
                rescheduled = true
                frame.update(b, false, true)
            }
        }
        frame.update(b) // b inserted before a, so it runs first
        frame.update(a)
        frame.render(() =>
            order.join() === "b,a,b" ? resolve() : reject(new Error(order.join()))
        )
    })
})
```

1b. In `packages/motion-dom/src/value/__tests__/transform-value.test.ts`, using
that file's existing `nextFrame` helper (lines 5-9):

```ts
test("diamond dependencies fully propagate (issue #2280)", async () => {
    const a = motionValue(0)
    const aHalf = transformValue(() => a.get() / 2)
    const aQuarter = transformValue(() => aHalf.get() / 2)
    const result = transformValue(() => a.get() + aQuarter.get())

    a.set(100)
    await nextFrame()
    expect(aQuarter.get()).toBe(25)
    expect(result.get()).toBe(125)
})
```

1c. In `packages/framer-motion/src/value/__tests__/use-transform.test.tsx`
(uses `nextFrame` from `../../gestures/__tests__/utils`, already imported),
the issue's exact repro:

```tsx
test("diamond dependency via useTransform chains (issue #2280)", async () => {
    let result: MotionValue<number>
    const Component = () => {
        const a = useMotionValue(0)
        const aHalf = useTransform(a, (v) => v / 2)
        const aQuarter = useTransform(aHalf, (v) => v / 2)
        result = useTransform(
            [a, aQuarter],
            ([latestA, latestAQuarter]: number[]) => latestA + latestAQuarter
        )
        useEffect(() => {
            a.set(100)
        }, [])
        return <motion.div style={{ x: result }} />
    }
    render(<Component />)
    await nextFrame()
    await nextFrame()
    expect(result!.get()).toBe(125)
})
```

**Verify**: both test commands above → exactly these three tests FAIL:
1a with order `b,a` (no second `b`), 1b/1c with `result.get()` = `100`.
All pre-existing tests still pass. If any new test PASSES before the fix,
STOP — the bug analysis no longer matches the code.

### Step 2: Apply the fix in `render-step.ts`

In `triggerCallback` (`render-step.ts:37-45`), delete the callback from the
processing queue before invoking it:

```ts
function triggerCallback(callback: Process) {
    /**
     * Remove before executing so that if this callback is re-scheduled
     * with `immediate` during this pass (chained value updates, e.g.
     * diamond-shaped MotionValue graphs, issue #2280), the re-add
     * re-enters thisFrame and Set.forEach visits it again this frame.
     */
    thisFrame.delete(callback)

    if (toKeepAlive.has(callback)) {
        step.schedule(callback)
        runNextFrame()
    }

    numCalls++
    callback(latestFrameData)
}
```

Do not remove the `thisFrame.clear()` at `render-step.ts:106` (harmless,
defensive). keepAlive is unaffected: `step.schedule(callback)` defaults
`immediate=false`, so keepAlive re-adds go to `nextFrame` as before.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop|transform-value"` → all pass, including 1a/1b.
Then `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-transform"` → all pass, including 1c.

### Step 3: Full regression sweep

The frame loop underpins everything; run wide:

1. `npx jest --config packages/motion-dom/jest.config.json` → all pass.
2. `cd packages/framer-motion && yarn test-client` → no new failures vs `main` (pre-existing: SSR `TextEncoder`, `use-velocity`).
3. `yarn build && yarn lint` from repo root → exit 0.

Watch specifically for **test-suite timeouts/hangs**: the fix permits same-frame
re-execution, so a divergent immediate cycle would now loop within one frame
instead of silently dropping (see Maintenance notes). A hang = STOP.

### Step 4: PR and gated issue close

Open a PR (`gh pr create`) titled
"Fix dropped same-frame updates in diamond MotionValue chains", body referencing
issue #2280 and the root cause summary above, ending with the repo's PR footer
(`🤖 Generated with [Claude Code](https://claude.com/claude-code)`).

**Only after the row for this plan in `plans/issues/README.md` is marked
APPROVED** (and the fix is merged): comment and close —

```bash
gh api repos/motiondivision/motion/issues/2280/comments -f body="Fixed: derived values scheduled into the currently-processing frame step were dropped if their update callback had already run that frame, leaving diamond-shaped useTransform/transformValue chains permanently stale. The frame step now allows a re-scheduled callback to re-run within the same frame, so the example in this issue settles at 125 as expected."
gh api -X PATCH repos/motiondivision/motion/issues/2280 -f state=closed -f state_reason=completed
```

If the row is not APPROVED, set status `BLOCKED (awaiting approval)` and stop after the PR.

## Test plan

- 1a frameloop unit test — the mechanism gate (re-add after execution re-runs same frame).
- 1b vanilla `transformValue` diamond — motion-dom layer regression gate.
- 1c React `useTransform` diamond — the issue's exact reproduction.
- Existing gates that must stay green: `"frame scheduling"` in `use-transform.test.tsx:147`, keepAlive tests in `frameloop/__tests__/index.test.ts:99-141`, all of `use-motion-template`/`use-scroll`/`use-spring` suites (consumers of preRender scheduling).

## Done criteria

- [ ] All three new tests exist and pass; each was observed failing before Step 2.
- [ ] `npx jest --config packages/motion-dom/jest.config.json` exits 0.
- [ ] `cd packages/framer-motion && yarn test-client` → no new failures vs main.
- [ ] `yarn build` and `yarn lint` exit 0.
- [ ] `git status` shows only the four in-scope files modified.
- [ ] `plans/issues/README.md` row updated; issue close only per the APPROVED gate.

## STOP conditions

- Any Step 1 test passes before the fix (codebase drifted; re-derive root cause).
- A test suite hangs or times out after Step 2 (divergent immediate-cycle exposed; report which test rather than adding ad-hoc loop guards).
- Existing keepAlive or `"fires callback on current frame..."` frameloop tests fail after one fix attempt.
- The fix appears to need changes in `subscribe-value.ts`, `use-combine-values.ts`, or `batcher.ts` (out of scope; report).

## Relationship to plans 011/012 (coordinate, don't duplicate)

- `plans/011-use-combine-values-render-churn.md` rewrites
  `use-combine-values.ts` (per-render churn) and also adds tests to
  `use-transform.test.tsx`. **This plan should land first** — it's a P1
  correctness fix in motion-dom and doesn't touch 011's files; 011 then
  rebases trivially (only the shared test file can conflict). 011 does NOT
  fix this bug, and this fix does not address 011's churn.
- `plans/012-motion-value-derivation-graph-spike.md` designs a mark-dirty/pull
  graph that would make diamond glitches structurally impossible (and remove
  the double-notify this fix tolerates: `result` notifies 100 then 125 within
  one frame — eventual consistency, not glitch-freedom). The three new tests
  here become regression gates for that future design; the spike doc should
  cite them.

## Maintenance notes

- **Reviewer scrutiny**: the behavior change is scoped to "callback re-scheduled with `immediate=true` into a step that already executed it this frame" — previously dropped, now re-run. `VisualElement.scheduleRender` also uses immediate scheduling (`frame.render(this.render, false, true)`), so a value mutated inside a render callback now re-renders the same frame instead of silently skipping; that is the correct behavior but worth one reviewer glance.
- A user-authored non-converging cycle (`a.on("change") → b.set` → `b.on("change") → a.set` with diverging values) previously ping-ponged across frames or died silently; it can now spin within a frame. `updateAndNotify`'s equality cutoff terminates all converging cycles. If this is judged a real hazard, a max-revisit guard is a follow-up, deliberately not added here (bundle size).
