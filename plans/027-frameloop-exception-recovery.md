# Plan 027: Make the frameloop survive throwing callbacks and fix the non-keepAlive batcher stall

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
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

The frameloop (`frame`, exported from `motion-dom` and used by every animation,
gesture, and projection update in Motion) has no exception safety. If **any**
scheduled callback throws — a user's `onUpdate`, a `useTransform` transformer, a
`frame.read(...)` consumer — two `isProcessing` flags are left stuck `true`:
one on the shared `FrameData` state in the batcher, one inside the step that
was processing. Both gates that restart the loop check those flags, so **every
animation on the page silently and permanently stops**. No error from Motion,
no recovery — the original exception surfaces once, then the library is dead
for the page's lifetime.

A second, related bug: scheduling work onto a non-keepAlive batcher (the
`microtask` batcher) *during* a flush — or scheduling any job with
`keepAlive: true` on it — leaves the batcher's internal `runNextFrame` flag
stuck `true`. From then on every future `microtask.x(...)` call skips `wake()`
and queues into a flush that never comes: the microtask batcher is permanently
dead too. No current caller passes `keepAlive` to `microtask`, but
mid-flush scheduling is one nested render away, and the public `Schedule` type
invites the `keepAlive` argument. Both bugs share a fix site, so they're one
plan.

## Current state

Files (all under `packages/motion-dom/src/frameloop/`):

- `batcher.ts` — `createRenderBatcher()`; builds the 8 ordered steps, owns
  `processBatch`, `wake`, and the `runNextFrame`/`state.isProcessing` flags.
- `render-step.ts` — `createRenderStep()`; per-step double-buffered job queues
  and the step-level `isProcessing` flag.
- `frame.ts` — the singleton `frame` batcher (`requestAnimationFrame`,
  `allowKeepAlive: true`).
- `microtask.ts` — the singleton `microtask` batcher (`queueMicrotask`,
  `allowKeepAlive: false`).
- `__tests__/index.test.ts` — existing 9 tests for the `frame` singleton.

### Bug 1a — batcher level (`batcher.ts:42–83`)

```ts
const processBatch = () => {
    const useManualTiming = MotionGlobalConfig.useManualTiming
    const timestamp = useManualTiming
        ? state.timestamp
        : performance.now()
    runNextFrame = false

    if (!useManualTiming) {
        state.delta = useDefaultElapsed
            ? 1000 / 60
            : Math.max(Math.min(timestamp - state.timestamp, maxElapsed), 1)
    }

    state.timestamp = timestamp
    state.isProcessing = true

    // Unrolled render loop for better per-frame performance
    setup.process(state)
    read.process(state)
    resolveKeyframes.process(state)
    preUpdate.process(state)
    update.process(state)
    preRender.process(state)
    render.process(state)
    postRender.process(state)

    state.isProcessing = false

    if (runNextFrame && allowKeepAlive) {
        useDefaultElapsed = false
        scheduleNextBatch(processBatch)
    }
}

const wake = () => {
    runNextFrame = true
    useDefaultElapsed = true

    if (!state.isProcessing) {
        scheduleNextBatch(processBatch)
    }
}
```

If any `*.process(state)` throws, `state.isProcessing` stays `true`, so
`wake()` (gated on `!state.isProcessing`) never schedules another batch.
And because `runNextFrame` was reset to `false` at the top, the `schedule`
wrapper (`batcher.ts:85–93`, `if (!runNextFrame) wake()`) *does* call `wake()`
— which then no-ops. Permanent freeze.

### Bug 1b — step level (`render-step.ts:73–114`)

```ts
process: (frameData) => {
    latestFrameData = frameData

    if (isProcessing) {
        flushNextFrame = true
        return
    }

    isProcessing = true

    // Swap this frame and the next to avoid GC
    const prevFrame = thisFrame
    thisFrame = nextFrame
    nextFrame = prevFrame

    // Execute this frame
    thisFrame.forEach(triggerCallback)
    ...
    thisFrame.clear()

    isProcessing = false

    if (flushNextFrame) { ... }
}
```

