# Plan issue-2684: Verify rapid tab-switch exit bug is fixed by the 12.36.0 wait-mode fix, then close or escalate

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2684 --jq .state` → expect `open`.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (verification only; no source changes authorized)
- **Depends on**: none
- **Category**: bug (verify-fixed)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2684

## Why this matters

Reported May 2024 on framer-motion 11.2.6: in a `mode="wait"` tabs UI,
switching A→B→A quickly leaves the content blank — exit never runs, new
content never appears. A commenter identified it as the same bug as #2554
("AnimatePresence gets stuck when state changes quickly", closed 2024-07).
Since then the exact failure mode was fixed on main: commit `10427ae38`
"Fix AnimatePresence stuck when state changes too fast in mode='wait'",
released in **12.36.0** (CHANGELOG line 78: "`AnimatePresence`: Prevent
`mode=\"wait\"` elements from getting stuck when switched rapidly."). This
plan verifies on current main and closes the loop on the issue.

## Current state

- The issue's CodeSandbox (`x772fv`, a fork of the framer tabs demo) was
  **Cloudflare-blocked from the planning environment** — retry once; the
  scenario is fully reconstructible: `<AnimatePresence mode="wait">` with one
  keyed `motion.div` per selected tab (`initial={{ y: 10, opacity: 0 }}`,
  `animate={{ y: 0, opacity: 1 }}`, `exit={{ y: -10, opacity: 0 }}` in the
  original demo), and rapid clicks Tomato → Lettuce → Tomato.
- Existing regression tests on main that cover this class
  (`packages/framer-motion/src/components/AnimatePresence/__tests__/AnimatePresence.test.tsx`):
  - line 1571: "Does not get stuck when state changes cause rapid key alternation in mode='wait'"
  - line 1649: "Shows latest child after rapid key switches in mode='wait'"
  - line 412: "Fast animations with wait render the child content correctly"
  Read them and `git show 10427ae38` to confirm they encode A→B→A-quickly.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Jest | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence"` | pass |
| Issue close (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2684 -f state=closed -f state_reason=completed` | closed |

## Steps

### Step 1: Confirm coverage matches the report

Read the three tests listed above. The reported sequence is: click B while
A's exit hasn't started/finished, then click A again *during* B's enter/A's
exit. If none of the existing tests alternates back to the ORIGINAL key
mid-exit, write a throwaway local Jest test (do not commit yet) doing exactly
A→B→A with `mode="wait"`, short durations, asserting the final committed DOM
shows A's content. Run it on current main.

**Verify**: test passes on `42bfbe3ed`. If it FAILS → STOP: this issue is
not fixed; report back with the failing test so it can be re-planned as a FIX
(coordinate with `issue-2416.md`'s opacity-exit family — same cluster).

### Step 2: Comment on the issue

Post: fixed by `10427ae38`, released in motion `12.36.0` (2026-03-09); the
report was against 11.2.6; existing regression tests named above; ask the
reporter to upgrade and confirm. Mention #2554 was the tracked duplicate.

### Step 3: Gated close

If this plan's row in `plans/issues/README.md` is marked APPROVED (or
APPROVED-CLOSE) → close with the command above (`state_reason=completed`).
Otherwise set the row to BLOCKED("awaiting maintainer close approval") and
stop. Only commit a new regression test if Step 1 revealed a coverage gap AND
the test exercises the real scenario (no speculative happy-path padding —
repo policy).

## Done criteria

- [ ] Step 1 verification run recorded (pass = fixed; fail = STOP/report)
- [ ] Comment posted with fix commit + version
- [ ] Close executed only under an APPROVED row; else row set BLOCKED
- [ ] No source files modified (`git status` clean apart from any approved test)

## STOP conditions

- Step 1's A→B→A test fails on current main.
- Issue already closed at drift-check time.
- README row not APPROVED when reaching Step 3 (set BLOCKED, stop).
