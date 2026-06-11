# Plan issue-2268: Close Cypress `addListener` crash report (framer-motion v6, unsupported; guarded in current code)

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2268 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support/close
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2268

## Verdict: INVALID/SUPPORT — close (ancient version + broken test env)

Filed July 2023 against **framer-motion 6.5.1** (pinned deliberately for React
16 compat): every Cypress component test rendering a `motion.*` element throws
`TypeError: Cannot read properties of undefined (reading 'addListener')` at
`initPrefersReducedMotion`. The reporter themselves says "I realize this could
be on my end". Zero comments since. Why close:

- The crash means `window.matchMedia("(prefers-reduced-motion)")` returned
  `undefined` in their Cypress component-test environment — a stubbed/broken
  `matchMedia`, since the real browser API always returns a `MediaQueryList`.
  That's a test-environment defect, not a library one.
- Current code (verified at `42bfbe3ed`,
  `packages/motion-dom/src/render/utils/reduced-motion/index.ts:3-19`) is
  hardened: `const isBrowser = typeof window !== "undefined"`, an
  `if (window.matchMedia)` feature check, and `addEventListener("change", ...)`
  instead of v6's `addListener`.
- framer-motion v6 is years out of support; per repo policy there is no fix to
  ship for it and no failing test to write against current code (this repo's
  own Cypress suite renders motion components in every spec without issue).

## Steps

### Step 1: Approval gate

Open `plans/issues/README.md` and find the row for issue-2268. If the row is
not marked APPROVED, set this plan's status to BLOCKED in
`plans/issues/README.md` and stop.

### Step 2: Comment + close

```
gh api repos/motiondivision/motion/issues/2268/comments -f body="Closing: this trace means window.matchMedia(...) returned undefined in the Cypress component-test environment (a stubbed/incomplete matchMedia), which a real browser never does — so it's a test-environment issue rather than a library bug. It was also reported against framer-motion 6.5.1, which is long out of support; the reduced-motion init in current versions feature-checks matchMedia and uses addEventListener. If you hit anything similar on motion@12, please open a new issue with a repro."
gh api -X PATCH repos/motiondivision/motion/issues/2268 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2268 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned`
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Recent comments show the same crash on motion@12 — re-check
  `packages/motion-dom/src/render/utils/reduced-motion/index.ts` (note: it
  still assumes `matchMedia()` returns an object when `window.matchMedia`
  exists; a hostile stub returning `undefined` would still throw — that would
  then be a small defensive FIX, related to the issue-3735 guard work).