If `triggerCallback` throws (it calls the user callback directly), the step's
`isProcessing` stays `true` — every future `process()` call on that step just
sets `flushNextFrame = true` and returns. The step is dead even if the batcher
recovers.

### Bug 2 — non-keepAlive batcher stall (`batcher.ts:21`, `70–73`, `85–93`)

```ts
const flagRunNextFrame = () => (runNextFrame = true)
...
    if (runNextFrame && allowKeepAlive) {
        useDefaultElapsed = false
        scheduleNextBatch(processBatch)
    }
...
acc[key] = (process: Process, keepAlive = false, immediate = false) => {
    if (!runNextFrame) wake()
    return step.schedule(process, keepAlive, immediate)
}
```

On the `microtask` batcher (`allowKeepAlive: false`):
- A `keepAlive: true` job calls `flagRunNextFrame()` during the flush
  (via `render-step.ts:38–41`), OR any callback schedules a new job mid-flush
  (the `schedule` wrapper calls `wake()`, which sets `runNextFrame = true` but
  can't schedule because `state.isProcessing` is `true`).
- `processBatch` ends without rescheduling (`allowKeepAlive` is false), and
  nothing ever resets `runNextFrame` to `false`.
- Every subsequent `microtask.x(...)` sees `runNextFrame === true`, skips
  `wake()`, and its job is stranded forever.

### Conventions

- Library code is size-sensitive: "Prioritise small file size" (CLAUDE.md).
  The fixes below are deliberately minimal — do not add per-callback
  try/catch, error logging, or new exports.
- No default exports; `interface` over `type` where applicable; arrow
  callbacks (see existing files — match them).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Frameloop tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"` | all pass (9 existing + new) |
| Full motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json --max-workers=2` | same pass/fail set as the pre-change baseline you record in Step 1 |
| Typecheck | `npx tsc --noEmit -p packages/motion-dom/tsconfig.json` | exit 0, no output |
| Lint | `yarn lint` | exit 0 |

No build step is needed — motion-dom unit tests run against `src/` via ts-jest.

## Scope

**In scope** (the only files you should modify/create):
- `packages/motion-dom/src/frameloop/batcher.ts`
- `packages/motion-dom/src/frameloop/render-step.ts`
- `packages/motion-dom/src/frameloop/__tests__/batcher.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):
- `frame.ts`, `microtask.ts`, `order.ts`, `types.ts`, `sync-time.ts`,
  `index-legacy.ts` — no changes needed.
- `__tests__/index.test.ts` — plan 028 and plan 029 edit it; keep this plan's
  tests in the new `batcher.test.ts` to avoid conflicts.
- The `cancel` function in `render-step.ts` — that's plan 028. Do not "fix it
  while you're there".
- Any error-reporting/`console.error` additions — exceptions must still
  propagate unchanged.

## Git workflow

