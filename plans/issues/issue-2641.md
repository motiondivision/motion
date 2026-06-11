# Plan issue-2641: Close `transform: none` report as intended behaviour (no repro of breakage)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report. When done, update
> the status row for this plan in `plans/issues/README.md`.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2641 --jq .state`
> → expected `open`. If closed, mark the README row DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (see relationship to plans/issues/pr-3728.md below)
- **Category**: support / needs-repro (recommend close as not_planned)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2641

## Why this matters

The issue title claims "Animation Doesn't work (A Transform:none style adding
to the motion component)" but provides **no sandbox and no observed-vs-
expected description of the failure** — only JSX for a `motion.nav`
(`initial={{ translateY: "-100%", scaleY: 0.8 }}` → `animate={{ translateY: 0, scaleY: 1 }}`)
plus Tailwind classes, and the observation that the element ends with
`style="transform: none;"`. The single corroborating comment (ulmetum,
2024-11-28) actually states the opposite of the title: *"The animation
completes correctly but at the end, a transform: none is added."*
`transform: none` at animation end is **intended behaviour**, and per repo
policy (no repro → no fix) this should be closed as a support issue with an
explanation, not "fixed".

## Current state

- The `none` reset is deliberate, in both pipelines:
  - `packages/motion-dom/src/render/html/utils/build-transform.ts:86-88`:
    ```ts
    } else if (transformIsDefault) {
        transformString = "none"
    }
    ```
  - `packages/motion-dom/src/render/html/utils/build-styles.ts:59-65`: when a
    previously-built transform exists but no transform values remain,
    `style.transform = "none"` ("If we have previously created a transform
    but currently don't have any, reset transform style to none").
  - Same logic in the effects pipeline:
    `packages/motion-dom/src/effects/style/transform.ts:52`.
- It is regression-tested: `packages/framer-motion/src/render/html/utils/__tests__/build-transform.test.ts`
  ("Outputs 'none' when all values are default"). Changing it is a behaviour
  change, not a bug fix.
- Why it exists: when all tracked transforms are at their defaults
  (`translateY: 0`, `scaleY: 1`), the built string would be empty; writing
  `none` guarantees motion's inline transform fully releases any previous
  inline value rather than leaving a stale frame behind.
- The one *legitimate* gripe hiding in this issue class: an inline
  `transform: none` overrides transforms supplied by CSS classes (e.g.
  Tailwind `-translate-x-1/2` centering), because inline style beats class.
  In the reported JSX there are **no transform classes** on the nav, so even
  that doesn't apply here. The class/literal-transform composition story is
  tracked separately: PR #3728 (plans/issues/pr-3728.md) fixes the
  drag-vs-literal-transform case, and its "Maintenance notes" records the
  known limitation that literal transform strings are replaced, not merged.
  Do not duplicate that work here.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Confirm intent is tested | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="build-transform"` | pass, incl. "Outputs 'none' when all values are default" |
| Close issue (gated) | `gh api -X PATCH repos/motiondivision/motion/issues/2641 -f state=closed -f state_reason=not_planned` | closed |

## Scope

**In scope**: verification run; closing comment; close (gated).

**Out of scope**: ANY source change. Specifically do not touch
`build-transform.ts`, `build-styles.ts`, or `effects/style/transform.ts` —
removing the `none` reset would regress the stale-inline-transform behaviour
those lines exist to prevent, and #3749 is about to rework these files anyway.

## Steps

### Step 1: Verify the behaviour is intended and covered

Run the Jest command above.

**Verify**: suite passes, including the `'none'`-when-default test.

### Step 2: Comment and close (GATED)

Only if the `plans/issues/README.md` row for this plan is APPROVED, post a
comment (via `gh api repos/motiondivision/motion/issues/2641/comments -f body="..."`)
covering:

1. `transform: none` at the end of an animation whose values resolve to
   defaults (`translateY: 0`, `scaleY: 1`) is intentional — it releases
   motion's inline transform; it does not disable the animation, which runs
   to completion first (as the thread's own comment confirms).
2. Caveat for CSS-class users: inline `transform: none` overrides
   class-based transforms; if you rely on e.g. Tailwind translate utilities
   for layout, move that offset into the motion values (`x`/`y`) instead.
3. If an animation genuinely does not run, please open a new issue with a
   CodeSandbox repro.

Then close: `gh api -X PATCH repos/motiondivision/motion/issues/2641 -f state=closed -f state_reason=not_planned`

If the row is not APPROVED: mark it BLOCKED ("recommend close as
intended-behaviour/needs-repro; awaiting approval").

## Done criteria

- [ ] Jest verification green
- [ ] Issue closed as `not_planned` with explanatory comment (or row BLOCKED)
- [ ] No source files modified (`git status` clean)
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- A reproduction surfaces in new issue comments showing the animation
  actually failing to run — reclassify; the likely overlap is then with
  #3728's literal-transform handling (`build-styles.ts`), report there.
- The "Outputs 'none'" test no longer exists or fails (behaviour changed
  since planning — re-ground before commenting).

## Maintenance notes

- If product direction ever changes to "remove inline transform instead of
  writing `none`" (i.e. `style.removeProperty("transform")` so class
  transforms shine through at rest), that is a deliberate behaviour change
  touching `build-styles.ts:59-65` + the effects pipeline + the
  `build-transform` tests, and should be its own plan — it would also
  interact with #3728's preserved-literal-transform branch.
