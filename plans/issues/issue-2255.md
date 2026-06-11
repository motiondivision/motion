# Plan issue-2255: Reproduce-or-close "Reorder.Item transform Y wrong when container height changes"

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update this plan's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2255 --jq '.state'` → `open`
>    (if closed, mark DONE and stop).
> 2. `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/components/Reorder/`
>    — expected drift from plans 015–018 only; anything touching layout
>    measurement on size change, re-read before proceeding.

## Status

- **Priority**: P3
- **Effort**: S (repro attempt; a fix, if reproduced, is a new decision point)
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (unconfirmed)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2255

## Classification: NEEDS-REPRO (with VERIFY-FIXED flavor — likely fixed or user error)

## Why this matters

If real, a `Reorder.Item` in an `axis="x"` group keeps a stale non-zero
`translateY` after its container's height changes (reporter's video shows an
item visually offset vertically; their screenshot shows a persistent
`transform: ... translateY(<non-zero>)` in computed style). That would be a
projection/layout-animation correctness bug. But the report is from
2023-07-26 against framer-motion 10.x, has **no sandbox** (only an inline
JSX fragment and assets we cannot fetch), 0 comments, and no confirmations
since. Repo policy: no repro → no fix, and no speculative test coverage.

## Issue facts (all of them — the executor should not re-fetch hoping for more)

- Reporter setup: `Reorder.Group axis="x"` of tag-like items; each item
  contains a close `<button onClick={() => onClick(data)}>` that removes the
  item; "this issue occurred only in changeable containers" — i.e. the
  group's height changes (items wrap / container resizes) when items are
  added/removed.
- Symptom: after such a change, an item renders with a wrong persistent
  `translateY` ("i want to fixed transform Y to 0").
- Reporter notes `transformTemplate` works around it but kills the x
  animation.
- **Red flag in the reporter's own snippet**: `<Reorder.Item key={index} ...>`
  — keying by array index. Reorder/layout animations require stable identity
  (`key={item}`); index keys make React reuse DOM nodes across different
  values on removal, which scrambles projection snapshots and produces
  exactly this class of stale-transform artifact. The repo's own JSDoc
  example (`packages/framer-motion/src/components/Reorder/Group.tsx:49-57`)
  shows `key={item}`.
- Media in the issue are GitHub user-asset URLs (video + screenshot) — they
  require auth and were not fetchable at planning time.

## Why this may already be fixed

Since the report, layout handling on container size change was reworked:

- `5194dfa6a` — "Move resize fix to projection system: measure layouts
  during resize without animating"
- `4da8afa3c` / `13e34c633` — "Fix Reorder.Group stopping work when axis
  changes during (window) resize"
- `043514146` — "Fix stranded drag transform after layout swap in React 19"
  (a stale-transform-after-reorder fix in the same family)

Run `git log --oneline --grep="resize" -- packages/framer-motion/src` and
`git show 5194dfa6a --stat` for context before testing.

## Current state (code involved if the bug is real)

- `packages/framer-motion/src/components/Reorder/Item.tsx:98-127` — item
  renders with `drag={axis}` (`"x"` here), `dragSnapToOrigin`,
  `style={{ ...style, x: point.x, y: point.y, zIndex }}` and `layout`.
  The `y` MotionValue exists even for `axis="x"` (it's a
  `useDefaultMotionValue(style.y)`, Item.tsx:47-49/81-84) — a candidate for
  holding a stale value, but drag="x" never writes to it; the reported
  translateY more plausibly comes from the projection transform applied on
  layout change, not from this MotionValue.
- Projection (FLIP) system: `packages/framer-motion/src/projection/` — out
  of scope unless a repro lands and points there.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` from repo root | exit 0 |
| Cypress React 18 | recipe below | n/a (this is the repro attempt) |

```bash
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd ../../packages/framer-motion && npx cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/reorder-resize-transform.ts
kill $DEV_PID
```

Foreground only; `tail -60` the first output. Try `--browser chrome` on the
second attempt (Electron vs Chrome differ on layout/WAAPI behavior — don't
overfit to Electron).

## Scope

**In scope** (only files you may create — both are throwaway if no repro):
- `dev/react/src/tests/reorder-resize-transform.tsx` (create)
- `packages/framer-motion/cypress/integration/reorder-resize-transform.ts` (create)

**Out of scope**:
- ANY source change under `packages/` — a fix is not authorized by this
  plan; if you reproduce the bug, that is a STOP-and-report (the fix needs
  its own plan against the projection system).
- Keeping the test page/spec if the result is "no repro": delete them before
  finishing (no speculative happy-path coverage — repo policy).

## Steps

### Step 1: Build the repro page faithful to the report

`dev/react/src/tests/reorder-resize-transform.tsx` (named `App` export,
modeled on `dev/react/src/tests/drag-to-reorder.tsx`): `Reorder.Group
axis="x"` with 4 string items, each `Reorder.Item` (with **correct**
`key={item}` — see Step 3 for the index-key variant) containing a label and
a remove button (`id={"remove-" + item}`). Style the group so its **height
depends on content** (e.g. `display: flex; flex-wrap: wrap; width: 260px`
with 120px-wide items, so removing an item changes row count and therefore
container height — the reporter's "changeable container"). Render each
item's `id={item}`.

### Step 2: Cypress repro attempt (correct keys)

`packages/framer-motion/cypress/integration/reorder-resize-transform.ts`:

1. Visit `?test=reorder-resize-transform`, wait 100ms.
2. Drag item B a little on x (pointerdown → 2 pointermoves → pointerup,
   pattern from `cypress/integration/drag-to-reorder.ts:46-50`) so the drag
   path has run at least once.
3. Click `#remove-C` (container height changes as rows rewrap). Wait 500ms
   (let layout animations finish).
