# Plan issue-2642: Close "Module not found: Can't resolve 'framer-motion'" (user environment, no repro)

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2642 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support/close
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2642

## Verdict: INVALID/SUPPORT — close

Filed April 2024 against Next 14/React 18: `Module not found: Can't resolve
'framer-motion'` after install. Evidence consists of two screenshots of the
user's editor; the issue template's required CodeSandbox reproduction was never
provided ("Without one, this bug report won't be accepted" is quoted verbatim
and left unanswered in the body). "Module not found" at bundler level is a
local install/resolution problem (wrong workspace, stale lockfile, missing
node_modules), not a library defect — the package's exports map is exercised by
every CI consumer in this repo (`dev/next`, `dev/react`). The two comments are
workarounds/usage tips (re-exporting `motion.li` from a `"use client"` file;
using `motion/react-client` in Server Components per the docs), i.e. support
content, not a bug trail.

## Steps

### Step 1: Check for fresh activity

`gh api repos/motiondivision/motion/issues/2642/comments --jq '.[] | {user:.user.login, created:.created_at}'`
— if a 2025+ comment supplies an actual reproduction of a resolution failure
against the published `motion`/`framer-motion` package, report back instead of
closing.

### Step 2: Approval gate

Open `plans/issues/README.md` and find the row for issue-2642. If the row is
not marked APPROVED, set this plan's status to BLOCKED in
`plans/issues/README.md` and stop.

### Step 3: Comment + close

```
gh api repos/motiondivision/motion/issues/2642/comments -f body="Closing: 'Module not found' at the bundler level points to a local install/resolution issue (lockfile, workspace, or node_modules state) rather than a package defect, and the required minimal reproduction was never provided. For React Server Components, note the documented import: import * as motion from \"motion/react-client\" (https://motion.dev/docs/react-motion-component#usage). If you can reproduce a resolution failure in a fresh CodeSandbox/StackBlitz with current motion@12, please open a new issue."
gh api -X PATCH repos/motiondivision/motion/issues/2642 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2642 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned`
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- A reproduction surfaces showing the published package's `exports` map failing
  under a mainstream bundler — that becomes a packaging bug (check
  `packages/framer-motion/package.json` / `packages/motion/package.json`
  exports), not a close.
