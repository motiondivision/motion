# Plan issue-2676: Close "upgrade the examples to latest package version" — the examples don't live in this repo

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2676 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs / invalid-here
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2676

## Verdict: INVALID-here — refers to CodeSandbox examples embedded in the old framer.com docs

Filed 2024-05-19: the CodeSandbox examples linked from the then-current docs
(e.g. the notifications example `framer-motion-notifications-5cvo9`, pinned to
framer-motion 1.1.0–6.5.1) behaved differently from the latest package.

Facts:

- Those sandboxes were hosted on CodeSandbox and embedded in the **old
  framer.com/motion docs**. They are not files in this repository: the only
  in-repo "examples" are the internal dev playgrounds
  (`dev/react/src/examples/`, `dev/html/public/`), which track workspace
  versions automatically and are not what the issue refers to.
- The docs have since been fully rewritten and rehosted at **motion.dev**
  (maintained outside this repo), with new examples (examples.motion.dev)
  built against current versions. The complained-about pages no longer exist
  as the project's documentation.
- The single comment (malmz, 2024-07-12) reports a *separate* possible
  regression: with 11.3.0, the image-gallery example's enter animation
  sometimes runs twice when swiping quickly. That has no reproduction against
  a current version and is unrelated to "upgrade the examples" — it needs its
  own issue if still reproducible.

## Steps

### Step 1: Approval gate

Open `plans/issues/README.md`, find the issue-2676 row. If not APPROVED, mark
this plan BLOCKED and stop.

### Step 2: Comment + close

```
gh api repos/motiondivision/motion/issues/2676/comments -f body="Closing: the examples this refers to were CodeSandbox embeds in the old framer.com docs, which don't live in this repository. The documentation has since been rewritten at motion.dev with examples built against current versions of the library. If you spot a specific outdated or broken example on motion.dev today, please report that example directly. @malmz — the quick-swipe double enter animation you mention would be a library bug rather than a docs issue; if it still reproduces on motion@12, please open a new issue with a minimal repro."
gh api -X PATCH repos/motiondivision/motion/issues/2676 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2676 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned` (only after APPROVED)
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- README row not APPROVED → BLOCKED.