4. `.then()` (NOT `.should()` — retries would mask a transient-but-sticky
   wrong value) read each remaining item's
   `getComputedStyle(el).transform`; parse the matrix; assert the
   y-translation component is 0 (±1px).

**Verify**: run the recipe. Expected per the VERIFY-FIXED hypothesis: passes.
If it FAILS with a persistent translateY → you have the repro; go to STOP
conditions (report, do not fix).

### Step 3: Second attempt — reporter's exact anti-pattern

Add a query-param variant to the page (`?test=reorder-resize-transform&keys=index`)
that uses `key={index}` like the reporter's snippet, and a second spec case
repeating Step 2 against it. This distinguishes "library bug" from
"index-key user error reproduces it."

**Verify**: run both cases, Electron then `--browser chrome` (max 2–3 total
attempts per repo debugging policy — do not grind beyond that).

### Step 4: Disposition

Record the outcome matrix (correct-keys × index-keys, pass/fail), then:

**A. No repro anywhere** (expected): delete both created files. Comment on
the issue via
`gh api repos/motiondivision/motion/issues/2255/comments -f body='...'`:
state that the scenario was rebuilt on motion@12 (axis="x", wrapping
container, item removal changing height) and the stale translateY no longer
reproduces — likely fixed by the resize/projection work since v10 (cite
`5194dfa6a`); note that `key={index}` in the original snippet breaks
reorder identity and to use `key={item}`; ask for a motion@12 sandbox if it
still occurs. Then, ONLY once this plan's row in `plans/issues/README.md`
says APPROVED-CLOSE:

```bash
gh api -X PATCH repos/motiondivision/motion/issues/2255 -f state=closed -f state_reason=not_planned
```

**B. Repro only with `key={index}`**: same as A, but the comment leads with
the key fix being the resolution; recommend close (same gate).

**C. Repro with correct keys**: STOP. Keep the page+spec (they become the
failing test for the fix plan), report the exact failing transform values
and which browser, and request a follow-up fix plan targeting the
projection system.

## Test plan

The Cypress spec IS the deliverable test: it either becomes the failing test
for a future fix (outcome C) or is deleted (outcomes A/B — no speculative
coverage lands).

## Done criteria

- [ ] Repro attempted in both key modes, Electron + Chrome, ≤3 runs total
- [ ] Outcome A/B: files deleted (`git status` clean), comment posted,
      close ONLY after APPROVED-CLOSE row
- [ ] Outcome C: STOP report filed with transform readings; files kept on a
      branch, no source changes made
- [ ] `plans/issues/README.md` row updated with the outcome letter

## STOP conditions

- Outcome C (repro with correct keys) — report, do not fix here.
- The dev page can't express "container height changes" (e.g. flex-wrap
  variant doesn't change height in Electron) after 2 layout strategies —
  report instead of inventing further scenarios.
- Issue already closed, or someone attached a working sandbox in the
  meantime (re-check comments at start: `gh api repos/motiondivision/motion/issues/2255/comments --jq 'length'` — was 0 at planning time).

## Maintenance notes

- If the reporter (49806316 / issue author) ever supplies a motion@12
  sandbox, restart from Step 2 with their exact markup — their CSS
  (`cursor-pointer`, tailwind classes) hints at wrapped tag chips, which the
  Step 1 page approximates but cannot replicate exactly.
- The `transformTemplate` workaround mentioned in the issue suggests the
  stray Y lives in the projection-generated transform string — if outcome C
  happens, start the investigation at how projection composes transforms for
  `axis="x"` items whose layout y changed (`packages/framer-motion/src/projection/`).
