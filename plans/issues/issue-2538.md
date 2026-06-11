# Plan issue-2538: Answer onExitComplete-before-unmount as documented behavior; gated by-design close (with optional deferral decision)

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2538 --jq .state` → expect `open`.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW for the answer path; MED if the maintainer opts into the timing change (public callback semantics)
- **Depends on**: maintainer decision (Step 2 gate)
- **Category**: support / by-design (optional behavior change)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2538

## Why this matters

Reported March 2024: `onExitComplete` fires before the exiting child's React
unmount (its `useEffect` cleanup logs after the callback). The reporter
expects post-unmount timing. The reported ordering is real and still true on
current main — but it matches the documented contract, which is about
*animations*, not unmounting. Changing it would alter observable timing for
every existing `onExitComplete` user. So this is a by-design answer with an
explicit, gated opt-in path if the maintainer wants the deferral.

## Current state

- Documented contract — `packages/framer-motion/src/components/AnimatePresence/types.ts:35-40`:
  ```ts
  /**
   * Fires when all exiting nodes have completed animating out.
   */
  onExitComplete?: () => void
  ```
- Implementation — `packages/framer-motion/src/components/AnimatePresence/index.tsx:205-212`
  (inside `onExit`):
  ```tsx
  if (isEveryExitComplete) {
      forceRender?.()
      setRenderedChildren(pendingPresentChildren.current)

      propagate && safeToRemove?.()

      onExitComplete && onExitComplete()
  }
  ```
  `setRenderedChildren` only *schedules* the commit that removes the exiting
  child; `onExitComplete()` runs synchronously in the same tick, hence before
  the child's effect cleanup. This is exactly what the reporter observed
  (their StackBlitz `framer-motion-animate-presence-q-ufdg7s` was not
  fetchable from the planning environment; the issue text fully describes it).
- The issue links the old pre-rewrite source lines (L221-222 of 2024's
  index.tsx); the equivalent today is the excerpt above — same ordering, so
  the report is neither stale nor fixed: it's the designed sequence.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Jest (only if opt-in path) | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence"` | pass |
| Issue close (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2538 -f state=closed -f state_reason=not_planned` | closed |

## Steps

### Step 1: Post the answer

Comment on #2538, covering:
- The documented semantics (quote `types.ts:35-40`): the callback marks the
  end of exit *animations*; unmount is the React commit that follows.
- Why it's ordered this way (the callback fires in the same pass that
  schedules the removal commit; deferring it to post-commit would delay it by
  a React render and change semantics for existing users).
- Workarounds for post-unmount work: do cleanup in the child's own
  `useEffect` cleanup (it runs on the actual unmount, as their log shows), or
  flag state in `onExitComplete` and react to it in an effect that runs after
  the next commit.
- Invite the maintainer/reporter to say if post-unmount timing is genuinely
  needed as an option (see Step 3 note).

### Step 2: Gated close

Close as `state_reason=not_planned` (works-as-documented) ONLY if this plan's
row in `plans/issues/README.md` is APPROVED (or APPROVED-CLOSE). Otherwise set
the row to BLOCKED("awaiting maintainer decision: by-design close vs deferral
change") and stop.

### Step 3: Optional opt-in change (only on an explicit APPROVED-IMPLEMENT row)

If the maintainer instead wants `onExitComplete` deferred until after the
removal commit: move the invocation out of `onExit` into the existing
`useIsomorphicLayoutEffect` (`index.tsx:102-121`) — fire a pending flag in
`onExit`, then call `onExitComplete` from the effect when it observes
`renderedChildren` equal to `pendingPresentChildren.current` with the flag
set. Requirements if taken:
- Failing-test-first: a Jest test asserting the child's `useEffect` cleanup
  runs BEFORE `onExitComplete` (this is the reporter's exact observation and
  will fail on current main).
- Audit every existing test referencing `onExitComplete`
  (`grep -rn "onExitComplete" packages/framer-motion/src packages/framer-motion/cypress`)
  — e.g. "Fires onExitComplete during rapid key switches…"
  (`AnimatePresence.test.tsx:1320`) and the Cypress
  `animate-presence-exit-complete-multiple.ts` — all must still pass.
- CHANGELOG entry flagging the timing change prominently.
- STOP if any existing test depends on the pre-commit timing in a way that
  looks intentional — report instead of forcing it.

## Done criteria

- [ ] Answer comment posted quoting the documented contract
- [ ] Close only under APPROVED row; else row BLOCKED with the decision ask
- [ ] If (and only if) APPROVED-IMPLEMENT: failing-first test + change + green suites + CHANGELOG
- [ ] `git status` clean on the answer-only path

## STOP conditions

- README row not APPROVED at Step 2 (set BLOCKED, stop).
- Opt-in path: any existing `onExitComplete` test depends on current timing
  by design.
- The `index.tsx:205-212` excerpt has drifted.
- Issue already closed at drift-check.
