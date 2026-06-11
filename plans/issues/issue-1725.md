# Plan issue-1725: Decide and (if approved) port the maintainer's `transition.out` (PR #2951) to v12

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/1725 --jq '.state'` → `open`
>    (if closed, mark DONE and stop).
> 2. `grep -n "out?: boolean\|nextTransition" packages/motion-dom/src/animation/types.ts packages/motion-dom/src/value/index.ts`
>    — if matches, the feature already landed; skip to Step 6.
> 3. `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/interfaces/visual-element-target.ts packages/motion-dom/src/value/index.ts`
>    — drift in these files ⇒ compare against the excerpts below; mismatch on
>    the quoted regions = STOP.

## Status

- **Priority**: P2 (the oldest open feature in this batch, 7 comments, asks
  through 2025; also the designed fix for issue #2636)
- **Effort**: M
- **Risk**: MED (touches the per-value transition resolution every variant
  animation flows through)
- **Depends on**: none
- **Category**: feature
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1725

## Classification: FEATURE — NEEDS-DECISION (maintainer has a chosen design with a complete-but-stale implementation)

## Why this matters

Filed by the maintainer himself (2022): there's no way to define a transition
for *leaving* a state — `animate={{ scale: 1, transition: { delay: 1 } }}`
re-applies the `delay` when returning from `whileHover`, because the entered
variant always defines the transition. The thread converged (maintainer,
2025-01-21): **"This is the closest as I think I'll implement
https://github.com/motiondivision/motion/pull/2951"** — `transition.out`.
PR #2951 was closed unmerged 2025-07-01 (stale against the v12 motion-dom
migration, not rejected on design). Issue #2636 ("whileInView transition
values override other transition values") is the same pain reported as a bug;
landing this resolves both.

## History (read before deciding anything)

- #2332 (`transitionFrom`) — closed.
- #2643 — a revival attempt, also closed.
- **PR #2951 `transition.out`** — maintainer's own, branch
  `origin/feature/transition-out` still exists (head `b6ffa460c`). API:
  ```jsx
  <motion.div
    animate={{ opacity: 0, transition: { delay: 1 } }}
    whileHover={{ opacity: 1, transition: { out: true, duration: 1 } }}
  />
  // leaving hover uses { duration: 1 } — not animate's delay
  ```

## Mechanism in PR #2951 (verified by diffing the branch)

5 files, ~80 lines of logic + 100 lines of tests:

1. `Transition` gains `out?: boolean` (was
   `packages/framer-motion/src/animation/types.ts`; in v12 the `Transition`
   interface lives in `packages/motion-dom/src/animation/types.ts`).
2. `MotionValue` gains `nextTransition?: Transition` (was
   `packages/framer-motion/src/value/index.ts`; in v12:
   `packages/motion-dom/src/value/index.ts`).
3. `animateTarget` consumes/stores it (was
   `packages/framer-motion/src/animation/interfaces/visual-element-target.ts`;
   in v12: `packages/motion-dom/src/animation/interfaces/visual-element-target.ts`,
   whose per-key loop at lines 73-91 currently builds
   `const valueTransition = { delay, ...getValueTransition(transition || {}, key) }`).
   The branch inserts, immediately after building `valueTransition`:
   ```ts
   let outTransition: Transition | undefined
   if (type && value.nextTransition) {
       outTransition = value.nextTransition
   }
   value.nextTransition = undefined
   if (valueTransition.out) {
       value.nextTransition = valueTransition
   }
   if (outTransition) {
       valueTransition = outTransition
   }
   ```
4. Tests: `packages/framer-motion/src/motion/__tests__/transition-out.test.tsx`
   (100 lines on the branch — port them).
5. Example: `dev/react/src/examples/Animation-transition-out.tsx`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Fetch branch | `git fetch origin feature/transition-out` | exit 0 |
| Full branch diff | `MB=$(git merge-base origin/feature/transition-out main); git diff $MB...origin/feature/transition-out` | the 5-file diff above |
| Build | `yarn build` (repo root) | exit 0 |
| New tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="transition-out"` | pass |
| Regression sweep | `cd packages/framer-motion && yarn test-client` | no new failures |

## Maintainer decision gate (BEFORE any code)

