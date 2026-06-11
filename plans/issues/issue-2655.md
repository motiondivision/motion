# Plan issue-2655: Close "not part of the THREE namespace" report (framer-motion-3d removed from this repo)

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2655 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support/close
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2655

## Verdict: INVALID/SUPPORT — close (package removed/deprecated)

Filed May 2024 against `framer-motion-3d` + React Three Fiber: R3F throws
`R3F: BoxGeometry is not part of the THREE namespace! Did you forget to extend?`
unless the user manually `extend()`s core THREE classes. Zero comments since.
Why close:

- **The code no longer lives in this repository.** `ls packages/` at
  `42bfbe3ed` shows only `config`, `framer-motion`, `motion`, `motion-dom`,
  `motion-utils`. CHANGELOG.md under `## [12.5.0] 2025-03-11` records:
  "Removed `framer-motion-3d` package." (CHANGELOG.md lines 1080–1088). The
  package is deprecated and unmaintained; there is no source here to fix and
  no test harness for it.
- The symptom itself is an R3F catalogue/namespace behaviour: when the
  three/R3F version pairing changes (or multiple `three` instances are
  installed), R3F's auto-extended catalogue misses classes and requires manual
  `extend({ BoxGeometry, ... })` — the workaround the reporter already uses.
  Nothing in Motion's animation layer produces that error.

## Steps

### Step 1: Approval gate

Open `plans/issues/README.md` and find the row for issue-2655. If the row is
not marked APPROVED, set this plan's status to BLOCKED in
`plans/issues/README.md` and stop.

### Step 2: Comment + close

```
gh api repos/motiondivision/motion/issues/2655/comments -f body="Closing: framer-motion-3d was deprecated and removed from this repository in motion 12.5.0, so this isn't fixable here. The error itself comes from React Three Fiber's class catalogue (typically a three/R3F version pairing or duplicate three instances) and manually calling extend(), as you're doing, is the supported R3F answer. For new 3D work we recommend using R3F directly with motion values, or community-maintained successors to framer-motion-3d."
gh api -X PATCH repos/motiondivision/motion/issues/2655 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2655 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned`
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- `framer-motion-3d` reappears in `packages/` (it will not at `42bfbe3ed`, but
  re-check after the drift check) — then this is a real triage against that
  package instead of a close.
