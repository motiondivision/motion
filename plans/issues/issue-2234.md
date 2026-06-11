# Plan issue-2234: Verify wait-mode "new element stuck at opacity 0" is fixed on current main, then close or escalate

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2234 --jq .state` → expect `open`.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (verification only)
- **Depends on**: none
- **Category**: bug (verify-fixed)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2234

## Why this matters

Reported July 2023 (framer-motion v10 era): an onboarding flow swaps keyed
steps inside `AnimatePresence`; the old step exits but the NEW step never
leaves its enter state — it stays at opacity 0 until a hot reload. This is
the oldest issue in the stuck-presence family. The implementation has been
rewritten since, with direct regression tests for stuck/missed enters after
key switches (12.36.0's "Prevent `mode=\"wait\"` elements from getting stuck
when switched rapidly", `10427ae38`; plus re-entry fixes `6a8d3abb9`,
`05842be0d`, `3497306f8`). Probability this still reproduces is low; verify
and close the loop.

## Current state

- The issue's StackBlitz (`vite-react-ts-et84nk`, file `src/Onboarding.tsx`)
  could **not be fetched from the planning environment** (StackBlitz serves an
  SPA shell; no code in the page). Retry once via WebFetch. Reconstruction
  from the issue text: an onboarding container; step content keyed by step
  index inside `<AnimatePresence>` (likely `mode="wait"`); old content slides
  out left (`exit={{ x: -..., opacity: 0 }}`), new content slides in from the
  right (`initial={{ x: ..., opacity: 0 }}`, `animate={{ x: 0, opacity: 1 }}`);
  clicking "next" once triggers the bug — new content stays at opacity 0.
- Existing tests on main covering this class
  (`packages/framer-motion/src/components/AnimatePresence/__tests__/AnimatePresence.test.tsx`):
  line 350 "Only renders one child at a time if mode === 'wait'",
  line 412 "Fast animations with wait render the child content correctly",
  line 1649 "Shows latest child after rapid key switches in mode='wait'",
  line 1395 "Re-entering child replays enter animation when exit was complete".

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Jest | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence"` | pass |
| Issue close (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2234 -f state=closed -f state_reason=completed` | closed |

## Steps

### Step 1: Reproduce the single-switch scenario in a throwaway Jest test

Note the difference from the rapid-switch tests: this report is a SINGLE
step change (not rapid alternation). Write a local (uncommitted) Jest test:
`mode="wait"`, child A (key "1") → rerender child B (key "2") with
`initial={{ opacity: 0, x: 50 }}`, `animate={{ opacity: 1, x: 0 }}`, A has
`exit={{ opacity: 0, x: -50 }}`; finite small durations; after A's exit
completes and frames flush (use the `nextFrame` helper pattern from
neighboring tests), assert B's element has opacity ≈ 1 (or at minimum that an
animation drove it above 0). JSDOM runs the JS fallback path, which is the
relevant one for this 2023-era report.

**Verify**: passes on `42bfbe3ed`. If it FAILS → STOP and report with the
failing test (re-plan as FIX; cross-reference `issue-2416.md`'s opacity
family).

### Step 2: Optional browser sanity check

If you want browser-grade confidence cheaply, reuse an existing wait-mode
Cypress spec run (e.g. `animate-presence-switch-waapi.ts`) via the CLAUDE.md
recipe on React 18. Skip if Step 1 is conclusive.

### Step 3: Comment + gated close

Comment on #2234: not reproducible at 12.40.0 (`42bfbe3ed`); name the
shipped fixes (`10427ae38` / 12.36.0 wait-mode stuck fix; re-entry fixes
`6a8d3abb9`, `05842be0d`) and the regression tests; report was against v10;
ask reporter to confirm on ≥12.40.0. Close with `state_reason=completed`
ONLY if this plan's row in `plans/issues/README.md` is APPROVED (or
APPROVED-CLOSE); otherwise set the row BLOCKED("awaiting maintainer close
approval") and stop. Do not commit the throwaway test (no speculative
coverage — repo policy) unless the maintainer asks.

## Done criteria

- [ ] Step 1 outcome recorded (pass = fixed; fail = STOP)
- [ ] Comment posted with commits/versions
- [ ] Close only under APPROVED row; else BLOCKED
- [ ] `git status` clean (throwaway test removed)

## STOP conditions

- Step 1 fails on current main.
- Issue already closed at drift-check.
- README row not APPROVED at Step 3.
