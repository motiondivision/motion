# Plan issue-2385: Reproduce and fix page-scroll reset during grid layout animations

> **Executor instructions**: Follow this plan step by step. This is an
> investigation-first plan: the reproduction gate (Step 2) decides whether a
> fix is attempted at all. Repo policy is **no repro → no fix** — if you
> cannot make the test fail on the bug, do not land a speculative fix or
> happy-path tests. Run every verification command; on any STOP condition,
> stop and report. When done, update this issue's row in
> `plans/issues/README.md`.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/projection/node/create-projection-node.ts`
> On any change, re-verify the "Current state" excerpts. Confirm issue open:
> `gh api repos/motiondivision/motion/issues/2385 --jq .state` → `open`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the projection update cycle)
- **Depends on**: none
- **Category**: bug
- **Classification**: NEEDS-REPRO → FIX (repro described precisely in the issue but the linked CodePen is inaccessible; mechanism hypothesis grounded in code below)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2385

## Why this matters

Reordering a grid of `layout` elements sometimes resets the page scroll
position (reporter: "reset to the top"; a 2025-01-13 comment from `ynamite`
confirms it still occurs intermittently with `setInterval` random reorders).
Scroll jumps during layout animations are highly visible UX breakage and the
issue has multiple confirmations across 2023–2025.

## Current state

- Reproduction: https://codepen.io/JAWStm/pen/ExrjQZj — **Cloudflare-blocked
  at planning time** (HTTP 403 via both curl and WebFetch). Try again first
  (Step 1); otherwise reconstruct from the issue's precise description:
  a grid of items; clicking an item moves it to the start of the list; scroll
  sometimes resets. `ynamite`'s variant: grid randomly reordered on
  `setInterval`, page scrolled, scroll position intermittently changes.
- The projection update cycle is write→read→write,
  `packages/motion-dom/src/projection/node/create-projection-node.ts:772-789`:
  ```ts
  this.nodes!.forEach(ensureDraggedNodesSnapshotted)
  // Write
  this.nodes!.forEach(resetTransformStyle)   // strips transforms from all dirty nodes
  // Read
  this.nodes!.forEach(updateLayout)          // getBoundingClientRect measurements
  // Write
  this.nodes!.forEach(notifyLayoutUpdate)    // re-applies transforms / starts animations
  ```
- **Mechanism hypothesis (verify, do not assume)**: transforms contribute to
  the page's scrollable overflow. Mid-animation, items translated below the
  static document bottom extend `scrollHeight`; `resetTransformStyle` strips
  those transforms, the document shrinks, and the browser synchronously clamps
  `scrollTop` — before `notifyLayoutUpdate` re-applies transforms. Matches the
  "sometimes" character (only when current scroll depends on transform-extended
  overflow, i.e. scrolled near the bottom during an in-flight animation).
- Scroll measurement happens inside this cycle: `updateScroll`
  (`create-projection-node.ts:942-965`) records `measureScroll(this.instance)`
  during snapshot/measure phases — so a clamp that happens before/at measure
  also poisons the recorded offsets.
- Historical precedent: commit `e98d0ebb5` (2021, "Removing scroll reset")
  removed `scrollTop` save/restore around `resetTransform` in the old HTML
  visual-element. Read it (`git show e98d0ebb5`) — it confirms transform reset
  vs scroll has been a live concern, and that a naive per-element save/restore
  was deliberately removed (find out why before reintroducing anything:
  `git log --format="%H %s" --all -S "scrollTop" -- src/render/html/visual-element.ts`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress React 18 | block below | spec result per step |
| Cypress React 19 | same with `dev/react-19` + `--config-file=cypress.react-19.json` | same |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="layout"` | no new failures |

```bash
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/layout-scroll-reset.ts
kill $DEV_PID
```

## Scope

**In scope**:
- `dev/react/src/tests/layout-scroll-reset.tsx` (create)
- `packages/framer-motion/cypress/integration/layout-scroll-reset.ts` (create)
- `packages/motion-dom/src/projection/node/create-projection-node.ts` — ONLY
  the root `update()` cycle (:725-800 region), and only if Step 2 reproduces.

**Out of scope**:
- `Reorder/*` (plans 015–018 own those files; this issue is plain `layout`,
  not Reorder).
- Per-element scroll save/restore on every node (the thing `e98d0ebb5`
  removed) — any fix must be root-scroll-scoped and measured.