- Branch: `advisor/027-frameloop-exception-recovery`
- Commit style: short imperative, matching repo history (e.g. "Fixing scroll
  frame scheduling"). One commit for tests-first, one for the fix is fine; a
  single commit is also acceptable.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Record the baseline

Run the full motion-dom suite once on the clean tree and save the output:

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --max-workers=2 2>&1 | tail -20`
→ note the exact pass/fail counts. (At planning time the frameloop suite was
9/9 green.) This is your comparison point for the done criteria.

### Step 2: Write the failing tests

Create `packages/motion-dom/src/frameloop/__tests__/batcher.test.ts`. Test
`createRenderBatcher` directly with a captured scheduler so no rAF/microtask
timing is involved — this keeps tests synchronous and isolated from the
`frame` singleton (whose `frameData.timestamp` leaks across tests):

```ts
import { MotionGlobalConfig } from "motion-utils"
import { createRenderBatcher } from "../batcher"

function createTestBatcher(allowKeepAlive: boolean) {
    let queued: Function | undefined
    const batcher = createRenderBatcher((cb) => (queued = cb), allowKeepAlive)
    return {
        ...batcher,
        flush: () => {
            const batch = queued
            queued = undefined
            batch?.()
        },
        hasQueuedBatch: () => queued !== undefined,
    }
}
```

Write these five tests (names indicative; keep them in a
`describe("createRenderBatcher")` block):

1. **"recovers after a callback throws"** — schedule a throwing job on
   `update` plus a spy on `render`. `expect(flush).toThrow()`. Then schedule a
   new spy on `update`, assert `hasQueuedBatch()` is true (the new schedule
   woke the batcher — fails today because `state.isProcessing` is stuck),
   `flush()` again, assert both the new spy ran and `state.isProcessing` is
   `false`.
2. **"a throwing callback doesn't kill its step"** — throwing job on `update`;
   `expect(flush).toThrow()`; schedule a spy on `update`; flush; assert the
   spy ran (fails today because the step's `isProcessing` is stuck and
   `process()` short-circuits via `flushNextFrame`).
3. **"keepAlive loop survives a throwing keepAlive callback"** — schedule a
   throwing job with `keepAlive: true` on `update`; `expect(flush).toThrow()`;
   assert `hasQueuedBatch()` is true (the keepAlive job re-flagged and the
   reschedule must still happen — fails today because the throw skips the
   tail of `processBatch`).
4. **"keepAlive job on a non-keepAlive batcher does not stall future
   schedules"** — `createTestBatcher(false)`; schedule a job with
   `keepAlive: true` on `render`; flush; schedule a plain spy on `render`;
   assert `hasQueuedBatch()` is true (fails today: `runNextFrame` stuck true
   blocks `wake()`); flush; assert the spy ran. Also assert the keepAlive job
   ran again on that second flush (the new, documented semantics: keepAlive on
   a non-keepAlive batcher re-runs per flush but never self-perpetuates).
5. **"job scheduled during a non-keepAlive flush gets a follow-up flush"** —
   `createTestBatcher(false)`; schedule job A on `read` whose body schedules
   spy B on `render`; flush; assert `hasQueuedBatch()` is true (fails today:
   B is stranded and the batcher is dead); flush; assert B ran.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop/__tests__/batcher"`
→ **all five new tests FAIL**, each for the reason noted above. The existing
`index.test.ts` suite must still pass. If any new test passes before the fix,
STOP — your test isn't capturing the bug.

### Step 3: Fix `render-step.ts` — step-level try/finally

Wrap only the callback execution; move the existing stats/clear/flag lines
into `finally`, unchanged in content and order:

```ts
isProcessing = true

// Swap this frame and the next to avoid GC
const prevFrame = thisFrame
thisFrame = nextFrame
nextFrame = prevFrame

try {
    // Execute this frame
    thisFrame.forEach(triggerCallback)
} finally {
    if (stepName && statsBuffer.value) {
        statsBuffer.value.frameloop[stepName].push(numCalls)
    }
    numCalls = 0

    // Clear the frame so no callbacks remain. This is to avoid
    // memory leaks should this render step not run for a while.
    thisFrame.clear()

    isProcessing = false
}

if (flushNextFrame) {
    flushNextFrame = false
    step.process(frameData)
}
```

The `if (flushNextFrame)` block stays *after* the try/finally (outside it), so
on the throw path the exception propagates without triggering a nested flush.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"`
→ test 2 now passes; tests 1, 3–5 still fail.

### Step 4: Fix `batcher.ts` — batch-level try/finally + flag gating

Three changes:

a) Gate the keepAlive flag on `allowKeepAlive` (`batcher.ts:21`):

```ts
const flagRunNextFrame = () => allowKeepAlive && (runNextFrame = true)
```

b) Wrap the unrolled step calls in try/finally and move the tail of
`processBatch` into `finally`, dropping the now-redundant `allowKeepAlive`
check (with (a) in place, `runNextFrame` on a non-keepAlive batcher can only
mean "new work was scheduled mid-flush", which must trigger a follow-up
flush):

```ts
state.timestamp = timestamp
state.isProcessing = true

try {
    // Unrolled render loop for better per-frame performance
    setup.process(state)
    read.process(state)
    resolveKeyframes.process(state)
    preUpdate.process(state)
    update.process(state)
    preRender.process(state)
    render.process(state)
    postRender.process(state)
} finally {
    state.isProcessing = false

    if (runNextFrame) {
        useDefaultElapsed = false
        scheduleNextBatch(processBatch)
    }
}
```

