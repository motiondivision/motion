# Plan issue-2416: Reproduce-then-fix popLayout skipping opacity exit animations on `layout` elements

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update (or add) this plan's row in
> `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2416 --jq .state` → expect `open`.
> Re-read the "Current state" excerpts against the live files; on a mismatch,
> treat as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (root cause unknown; sits at the WAAPI-opacity × popLayout × projection intersection)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2416

## Why this matters

The highest-traffic issue in this batch: `mode="popLayout"` + `layout` +
`exit={{ opacity: 0 }}` skips the exit fade on roughly every other removed
item — the element just vanishes. Reported 2023-11 (Sam Selikoff), with
"still happening" confirmations through 2025 (multiple users). Two strong
diagnostic clues from the thread: (1) replacing `opacity` with `x: 100` in
`exit` makes it always work — the bug is opacity-specific; (2) one commenter
bisected the wider opacity-exit bug family (#2554/#2618/#2673) to the
v11.0.10 → v11.0.11 release. The repo has shipped many AnimatePresence fixes
since (12.36.x–12.40.0), so the FIRST job is an honest reproduction on
current main; only then fix.

## Current state

- Reproduction recipe (from the issue body — the linked CodeSandbox
  `github/samselikoff/2023-11-25-framer-motion-pop-layout-bug` was
  **Cloudflare-blocked from the planning environment**; retry once via
  WebFetch, but the inline steps are sufficient):
  1. A list inside `<AnimatePresence mode="popLayout">`; each item is a
     `motion.div` with `layout`, `exit={{ opacity: 0 }}`, unique `key`.
  2. Add 4 items, then click items one at a time to remove them.
  3. Bug: 1st removal fades, 2nd vanishes instantly, 3rd fades, … (alternating).
- Secondary repro (RareSecond's comment, 2024-04): hover-revealed dots — fast
  pointer movement leaves multiple "exiting" divs visible. Same opacity
  dependency. Treat as a confirmation case, not the primary fixture.
- Regression window pointer: `git log --oneline v11.0.10..v11.0.11` — the
  substantive change is `f949a899c` "Fix/async animation 2 (#2528)" (async
  animation start / WAAPI changes). If the bug still reproduces, diff that
  area first.
- One comment (kitsunekyo, 2025-01) describes a *different* mechanism (rAF
  throttled in lazy-loaded iframes). That is environment-specific and OUT OF
  SCOPE here; if your repro only fails inside iframes, report rather than fix.
- Possibly-relevant fixes already on main (check each with `git show <sha>`
  before assuming the bug persists):
  - `90d8c5364` "Fix AnimatePresence not removing children when exit matches current values" (12.39.0 era)
  - `aa8b46be3` "Fix duplicate exit animation processing in AnimatePresence"
  - `8798d7017` "Fix AnimatePresence keeping exiting children in DOM during rapid updates…"
  - `0d38f5623` "Remove data-motion-pop-id attribute when popLayout exit is interrupted"
- Implementation files:
  - `packages/framer-motion/src/components/AnimatePresence/index.tsx` —
    diffing + `onExit` (lines 188–213), `exitComplete`/`exitingComponents`
    bookkeeping (lines 88–121).
  - `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx` —
    pop measurement (`getSnapshotBeforeUpdate`, lines 38–62) and the injected
    `position: absolute` style (lines 105–141).
  - Open PR #3707 (`plans/issues/pr-3707.md`) fixes a *different* stuck-exit
    (#3243, child unmounts mid-exit). Don't duplicate it.
- Existing Cypress exemplars: spec `packages/framer-motion/cypress/integration/animate-presence-pop.ts`,
  test pages `dev/react/src/tests/animate-presence-pop-list.tsx`,
  `animate-presence-pop-interrupt.tsx`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress (primary) | CLAUDE.md § "Running Cypress tests locally" — React 18 AND React 19 | spec fails pre-fix, passes post-fix |
| Jest sweep | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence"` | pass |
| Issue state | `gh api repos/motiondivision/motion/issues/2416 --jq .state` | `open` |
| Gated close (only if not reproducible AND row approved) | `gh api -X PATCH repos/motiondivision/motion/issues/2416 -f state=closed -f state_reason=not_planned` | state closed |

## Scope

**In scope**:
- `dev/react/src/tests/animate-presence-pop-layout-exit-opacity.tsx` (create)
- `packages/framer-motion/cypress/integration/animate-presence-pop-layout-exit-opacity.ts` (create)
- Fix location TBD by diagnosis, expected within:
  `packages/framer-motion/src/components/AnimatePresence/` and/or
  `packages/motion-dom/src/animation/` (WAAPI opacity path)
- `CHANGELOG.md`

**Out of scope**: iframe/rAF-throttling variant (kitsunekyo's comment);
projection-system refactors; PR #3707's diff; issues #2554/#2618/#2673 (closed
— reference only).

## Git workflow

Branch `fix/issue-2416-poplayout-exit-opacity`. Short imperative commits.
`gh pr edit` is broken — use `gh api -X PATCH repos/motiondivision/motion/pulls/<n>`.

## Steps

### Step 1: Build the Cypress repro (visual/WAAPI behavior → Cypress-first, per CLAUDE.md)

Test page `animate-presence-pop-layout-exit-opacity.tsx`: a column of 4 items,
each `motion.div` with `layout`, `exit={{ opacity: 0 }}`,
`transition={{ type: "tween", ease: "linear", duration: 10 }}` (long + linear,
per CLAUDE.md mid-animation guidance), removed on click, ids `item-0..3`,
inside `<AnimatePresence mode="popLayout">`.

Spec: remove item-1; after ~500ms use `.then()` (NOT `.should()`) to assert
`getComputedStyle(el).opacity` is strictly between 0.9 and 1 and the element
is still in the DOM; wait for unmount; remove item-2; repeat the mid-animation
check. The reported bug makes the *second* removal vanish instantly — the
mid-animation check on removal #2 is the regression gate. Also assert via
`el.getAnimations()` that an opacity animation exists (opacity IS a compositor
property — allowed per CLAUDE.md).

**Verify**: run on React 18 per the CLAUDE.md recipe. Record the outcome of
the FIRST run (`tail -60`).

### Step 2: Branch on outcome

- **Spec fails on current main** (bug reproduced) → continue to Step 3.
- **Spec passes** on React 18: re-run on React 19; vary toward the original
  report (shorter duration ~0.3s, remove items faster, add `animate={{ opacity: 1 }}`,
  try removal *immediately* after a previous exit completes). Max 3
  variations. If it still passes everywhere → go to Step 6 (verified-fixed
  path). Do NOT keep tuning beyond 3 attempts.

### Step 3: Diagnose (only if reproduced)

In order:
1. When the fade is skipped, is the exit animation *started and instantly
   finished* (opacity already considered at target) or *never started*?
   Instrument with `onAnimationStart`/`onAnimationComplete` on the item.
2. Check the opacity-specific path: since `x` works and `opacity` doesn't,
   suspect WAAPI/`willChange`/value-reset interaction. Inspect
   `90d8c5364`'s "exit matches current values" logic for a false positive on
   the second item (e.g. opacity read as already `0` from the previous item's
   torn-down style, or a stale `MotionValue` shared via recycled
   VisualElement state).
3. Check `exitComplete`/`exitingComponents` bookkeeping in `index.tsx` for the
   alternating pattern — alternation smells like a flag toggled by the
   previous exit's completion (e.g. `exitingComponents` Set entry not cleared,
   line 118, or `exitComplete` map state leaking between consecutive exits).
4. Only then look at `f949a899c` (v11.0.11 async animation change) for the
   historical mechanism.

### Step 4: Fix minimally

Smallest change that makes the Step 1 spec pass without breaking the
AnimatePresence Jest suite or the other `animate-presence-*` Cypress specs.

### Step 5: Regression sweep + changelog

Full AnimatePresence Jest pattern; Cypress `animate-presence-pop*.ts` plus the
new spec on React 18 AND 19; CHANGELOG entry. Then open the PR referencing
#2416 (and note whether #2554/#2618/#2673 reporters should re-test).

### Step 6: Verified-fixed path (only if Step 2 found no repro)

Keep the new page+spec as regression coverage ONLY if the maintainer wants it
(per repo policy, no speculative happy-path coverage — default is to DISCARD
the fixture and not open a PR). Comment on #2416: state the exact commit
tested (`42bfbe3ed` / 12.40.0), the spec you ran, both React versions, and ask
reporters to confirm on ≥12.40.0; mention the iframe-rAF sub-thread is a
separate mechanism. Closing is gated: if this plan's row in
`plans/issues/README.md` is not marked APPROVED (or APPROVED-CLOSE), set the
row to BLOCKED("awaiting maintainer close approval") and stop.

## Test plan

- Primary: the new Cypress spec (Step 1), failing-first if the bug exists.
- Pattern sources: `cypress/integration/animate-presence-pop.ts` (structure),
  CLAUDE.md "Cypress animation testing patterns" (mid-animation `.then()`
  measurements, long linear tween).
- Jest is NOT the primary layer here: JSDOM lacks WAAPI and the bug is
  opacity/compositor-specific.

## Done criteria (fix path)

- [ ] New Cypress spec fails on unmodified main and passes with the fix, React 18 + 19
- [ ] `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="AnimatePresence"` exits 0
- [ ] Existing `animate-presence-pop*.ts` specs still green on both React versions
- [ ] `yarn build` exits 0; CHANGELOG updated
- [ ] `plans/issues/README.md` row updated

## Done criteria (verified-fixed path)

- [ ] First-run Cypress output captured showing the repro passing on `42bfbe3ed`, both React versions
- [ ] Comment posted on #2416 with the evidence; close executed ONLY if README row is APPROVED, else row set to BLOCKED
- [ ] No source changes committed

## STOP conditions

- Repro attempts exhausted (Step 2) and you are unsure the fixture faithfully
  matches the reporter's app (e.g. you suspect Next.js-specific behavior):
  stop and report instead of closing.
- Diagnosis points into the projection system (`projection/`) — stop and
  report with findings; that's a bigger change than this plan authorizes.
- The fix would modify `PresenceChild` register/cleanup where PR #3707
  operates — stop; #3707 lands first.
- Same Cypress spec red twice in a row for an unrelated known-flaky reason
  (see `plans/issues/README.md` cross-cutting facts) — re-run once, then stop.

## Maintenance notes

- This is the anchor issue for the opacity-exit family (#2554, #2618, #2673
  closed; #2684 verified separately in `issue-2684.md`). If a real fix lands,
  comment on those closed threads.
- The iframe/rAF-throttling variant deserves its own issue if confirmed —
  don't fold it in here.