- `LayoutAnimationBuilder.ts` (PR #3748 territory).

## Git workflow

- Branch: `fix/issue-2385-layout-scroll-reset`
- Do not push/PR until the failing-test gate (Step 2) has been met.
- `gh pr edit` is broken on this repo; use `gh api -X PATCH repos/motiondivision/motion/pulls/<n>` for edits.

## Steps

### Step 1: Try the reporter's repro again

`WebFetch https://codepen.io/JAWStm/pen/ExrjQZj` (and
`https://codepen.io/JAWStm/pen/ExrjQZj.js`). If accessible, base the test page
on it verbatim. If still blocked, proceed with the reconstruction in Step 2
(the issue text is specific enough); note the blockage in the PR body.

### Step 2: Build the repro and a failing Cypress spec — THE GATE

`dev/react/src/tests/layout-scroll-reset.tsx`, exporting `App`:
- A CSS grid (e.g. 3 columns × ~40 rows of 100px `motion.div layout` items so
  the page scrolls well past 100vh), each with a stable `key` and
  `transition={{ type: "tween", ease: "linear", duration: 1 }}`.
- A button (fixed position) that moves the last item to the front of the array
  (reporter's action) and a `?mode=interval` variant that random-shuffles every
  300ms (ynamite's variant — shuffles land mid-animation, which the hypothesis
  says is required).

`cypress/integration/layout-scroll-reset.ts`:
- Load page, `cy.scrollTo("bottom")`, record `win.scrollY`.
- Trigger reorder twice ~300ms apart (second one lands mid-animation), then in
  a `.then()` immediately read `win.scrollY` again.
- Assert `scrollY` unchanged (±2px). Repeat the trigger ~10 times in the test
  to catch the intermittency.

**Verify (must FAIL on unmodified main to proceed)**: spec fails with a
scroll delta. If it passes after 3 honest variations (scrolled to bottom vs
middle; click-reorder vs interval shuffle; tall items vs grid), STOP: this is
the NEEDS-REPRO exit (see STOP conditions).

### Step 3: Confirm the mechanism

With the failing test, instrument locally (temporary `console.log`, not
committed): log `document.documentElement.scrollHeight` and `window.scrollY`
immediately before `resetTransformStyle` loop and after `updateLayout` loop
(`create-projection-node.ts:777-783`). Expected confirmation: scrollHeight
drops and scrollY clamps between those two points. If the clamp happens
elsewhere (e.g. during React's DOM reorder, before `update()` runs at all),
the fix below is wrong — STOP and report the actual mechanism.

### Step 4: Fix — restore root scroll after the measurement cycle

Minimal shape (root node only, inside `update()` after the
`notifyLayoutUpdate` write phase at :789):

1. Before the `resetTransformStyle` loop, capture the root's live offset:
   `const prevScroll = measureScroll(this.instance)` equivalent for the root
   (for the document root, `window.scrollX/Y`; reuse the platform
   `measureScroll` passed into `createProjectionNode` at :143 — check how
   `HTMLProjectionNode`/`DocumentProjectionNode` supply it).
2. After `notifyLayoutUpdate` (transforms re-applied, overflow restored),
   compare the live offset; if it changed, write `prevScroll` back
   (`window.scrollTo(prevScroll.x, prevScroll.y)` for the document root).
3. Only do this when `this === this.root` and a delta actually occurred — keep
   the hot path free of unconditional writes, and keep byte cost minimal.

Mind the recorded scroll: if Step 3 shows `updateScroll` captured the clamped
offset during `updateLayout`, the page-relative boxes are internally
consistent with the clamped scroll, and restoring afterwards must not skew
animation targets — the Step 2 spec plus Step 6 regression suite are the
arbiters. If targets skew (items animate from wrong origins after restore),
STOP and report; the alternative (restoring scroll *between* reset and
measure) re-grows overflow only if transforms are re-applied first, which
contradicts the read phase — that redesign is beyond this plan.

**Verify**: `yarn build` → exit 0; Step 2 spec now passes 10/10 iterations.

### Step 5: Both React versions

Run the spec per the command block on React 18 AND React 19 → both pass.

### Step 6: Regression gates

- `cypress run ... --spec cypress/integration/layout.ts` (known-flaky: re-run
  once; twice-red = STOP) and `--spec cypress/integration/layout-group.ts`.
- The HTML projection scroll fixtures: run the `cypress.html.json` suite specs
  covering `dev/html/public/projection/*page-scroll*.html` (e.g.
  `flexbox-siblings-to-grid-page-scroll.html`,
  `single-element-layout-change-page-scroll.html`) via the dev/html server —
  see `plans/issues/pr-3748.md` / memory notes for the dev/html Vite loop.
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="layout"` → no new failures.

## Done criteria

- [ ] Step 2 spec verified failing on main (output recorded in PR body), passing after fix, both React versions
- [ ] Mechanism confirmation from Step 3 summarized in the PR body
- [ ] Projection page-scroll fixtures + layout Cypress specs pass
- [ ] No instrumentation left in source; `yarn lint` exits 0
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- **Cannot reproduce after 3 variations (Step 2)**: do not fix. Comment on
  #2385 asking for an accessible repro against v12 (the CodePen is
  Cloudflare-blocked for automation) and recommend closing as needs-repro —
  but only execute a close (`gh api -X PATCH repos/motiondivision/motion/issues/2385 -f state=closed -f state_reason=not_planned`)
  once this plan's row in `plans/issues/README.md` is set to `APPROVED-CLOSE`.
- Step 3 shows the clamp does NOT happen inside `update()` — report mechanism,
  no speculative patch.
- PR #3748 or #3749 merged and `update()` no longer matches the excerpt —
  re-ground; if the cycle moved into `LayoutAnimationBuilder`, hand findings
  back instead of patching two places.
- The fix requires touching per-node scroll handling (`updateScroll`,
  `removeElementScroll`) — that's a redesign; report.

## Maintenance notes

- If the fix lands, note in the PR that `e98d0ebb5` removed an older
  per-element variant of scroll preservation — reviewer should compare why
  that was removed vs the root-scoped approach here.
- A `scrollend`/anchor-scrolling interaction (browser scroll anchoring also
  fights transform-driven overflow changes) is a plausible adjacent cause;
  if Step 3 implicates scroll anchoring instead, the fix may be documenting
  `overflow-anchor: none` guidance rather than code.
