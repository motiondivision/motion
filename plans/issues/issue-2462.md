# Plan issue-2462: Verify out-of-order exits during fast renders are fixed on current main; correct the thread's wrong "fixed by #2477" claim

> **Executor instructions**: Follow step by step; run every verification
> command. STOP conditions are binding. When done, update (or add) this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2462 --jq .state` → expect `open`.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (verification only)
- **Depends on**: none
- **Category**: bug (verify-fixed)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2462

## Why this matters

Reported Jan 2024: items inside `<AnimatePresence>` exit out of order when
renders happen fast (toast-like list; rapid "Add" clicks; items jump over each
other / disappear early). A 2026-05 drive-by AI triage comment claims this was
"already fixed in main by #2477". **That claim is wrong and must be corrected
on the thread**: `f83739f9c` ("Ensure AnimatePresence executes exiting
animations in sequence (#2477)") was merged 2024-07-24 and **reverted the same
day** by `2870768a6` (PR #2740). However, AnimatePresence was rewritten since,
and current main carries a direct regression test for this exact scenario —
so the issue is very likely fixed, just not by #2477.

## Current state

- Existing regression test on main:
  `packages/framer-motion/src/components/AnimatePresence/__tests__/AnimatePresence.test.tsx:487`
  — `test("Elements exit in sequence during fast renders", ...)`: renders
  keys `[0,1,2,3]`, removes the head item at t=100/250/400ms with 10ms exit
  durations, and asserts the surviving DOM order `[1,2,3]` → `[2,3]` → `[3]`
  100ms after each removal. Verified present at planning time.
- Git facts to cite on the thread:
  - `f83739f9c` (2024-07-24) — #2477 merged.
  - `2870768a6` (2024-07-24) — #2477 reverted (#2740).
- The issue's CodeSandbox (`q35pmx`) was **Cloudflare-blocked from the
  planning environment**; retry once. Reconstruction if needed: a list where
  clicking "Add" appends an item and each item self-removes (or older items
  are removed) on a timer, items have `exit` + `layout`-free opacity fades;
  rapid adds; observe exit ordering.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Jest (targeted) | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence" -t "Elements exit in sequence"` | 1 test passes |
| Issue close (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2462 -f state=closed -f state_reason=completed` | closed |

## Steps

### Step 1: Run the existing regression test on `42bfbe3ed`

Command above. **Verify**: passes. If it fails → STOP and report (the test
itself would then be the failing repro; re-plan as FIX).

### Step 2: Stress variant (honesty check, throwaway)

The existing test removes one item at a time with generous gaps. Locally (do
not commit) tighten it toward the report: overlap removals so a new exit
starts while 2+ previous exits are mid-flight (e.g. remove at t=0/20/40ms with
200ms exits) and assert DOM order remains monotonic (each snapshot is a suffix
of the previous). Run 2–3 variations max.

**Verify**: variations pass. Any failure → STOP and report with the failing
test (becomes the FIX repro; check whether `exitComplete` insertion order in
`index.tsx:88-121` is the culprit before reporting).

### Step 3: Comment on the issue

Post: (a) correction — #2477 was reverted same-day by #2740, the drive-by
"already fixed by #2477" claim is inaccurate as stated; (b) the scenario IS
covered and passing on current main via the named regression test (link the
file/line) following the AnimatePresence rework; (c) tested at 12.40.0
(`42bfbe3ed`); ask the reporter to confirm on ≥12.40.0.

### Step 4: Gated close

Only if this plan's row in `plans/issues/README.md` is APPROVED (or
APPROVED-CLOSE): close with `state_reason=completed`. Otherwise set the row
to BLOCKED("awaiting maintainer close approval") and stop.

## Done criteria

- [ ] Step 1 + Step 2 outcomes recorded (pass/pass, or STOP)
- [ ] Correction + evidence comment posted
- [ ] Close only under APPROVED row; else BLOCKED
- [ ] No committed source changes (`git status` clean)

## STOP conditions

- Step 1 or Step 2 produces a genuine failure on current main.
- Issue already closed at drift-check.
- README row not APPROVED at Step 4.