c) No change to `wake()` or the `schedule` wrapper.

Behavior notes you can rely on (and that the tests pin):
- For the `frame` batcher (`allowKeepAlive: true`) the rescheduling condition
  is unchanged: `runNextFrame && allowKeepAlive` ≡ `runNextFrame`.
- A keepAlive callback is rescheduled and flags `runNextFrame` *before* it
  executes (`render-step.ts:37–45`), so a throwing keepAlive job still keeps
  the loop alive.
- An infinite microtask loop is impossible: on a non-keepAlive batcher,
  keepAlive jobs no longer flag `runNextFrame`, so a follow-up flush is only
  scheduled when genuinely new work arrived mid-flush.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"`
→ all tests pass (9 existing + 5 new).

### Step 5: Full verification

**Verify**, in order:
1. `npx jest --config packages/motion-dom/jest.config.json --max-workers=2`
   → pass/fail set identical to the Step 1 baseline, plus the 5 new passing tests.
2. `npx tsc --noEmit -p packages/motion-dom/tsconfig.json` → exit 0.
3. `yarn lint` → exit 0.
4. `cd packages/framer-motion && yarn test-client` → pass/fail set identical
   to its own pre-change baseline (run it on the clean tree first if you
   didn't capture it in Step 1; `use-velocity.test.tsx` has a known
   pre-existing failure — do not try to fix it).

## Test plan

Covered by Step 2 (five new failing-first tests in `batcher.test.ts`, modeled
structurally on the promise-style tests in
`packages/motion-dom/src/frameloop/__tests__/index.test.ts` but synchronous via
the captured scheduler). No existing test should change.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"` exits 0 with 14 tests passing
- [ ] Each of the 5 new tests was observed failing before Steps 3–4 (state this explicitly in your report)
- [ ] `npx jest --config packages/motion-dom/jest.config.json --max-workers=2` matches the Step 1 baseline (no new failures)
- [ ] `npx tsc --noEmit -p packages/motion-dom/tsconfig.json` exits 0
- [ ] `yarn lint` exits 0
- [ ] `git status` shows changes only to the 3 in-scope files
- [ ] `plans/README.md` status row for 027 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `batcher.ts` or `render-step.ts` changed since
  `42bfbe3ed` and the excerpts above no longer match.
- Any of the 5 new tests passes *before* the fix is applied.
- After Step 4, any test in `__tests__/index.test.ts` fails (especially
  "correctly keeps alive after a flush" — it exercises the
  `flushNextFrame` re-entry path this plan touches).
- The fix appears to require changing `wake()`, the `schedule` wrapper, or
  any file outside the in-scope list.
- Full-suite comparison shows a new failure outside the frameloop tests.

## Maintenance notes

- **Deliberate non-goal — per-callback isolation**: with this fix, a throwing
  callback still aborts the *rest of its step* for that frame (un-run one-shot
  jobs are dropped by `thisFrame.clear()` in the finally; un-run keepAlive
  jobs in the same step lose that frame's reschedule and resume on the next
  external `schedule`/`wake`). Full isolation would need try/catch per
  callback in `triggerCallback` plus async rethrow (`setTimeout(() => { throw e })`)
  to preserve `window.onerror` reporting — more bytes and changed error
  timing. Revisit only if real-world reports show the partial-frame drop
  matters.
- **New documented semantics**: `keepAlive: true` on the `microtask` batcher
  now means "re-runs on every flush, does not self-perpetuate" instead of
  "permanently breaks the batcher". If a future caller wants self-perpetuating
  microtask work, that's a design conversation, not a bug.
- Reviewers should scrutinize: the `finally` in `processBatch` reschedules
  even on the throw path — that's intentional (keeps keepAlive animations
  alive); confirm no double-scheduling by reading `wake()`'s
  `!state.isProcessing` guard, which is correct again now that the flag can't
  stick.
- Plan 028 changes `cancel` in `render-step.ts`; whichever lands second
  rebases trivially (different functions).
