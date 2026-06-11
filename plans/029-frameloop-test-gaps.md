# Plan 029: Close the frameloop test gaps (microtask batcher, useManualTiming, full step order, delta clamp)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/frameloop/`
> Expected drift: plans 027/028 may have landed (try/finally in `batcher.ts`/
> `render-step.ts`, an extra `thisFrame.delete` in `cancel`, a new
> `__tests__/batcher.test.ts`, two extra tests in `__tests__/index.test.ts`).
> That drift is fine. If `order.ts`, the step *names*, or the delta
> computation in `batcher.ts` changed, compare against "Current state" and
> STOP on mismatch.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (test-only; no source changes)
- **Depends on**: none hard; 027/028 soft (same test files — land this last to avoid merge conflicts)
- **Category**: tests
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

The frameloop is the substrate under every animation in Motion, but its test
suite (`__tests__/index.test.ts`, 9 tests at planning time) only exercises the
`frame` singleton: the step-order test covers 5 of the 8 steps (missing
`setup`, `resolveKeyframes`, `preUpdate`), the `microtask` batcher has zero
tests, `MotionGlobalConfig.useManualTiming` batching (the mechanism Jest tests
and the Remotion integration rely on) is untested, and the frame-delta
computation (default 1000/60 first frame, clamp to [1, 40]ms) is untested.
These are characterization tests: they pin current behavior so future
frameloop work (e.g. the effects/VisualElement unification) can refactor with
confidence.

## Current state

Files (all under `packages/motion-dom/src/frameloop/`):

- `order.ts` — the canonical step order:

```ts
export const stepsOrder: StepId[] = [
    "setup", // Compute
    "read", // Read
    "resolveKeyframes", // Write/Read/Write/Read
    "preUpdate", // Compute
    "update", // Compute
    "preRender", // Compute
    "render", // Write
    "postRender", // Compute
] as const
```

- `__tests__/index.test.ts:4-27` — order test covers only
  `read → update → preRender → render → postRender`.
- `microtask.ts` — `createRenderBatcher(queueMicrotask, false)`; exports
  `microtask`, `cancelMicrotask`. Untested.
- `batcher.ts:42-55` — timestamp/delta logic:

```ts
const useManualTiming = MotionGlobalConfig.useManualTiming
const timestamp = useManualTiming
    ? state.timestamp
    : performance.now()
...
if (!useManualTiming) {
    state.delta = useDefaultElapsed
        ? 1000 / 60
        : Math.max(Math.min(timestamp - state.timestamp, maxElapsed), 1)
}
state.timestamp = timestamp
```

  `maxElapsed` is `40` (`batcher.ts:6`). `useDefaultElapsed` starts `true`, is
  reset to `true` by `wake()`, and set `false` when a batch reschedules the
  next one — so the *first* frame after idle reports `delta === 1000/60` and
  subsequent keepAlive frames report the real (clamped) elapsed time.
- Known test-environment traps (from prior sessions, verify still true):
  - `frameData.timestamp` is a module-level singleton that persists across
    tests in a file — prefer locally-created batchers
    (`createRenderBatcher`) over the `frame` singleton for timing assertions.
  - `MotionGlobalConfig.useManualTiming` is global state — always restore it
    in `afterEach`, or unrelated tests in the same Jest worker will break.
- If plan 027 landed, `__tests__/batcher.test.ts` already exists with a
  `createTestBatcher` helper that captures `scheduleNextBatch` — reuse it.
  If not, create the file and the helper as specified in Step 3.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Frameloop tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"` | all pass |
| Full motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json --max-workers=2` | same pass/fail set as pre-change run |
| Typecheck | `npx tsc --noEmit -p packages/motion-dom/tsconfig.json` | exit 0 |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope** (test files only):
- `packages/motion-dom/src/frameloop/__tests__/index.test.ts` (extend the order test)
- `packages/motion-dom/src/frameloop/__tests__/microtask.test.ts` (create)
- `packages/motion-dom/src/frameloop/__tests__/batcher.test.ts` (create if absent, else extend)

**Out of scope** (do NOT touch):
- ALL source files. If a test you write fails against current source, that is
  a finding to report, not a bug to fix here (a characterization test must
  pass as-is; repo policy: no repro → no fix applies in reverse too).
- `__tests__` in other packages.

## Git workflow

- Branch: `advisor/029-frameloop-test-gaps`
- Commit style: short imperative, matching repo history. Single commit is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend the order test to all 8 steps

In `__tests__/index.test.ts`, update "fires callbacks in the correct order" to
schedule one callback per step — `setup`, `read`, `resolveKeyframes`,
`preUpdate`, `update`, `preRender`, `render`, `postRender` — pushing
`0..7`, asserting the full sequence in the `postRender` callback (follow the
existing test's promise/resolve-reject shape). Import nothing new; `frame`
already exposes all 8 (`Batcher` maps every `StepId`).

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"` → all pass.