The design was chosen by the maintainer, but he also closed his own PR — so
confirm: set this plan's row in `plans/issues/README.md` to `APPROVED`
(port `transition.out` as specified) or `REJECTED` (leave the issue open
and report; do NOT close #1725 as not_planned — it's the maintainer's own
roadmap item).

## Steps

### Step 1 (gate: row APPROVED): Port the failing tests first

Copy `transition-out.test.tsx` from the branch
(`git show origin/feature/transition-out:packages/framer-motion/src/motion/__tests__/transition-out.test.tsx`)
into the same path on your branch. Fix imports for v12 (e.g. types now come
through `motion-dom` re-exports). Run the transition-out filter → tests FAIL
(feature absent) — the right failure reason for a feature port.

### Step 2: Port the three logic changes

Apply changes 1-3 from "Mechanism" at the v12 locations. Notes for the
executor:
- In v12's `visual-element-target.ts` the loop also has the
  "skip if already at target" early-continue (lines 100-110) and the
  `skipAnimations` flag — insert the `out` block right after
  `const valueTransition = {...}` (line 88-91) and before those, mirroring
  the branch's placement after the transition is built.
- `type` is the `VisualElementAnimationOptions["type"]` param already
  destructured at line 36 — the gate `if (type && value.nextTransition)`
  restricts `out` consumption to variant-driven animations; keep it.
- Add the `out?: boolean` JSDoc from the branch verbatim (it's good docs).

**Verify**: transition-out filter → all pass.

### Step 3: Confirm #2636's scenario is fixed

Add one more test (same file): `whileInView`-style variant with
`transition: { delay: 3 }` + `whileHover` with
`transition: { out: true, duration: 0.3 }`; assert leaving hover animates
back without the 3s delay. (JSDOM can't do real IntersectionObserver — drive
it with `animate`/`whileHover` props the way the existing hover tests in
`packages/framer-motion/src/gestures/__tests__/hover.test.tsx` do.)

### Step 4: Regression sweep

`yarn build` → exit 0. `cd packages/framer-motion && yarn test-client` → no
new failures vs a baseline run on main (run main's suite first if unsure;
pre-existing SSR TextEncoder + use-velocity failures don't count).

### Step 5: PR

Branch `feature/transition-out-v12`; PR body links #1725, #2636, and credits
PR #2951 as the origin. Note `gh pr edit` is broken on this repo — if edits
are needed use `gh api -X PATCH repos/motiondivision/motion/pulls/<n> -f body=...`.

### Step 6: Issue hygiene (after merge/release only)

Comment the shipped API on #1725 and close as completed; cross-comment on
#2636 (see `plans/issues/issue-2636.md`, which is gated on this plan).

## Scope

**In scope**: the v12 equivalents of the 5 branch files —
`packages/motion-dom/src/animation/types.ts`,
`packages/motion-dom/src/value/index.ts`,
`packages/motion-dom/src/animation/interfaces/visual-element-target.ts`,
`packages/framer-motion/src/motion/__tests__/transition-out.test.tsx` (create),
`dev/react/src/examples/Animation-transition-out.tsx` (create).

**Out of scope**: `transitionFrom`/`transitionTo` map syntax from the thread
(explicitly superseded by the maintainer's choice of `out`); animation-state
internals (`packages/motion-dom/src/render/utils/animation-state.ts`) — the
branch deliberately implements this at the value level, not the variant
resolver.

## Done criteria

- [ ] Row APPROVED before any code
- [ ] Ported tests failed before the port, pass after
- [ ] #2636 scenario test passes
- [ ] `yarn build` exit 0; client suite has no new failures
- [ ] Only in-scope files modified
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Row not APPROVED → stop.
- `value.nextTransition` conflicts with v12 `MotionValue` internals (e.g. a
  same-named field appeared, or `liteClient`/effects paths bypass
  `animateTarget`) → STOP and report.
- Ported tests fail for reasons other than the feature's absence (v12
  behavior drift) after 2 fix attempts → STOP with the diff of expectations.
- Any change in behavior when `out` is not set (regression sweep red) → STOP.

## Maintenance notes

- `nextTransition` is consumed by the *next* variant animation per value; the
  effects/VisualElement unification (branch `worktree-style-effect`) must
  preserve this handoff when `animateTarget` is reshaped — flag in PR.
- Docs (motion.dev) live outside this repo; the maintainer needs to document
  `transition.out` at release time.
