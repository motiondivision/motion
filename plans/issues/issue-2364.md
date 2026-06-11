# Plan issue-2364: Close stale "opacity delayed on Vercel+Chrome reload" report (needs re-repro on motion@12)

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2364 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support/close (NEEDS-REPRO)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2364

## Verdict: NEEDS-REPRO — stale, ask for re-test then close

Filed Oct 2023: framer-motion **10.16.4** + Next 13.5 on Vercel, Chrome-only,
opacity animation visually delayed on reload; not reproducible in CodeSandbox.
Evidence this is stale and/or environmental:

- The maintainer's only diagnosis (2024-01-05) points at a **Chromium** bug for
  contentless pages (crbug 1406850: paint holding/deferred first paint) and
  asked the reporter to add text content — **no response from the reporter in
  over two years**.
- The implicated subsystem (optimized appear / hydration handoff,
  `packages/framer-motion/src/animation/optimized-appear/` and the handoff path
  now in `packages/motion-dom/src/animation/interfaces/visual-element-target.ts:117`)
  has been rewritten repeatedly since 10.16.4 (e.g. commits `596e0eee8`
  "Refactor animation APIs", `ea266671d` "Move animateVisualElement and
  dependencies to motion-dom"). Any 10.x-era timing behaviour is obsolete.
- The repro is a live Vercel deployment pinned to 2023 dependencies — it cannot
  validate a fix against today's code, and there is no failing test we could
  write (repo policy: no repro → no fix).

## Steps

### Step 1: Check for fresh activity

`gh api repos/motiondivision/motion/issues/2364/comments --jq '.[-2:][] | {user:.user.login, created:.created_at}'`
— if anyone reproduced on `motion@12.x` since 2025, reclassify (report back,
do not close).

### Step 2: Approval gate

Open `plans/issues/README.md` and find the row for issue-2364. If the row is
not marked APPROVED, set this plan's status to BLOCKED in
`plans/issues/README.md` and stop.

### Step 3: Comment + close

```
gh api repos/motiondivision/motion/issues/2364/comments -f body="Closing as stale: this was reported against framer-motion 10.16.4 and the appear/hydration animation pipeline has been rewritten several times since. The behaviour described also matches a Chromium first-paint-holding issue on contentless pages rather than a Motion bug, and we never received the requested follow-up. If you can still reproduce on current motion@12 (ideally with a minimal repo/StackBlitz), please open a new issue and we'll dig in."
gh api -X PATCH repos/motiondivision/motion/issues/2364 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2364 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned`
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Step 1 reveals a recent reproduction on motion@12 — this becomes a real
  investigation (Cypress/Playwright against optimized-appear), not a close.
