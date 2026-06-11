# Plan 028: Make `cancelFrame` cancel callbacks already queued for the current frame's step

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/frameloop/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (If plan 027 already landed, its
> changes to `batcher.ts` and the try/finally in `render-step.ts:process` are
> expected drift — only a changed `cancel` function is a STOP.)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (subtle scheduler-semantics change; broad blast radius via animations/projection)
- **Depends on**: none (merges trivially with 027; see Maintenance notes)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`cancelFrame(callback)` only removes the callback from each step's *next*-frame
queue. While a step is processing, its jobs have already been swapped into the
`thisFrame` set — so a callback cancelled by an *earlier callback in the same
step* still runs once after being cancelled.

Concrete consequence: animations tick as keepAlive jobs on the `update` step
(`packages/motion-dom/src/animation/drivers/frame.ts:10-11` —
`start: () => frame.update(passTimestamp, keepAlive)`,
`stop: () => cancelFrame(passTimestamp)`). If animation A's `onUpdate` calls
`b.stop()`, and B's tick is queued later in the same `update` pass, B still
ticks that frame and writes a value to its motion value *after* being stopped
— a one-frame stale write that can overwrite a value the stopper just set.
The same applies to any `frame.*`-scheduled work cancelled from within the
same step (gestures, `useAnimationFrame` consumers stopping animations, etc.).

## Current state

- `packages/motion-dom/src/frameloop/render-step.ts` — per-step double-buffered
  queues; `cancel` at lines 65–68:

```ts
/**
 * Cancel the provided callback from running on the next frame.
 */
cancel: (callback) => {
    nextFrame.delete(callback)
    toKeepAlive.delete(callback)
},
```

- The two queues (`render-step.ts:13-14`): `thisFrame` and `nextFrame` are
  reused `Set`s, swapped at the start of `process()`. Outside processing,
  `thisFrame` is always empty (it's `.clear()`ed at the end of every
  `process()`), so deleting from it unconditionally is a safe no-op in the
  idle case.
- ECMAScript guarantees `Set.prototype.forEach` does **not** visit an element
  deleted before it is visited — so deleting from `thisFrame` mid-iteration
  reliably prevents the cancelled callback from running.
- Why existing cancel tests pass today: they cancel across *different* steps
  (e.g. a `read` callback cancelling an `update` callback). The later step
  hasn't swapped yet, so the target is still in its `nextFrame`. Only
  same-step cancellation is broken. See
  `packages/motion-dom/src/frameloop/__tests__/index.test.ts:29-39` and
  `89-97`.
- Self-cancellation during a callback's own execution (e.g. an animation
  stopping itself mid-tick) is unaffected: keepAlive jobs are rescheduled into
  `nextFrame` *before* execution (`render-step.ts:37-45`), which is exactly
  where today's `cancel` already deletes from.
