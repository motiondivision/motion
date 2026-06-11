# Plan issue-2509: Close stale `useInView` docs report (examples already corrected on motion.dev)

> **Executor instructions**: Verification + housekeeping only; no code
> changes. On any STOP condition, stop and report. When done, update the
> status row for this issue in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2509 --jq .state` → must be `open`.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2509

## Why this matters

2024 report: two code examples on the then-current docs page
(`framer.com/motion/use-in-view` — the `root` and `margin` sections) called
`useInView(options)` without the required `ref` first argument. The docs have
since migrated to motion.dev and **both examples are already corrected**
(verified 2026-06-11 at https://motion.dev/docs/react-use-in-view: the root
example reads `useInView(ref, { root: container })`, the margin example reads
`useInView(ref, { margin: "0px 100px -50px 0px" })`). Docs content lives
outside this repository, and the in-repo source
(`packages/framer-motion/src/utils/use-in-view.ts`) carries no JSDoc examples
that could repeat the error. Nothing remains actionable here; the issue
should be closed so triage stops re-reading it.

## Current state

- `packages/framer-motion/src/utils/use-in-view.ts:14-23` — signature is
  `useInView(ref, options?)`; the file contains no JSDoc usage examples
  (verified at planning: no `@example`/code blocks anywhere in the file).
- motion.dev docs page (external repo) — both flagged examples corrected, as
  quoted above.
- Repo convention (`plans/README.md`, "Findings considered and rejected"):
  docs-only findings are out of scope for plans here because motion.dev docs
  live outside this repository.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Re-verify docs | fetch https://motion.dev/docs/react-use-in-view (WebFetch or browser) | both `root` and `margin` examples pass `ref` first |
| Re-verify no in-repo JSDoc | `grep -n "@example\|useInView({" packages/framer-motion/src/utils/use-in-view.ts` | no matches |
| Comment | `gh api repos/motiondivision/motion/issues/2509/comments -f body="…"` | created |
| Close | `gh api -X PATCH repos/motiondivision/motion/issues/2509 -f state=closed -f state_reason=completed` | closed |

## Scope

**In scope**: the two re-verifications, one comment, gated close.
**Out of scope**: any edits in this repo; the motion.dev docs repo.

## Steps

### Step 1: Re-verify both facts

Run the two verification commands above. Both flagged examples on the live
page must include `ref` as the first argument, and the in-repo hook must have
no example-bearing JSDoc.

**Verify**: as stated; if either check fails, see STOP conditions.

### Step 2: Comment

Thank the reporter; state both examples were fixed in the docs migration to
motion.dev (link the page and quote the corrected `root` example); note docs
content now lives outside this repo and future docs issues are best filed
against the docs.

**Verify**: comment visible.

### Step 3: Close (GATED)

Only if the row for issue-2509 in `plans/issues/README.md` reads `APPROVED`:
close with `state_reason=completed`.

**Verify**: `gh api repos/motiondivision/motion/issues/2509 --jq .state` → `closed`.

## Done criteria

- [ ] Both verifications recorded in the comment
- [ ] Close performed only with APPROVED gate
- [ ] `git status` clean
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- The live motion.dev page still (or again) shows a ref-less call → the docs
  regression is real but unfixable from this repo; report so the maintainer
  routes it to the docs repo, and do not close as completed.
- README row not `APPROVED` → stop after Step 2.

## Maintenance notes

- None — no in-repo surface involved.
