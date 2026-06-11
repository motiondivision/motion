# Plan issue-2578: Verify SVG `<text>` MotionValue children are fixed and close #2578

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update
> the status row for this plan in `plans/issues/README.md`.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2578 --jq .state`
> → expected `open`. If closed, mark the README row DONE (already handled)
> and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (already fixed on main — verification + close)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2578

## Why this matters

Reported 2024: a MotionValue passed as children to `motion.text` (SVG) was
serialized into a `children` *attribute* instead of updating text content,
so animated counters inside SVG never rendered. The reporter
(@simonkarman) submitted PR #2841, which **was merged**: commit
`7c6653422` ("SVG elements (like motion.text) now update when given a
MotionValue as children, matching HTML element behavior (#2841)"), on main
since **v11.13.1 (2024-12-03)** — verify with
`git tag --contains 7c6653422 | head -1`. The issue was never closed.
Closing stale-but-fixed issues keeps the tracker honest.

## Current state

- The fix lives in `packages/motion-dom/src/render/dom/DOMVisualElement.ts:42-57`
  (`handleChildMotionValue` subscribes to the children MotionValue and writes
  `this.current.textContent`), called from
  `packages/motion-dom/src/render/VisualElement.ts:750-751`. It sits on
  `DOMVisualElement`, the shared base of HTML **and** SVG visual elements —
  exactly the "moved the logic up" fix described in the issue thread.
- Initial render handled in
  `packages/framer-motion/src/render/dom/use-render.ts:51-55`
  (`isMotionValue(children) ? children.get() : children`).
- Regression tests already exist and run in CI:
  `packages/framer-motion/src/motion/__tests__/child-motion-value.test.tsx`
  — including "accepts motion values as children for motion.text inside an
  svg" and "updates svg text when motion value changes".
- Thread also reports (Xentox-Phil, 2024-11-15) `useMotionTemplate` output
  passed to a `motion.rect` `transform` attribute rendering nothing — that
  was fixed separately by commit `d79e0d4ce` ("Fix MotionValues rendering as
  [object Object] on SVG transform attribute"), also on main.
- Interaction with PR #3749 (`worktree-style-effect`): the branch modifies
  `DOMVisualElement.ts` (+52) but `child-motion-value.test.tsx` remains the
  regression gate; no action needed here.

## Commands you will need

| Purpose | Command (repo root) | Expected |
|---|---|---|
| Confirm fix commit on main | `git merge-base --is-ancestor 7c6653422 main && echo ON-MAIN` | `ON-MAIN` |
| Run regression tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="child-motion-value"` | all pass (4+ tests) |
| Close issue | `gh api -X PATCH repos/motiondivision/motion/issues/2578 -f state=closed -f state_reason=completed` | state `closed` |

(Note: `gh issue close`/`gh pr edit` may fail on this repo — use `gh api -X PATCH` as above.)

## Scope

**In scope**: running the verification commands; posting a closing comment;
closing the issue (gated — see below).

**Out of scope**: any source change. Do not add new tests — coverage exists.
Do not touch `DOMVisualElement.ts`.

## Steps

### Step 1: Verify the fix and tests on current main

Run the first two commands above.

**Verify**: `ON-MAIN` printed; Jest passes all `child-motion-value` tests.

### Step 2: Comment and close (GATED)

Only if the `plans/issues/README.md` row for this plan is marked APPROVED:

1. Post a comment via
   `gh api repos/motiondivision/motion/issues/2578/comments -f body="..."`
   stating: fixed by #2841 (released in v11.13.1); the secondary
   `useMotionTemplate`-on-`transform`-attribute report was fixed by
   `d79e0d4ce`; regression-tested in `child-motion-value.test.tsx`; please
   reopen with a repro on motion@12 if it still occurs.
2. Close: `gh api -X PATCH repos/motiondivision/motion/issues/2578 -f state=closed -f state_reason=completed`

If the row is not APPROVED, mark it BLOCKED ("verified fixed; awaiting
close approval") and stop.

## Done criteria

- [ ] `child-motion-value` Jest suite green on current main
- [ ] Issue closed with explanatory comment (or README row BLOCKED awaiting approval)
- [ ] `plans/issues/README.md` status row updated
- [ ] `git status` clean — no source files modified

## STOP conditions

- Any `child-motion-value` test fails on main — the fix regressed; report
  (this becomes a FIX plan, not a close).
- `7c6653422` is not an ancestor of main (history rewritten — re-verify).

## Maintenance notes

- If #3749's `DOMVisualElement` changes ever drop `handleChildMotionValue`,
  `child-motion-value.test.tsx` will catch it — do not weaken those tests.