### Step 2: Create `__tests__/microtask.test.ts`

Test the `microtask` singleton (import `{ microtask, cancelMicrotask }` from
`../microtask`). Three tests:

1. **Runs asynchronously in a microtask**: schedule a spy via
   `microtask.render(spy)`; assert not called synchronously; `await Promise.resolve()`
   (flush microtasks) — possibly twice (`await null` twice) since the flush
   itself is queued as a microtask; assert called once.
2. **Step order**: schedule on `render`, `read`, `update` (deliberately out of
   order), collect call order, flush, assert `read → update → render`.
3. **`cancelMicrotask` cancels**: schedule spy, cancel it, flush, assert not
   called.

Keep each test's scheduling self-contained; the microtask batcher shares
module state across tests in the file, so don't assert on timestamps.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop/__tests__/microtask"` → 3 pass.

### Step 3: Batcher timing tests in `__tests__/batcher.test.ts`

If the file doesn't exist yet (plan 027 not landed), create it with this
helper; otherwise reuse the existing one:

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

Add a `describe("batcher timing")` block with:

1. **First frame uses default elapsed**: mock
   `jest.spyOn(performance, "now").mockReturnValue(1000)`; new test batcher
   (keepAlive `true`); schedule a spy on `update` capturing `delta`; flush;
   assert `delta === 1000 / 60`.
2. **Delta clamps to maxElapsed (40)**: continue from a keepAlive job so the
   batch reschedules (`useDefaultElapsed` becomes false): schedule with
   `keepAlive: true`, flush at `now = 1000`, advance mock to `1200`, flush
   again; assert the second invocation's `delta === 40`.
3. **Delta clamps to minimum 1**: third flush with mock advanced by `0.2`
   (e.g. `1200.2`); assert `delta === 1`.
4. **useManualTiming uses `state.timestamp` and skips delta computation**:
   `MotionGlobalConfig.useManualTiming = true` (restore in
   `afterEach(() => { MotionGlobalConfig.useManualTiming = false })`); new
   test batcher; set `batcher.state.timestamp = 500` and
   `batcher.state.delta = 123` directly; schedule a spy on `update`; flush;
   assert the spy received `timestamp === 500` and `delta === 123`
   (i.e. neither was recomputed from `performance.now()`).

Restore the `performance.now` spy in `afterEach` (`jest.restoreAllMocks()`).
Tests 1–3 may share one batcher in sequence (the progression default → real →
clamped is itself the behavior under test); test 4 uses a fresh batcher.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop/__tests__/batcher"` → all pass.

### Step 4: Full verification

**Verify**, in order:
1. `npx jest --config packages/motion-dom/jest.config.json --max-workers=2`
   → no new failures vs a clean-tree run.
2. `npx tsc --noEmit -p packages/motion-dom/tsconfig.json` → exit 0.
3. `yarn lint` → exit 0.
4. Run the frameloop pattern twice in a row in one command
   (`--testPathPattern="frameloop"`) → identical results (guards against
   `MotionGlobalConfig`/spy leakage between files).

## Test plan

This plan *is* the test plan: +1 extended order test, +3 microtask tests,
+4 batcher timing tests, all characterization (passing against current
source). Pattern to follow: promise-style tests in
`__tests__/index.test.ts` for singleton tests; synchronous captured-scheduler
style for `batcher.test.ts`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="frameloop"` exits 0, with ≥8 more passing tests than the pre-plan run
- [ ] The order test asserts all 8 steps in `stepsOrder` sequence
- [ ] Full motion-dom suite shows no new failures
- [ ] `npx tsc --noEmit -p packages/motion-dom/tsconfig.json` exits 0
- [ ] `yarn lint` exits 0
- [ ] `git status` shows only the 3 in-scope test files modified/created — zero source-file changes
- [ ] `plans/README.md` status row for 029 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any characterization test FAILS against current source — that's either a
  drift signal or a real bug; report it with the failing assertion instead of
  adjusting the expectation to match or "fixing" the source.
- `stepsOrder` in `order.ts` no longer matches the excerpt above.
- A test passes alone but fails when the whole frameloop pattern runs
  (state-leak across files) and one `afterEach` restore doesn't resolve it.
- You need to modify any non-test file.

## Maintenance notes

- These tests pin scheduler behavior that the effects/VisualElement
  unification (branch `worktree-style-effect`) and any future Remotion/
  manual-timing work will lean on — `useManualTiming` semantics in
  particular. If that work intentionally changes batching semantics, these
  tests are the place the change must be made visible.
- The delta tests encode `maxElapsed = 40` and the `1000/60` first-frame
  default as contract. If a future change makes the first-frame delta
  display-rate-aware, update test 1 deliberately.
- Deliberately not covered: relative ordering of the `microtask` flush vs the
  `frame` rAF batch (JSDOM's rAF is `setTimeout`-based, so the ordering
  proven here wouldn't prove anything about browsers).