- Repo convention: library code is size-sensitive (CLAUDE.md "Prioritise small
  file size") — the fix is one added line.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Frameloop tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"` | all pass |
| Full motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json --max-workers=2` | same pass/fail set as pre-change baseline |
| framer-motion client tests | `cd packages/framer-motion && yarn test-client` | same pass/fail set as pre-change baseline (`use-velocity.test.tsx` has a known pre-existing failure) |
| Typecheck | `npx tsc --noEmit -p packages/motion-dom/tsconfig.json` | exit 0 |
| Lint | `yarn lint` | exit 0 |

No build step is needed — unit tests run against `src/` via ts-jest.

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/frameloop/render-step.ts` (the `cancel` function only)
- `packages/motion-dom/src/frameloop/__tests__/index.test.ts` (add tests)

**Out of scope** (do NOT touch, even though they look related):
- `batcher.ts` — plan 027's territory.
- `process`/`triggerCallback` in `render-step.ts` — no changes needed there
  for this fix.
- `packages/motion-dom/src/animation/drivers/frame.ts` and any animation/
  projection consumer — the fix is in the scheduler, not the callers.
- Public types (`types.ts`) — the signature of `cancel` doesn't change.

## Git workflow

- Branch: `advisor/028-frameloop-same-step-cancel`
- Commit style: short imperative, matching repo history. Tests-first commit
  then fix commit preferred; single commit acceptable.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record baselines

On the clean tree, run and save the tail of:
1. `npx jest --config packages/motion-dom/jest.config.json --max-workers=2`
2. `cd packages/framer-motion && yarn test-client`

These are the comparison points for the done criteria. (At planning time the
frameloop suite was 9/9 green; `use-velocity.test.tsx` in framer-motion is a
known pre-existing failure.)

### Step 2: Write the failing tests

Add two tests to `packages/motion-dom/src/frameloop/__tests__/index.test.ts`,
modeled on the existing promise-style tests in that file:

```ts
it("cancels a callback scheduled in the same step within the same frame", () => {
    return new Promise<void>((resolve, reject) => {
        const callback = () => reject(new Error("should have been cancelled"))

        frame.update(() => cancelFrame(callback))
        frame.update(callback)

        frame.render(() => resolve())
    })
})

it("cancelling a keepAlive process from the same step prevents its tick", () => {
    return new Promise<void>((resolve, reject) => {
        let ticks = 0
        const tick = () => ticks++

        frame.update(() => cancelFrame(tick))
        frame.update(tick, true)

        frame.render(() => (ticks === 0 ? resolve() : reject(new Error(`ticked ${ticks}x`))))
    })
})
```

These rely on `Set` insertion order: the canceller is scheduled first, so it
runs first within the `update` pass, after the queues have swapped — the
target is in `thisFrame`, which today's `cancel` doesn't touch.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"`
→ exactly these 2 new tests FAIL (the cancelled callback still fires); all
pre-existing tests pass. If either new test passes before the fix, STOP.

### Step 3: Fix `cancel`

In `packages/motion-dom/src/frameloop/render-step.ts`, add one line:

```ts
/**
 * Cancel the provided callback from running on the next frame.
 */
cancel: (callback) => {
    thisFrame.delete(callback)
    nextFrame.delete(callback)
    toKeepAlive.delete(callback)
},
```

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"`
→ all tests pass, including the 2 new ones and all pre-existing cancel tests
("cancels callbacks", "correctly cancels", "correctly cancels a keepAlive
process").

### Step 4: Blast-radius verification

This change means *any* callback cancelled mid-frame from an earlier same-step
callback no longer gets its final tick. Animations, projection, gestures, and
motion values all schedule through this code. Run the full suites and compare
against Step 1's baselines:

**Verify**, in order:
1. `npx jest --config packages/motion-dom/jest.config.json --max-workers=2`
   → identical pass/fail set to baseline + 2 new passing tests.
2. `cd packages/framer-motion && yarn test-client` → identical pass/fail set
   to baseline. Pay particular attention to animation, projection, and
   `use-transform`/`use-velocity` suites (they exercise `cancelFrame` and
   `frameSteps` directly).
3. `npx tsc --noEmit -p packages/motion-dom/tsconfig.json` → exit 0.
4. `yarn lint` → exit 0.

If any previously-passing test now fails, READ the failure before reacting:
a test that asserted a value updated "one more time after stop" would be
codifying the bug this plan fixes. Report such cases in your summary rather
than weakening the fix — but treat *behavioral* failures (wrong end values,
hung promises) as a STOP condition.

## Test plan

Covered by Step 2: two failing-first regression tests in the existing
frameloop suite, following its promise-style pattern. The existing cross-step
and self-cancel tests act as the guard that prior semantics are preserved.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Both new tests were observed failing before Step 3 (state this in your report)
- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"` exits 0
- [ ] Full motion-dom suite matches the Step 1 baseline (no new failures)
- [ ] `cd packages/framer-motion && yarn test-client` matches its baseline (no new failures)
- [ ] `npx tsc --noEmit -p packages/motion-dom/tsconfig.json` exits 0
- [ ] `yarn lint` exits 0
- [ ] `git diff --stat` touches only the 2 in-scope files, and the `render-step.ts` diff is the single added `thisFrame.delete(callback)` line
- [ ] `plans/README.md` status row for 028 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows the `cancel` function in `render-step.ts` no longer
  matches the excerpt above.
- Either new test passes before the fix is applied.
- Any pre-existing frameloop test fails after the fix.
- The framer-motion suite shows a new *behavioral* failure (hung test, wrong
  animation end value) — as opposed to a test that explicitly asserts the
  extra post-cancel tick.
- You find yourself wanting to make the `thisFrame` delete conditional on
  `isProcessing` or otherwise restructure `process()` — that's beyond this
  plan's contract.

## Maintenance notes

- **Semantics change to document in the PR**: `cancelFrame` is now effective
  immediately, even against callbacks already queued for the in-flight frame
  step. Previously a same-step cancellation let the callback run once more.
  Any future code that *wants* "run once then cancel" should schedule a
  one-shot (non-keepAlive) job instead.
- CI's Cypress/Playwright E2E runs are the final gate for browser-path
  fallout (projection interruption, drag-stop flows) — JSDOM can't cover
  those. Nothing here changes compositor/WAAPI paths, so unit + CI E2E is the
  right depth; don't add an E2E test just for this.
- Plan 027 wraps `process()` in try/finally in this same file; whichever
  lands second rebases trivially (different functions, no overlapping lines).
- Reviewer focus: confirm the deletion order doesn't matter (it doesn't — the
  three `Set`s are disjoint concerns) and that no caller relied on the
  cancelled-but-runs-once behavior (search PRs/issues if in doubt).
