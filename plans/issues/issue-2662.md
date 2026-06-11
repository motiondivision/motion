# Plan issue-2662: Close Next.js `experimental.taint: true` animation report (env-specific, dev-only, stale)

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2662 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support/close (NEEDS-REPRO)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2662

## Verdict: NEEDS-REPRO / environment — close as stale

Filed May 2024: with `experimental: { taint: true }` in `next.config.js`,
certain framer-motion animations stop working — **in development only, not in
production**. Two users confirmed the same symptom; nobody identified a Motion
code path. Why this is not actionable here:

- React's taint API (`experimental_taintObjectReference`) changes how
  **React/Next dev mode** deep-freezes and tracks objects crossing the
  server/client boundary; a dev-only behavioural difference under an
  experimental Next flag is squarely a Next/React integration concern. No
  stack trace, error message, or Motion symbol was ever reported.
- The CodeSandbox repro pins 2024-era Next 14 + framer-motion 11; both the
  experimental flag semantics and Motion's animation-state pipeline have moved
  substantially since.
- Repo policy: no repro that implicates Motion → no fix. We cannot write a
  failing test for "Next dev server with taint:true" inside this repo's test
  infrastructure (Jest/Cypress against dev/react, no Next dev-mode harness for
  taint).

## Steps

### Step 1: Check for fresh activity

`gh api repos/motiondivision/motion/issues/2662/comments --jq '.[] | {user:.user.login, created:.created_at}'`
— last known comments are 2024-05/2024-06. If a 2025+ comment reproduces on
current Next + motion@12, report back instead of closing.

### Step 2: Approval gate

Open `plans/issues/README.md` and find the row for issue-2662. If the row is
not marked APPROVED, set this plan's status to BLOCKED in
`plans/issues/README.md` and stop.

### Step 3: Comment + close

```
gh api repos/motiondivision/motion/issues/2662/comments -f body="Closing as stale/environmental. taint: true changes how React/Next dev mode handles objects crossing the server/client boundary, the symptom was dev-only, and no Motion error or code path was ever identified — so there's nothing actionable on the Motion side from this report. If this still reproduces with a current Next release and motion@12, please open a new issue with the dev-console output and a minimal repro and we'll take another look."
gh api -X PATCH repos/motiondivision/motion/issues/2662 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2662 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned`
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Fresh reproduction on current versions, or any comment identifying a concrete
  Motion code path (e.g. a frozen/tainted object Motion mutates) — that would
  make this a real bug to investigate.
