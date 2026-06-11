# Plan issue-2425: Stop `layoutRoot` from restarting the projection root's animation on every Reorder update

> **Executor instructions**: Investigation-first plan. The reproduction gate
> (Step 1) decides whether a fix is attempted — repo policy is **no repro →
> no fix**. Run every verification command; honor STOP conditions. When done,
> update this issue's row in `plans/issues/README.md`.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/projection/node/create-projection-node.ts packages/framer-motion/src/components/Reorder`
> On any change, re-verify the "Current state" excerpts. Confirm issue open:
> `gh api repos/motiondivision/motion/issues/2425 --jq .state` → `open`.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED-HIGH (`layoutRoot` semantics also power sticky-element fixtures)
- **Depends on**: none hard. Coordinate with plans 015–018 (Reorder) and PRs #3748/#3749 — see STOP conditions. NOT covered by plan 017 (that scopes auto-scroll state; no `layoutRoot` content — verified by grep across `plans/*.md` at planning time).
- **Category**: bug / perf
- **Classification**: FIX (mechanism identified in code; repro sandboxes blocked, reconstruction specified)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2425

## Why this matters

Adding `layoutRoot` to (or above) a `Reorder.Group` makes reordering jittery
and slow (issue video + a simplified second repro from `Swiftwork`,
2023-11-30, showing degradation even without the variants/scale parent).
`layoutRoot` is the documented tool for making children animate relative to an
instantly-committed root, so it appearing to be incompatible with Reorder is a
real product defect, not just a perf nit.

## Current state — why `layoutRoot` degrades Reorder

All in `packages/motion-dom/src/projection/node/create-projection-node.ts`:

1. **Every child update force-snapshots the layoutRoot.** Inside
   `willUpdate()`'s ancestor walk (:703-707):
   ```ts
   node.updateScroll("snapshot")
   if (node.options.layoutRoot) {
       node.willUpdate(false)
   }
   ```
   During a Reorder drag, every swap re-render runs this — the Group is
   re-snapshotted (a `getBoundingClientRect` read) on every item update.
2. **The layoutRoot starts a new animation on every `didUpdate`, even when
   nothing changed.** The didUpdate listener (:546-552):
   ```ts
   if (
       this.options.layoutRoot ||
       this.resumeFrom ||
       hasOnlyRelativeTargetChanged ||
       (hasLayoutChanged && (hasTargetChanged || !this.currentAnimation))
   ) {
   ```
   — `layoutRoot ||` bypasses all change detection. The animation is made
   instant at :567-573 (`delay = 0; type = false`) and committed at full
   progress via :1713 `this.mixTargetDelta(this.options.layoutRoot ? 1000 : 0)`,
   but it still tears down and restarts the root's projection animation
   (`startAnimation` at :575 stops `currentAnimation`, re-resolves targets) on
   **every** reorder swap. Reorder items animate **relative** to the Group;
   each restart invalidates/re-resolves their relative targets mid-flight →
   jitter + extra projection work per swap.
3. History: `layoutRoot` shipped in commit `347f3385d` ("Adding `layoutRoot`
   prop (#1773)"). Before fixing, read `git log -S "options.layoutRoot ||" --oneline --all`
   and the PR #1773 description to learn why unconditional restart was chosen
   (most likely: guarantee the instant commit happens even when only children
   changed).

Also from the issue ("it would be good to be able to set only `layoutRoot`
without `layout`"): a node only registers the didUpdate animation listener if
`layoutId || layout` (:495-498) and `willUpdate` bails without them (:710-711),
so bare `layoutRoot` is currently semi-inert. Treat this as a finding to
report, not something to change here.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| Cypress React 18/19 | block below (both versions, per CLAUDE.md) | per step |
| Jest | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="layout|Reorder"` | no new failures |

```bash
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!
npx wait-on http://localhost:$PORT
cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/reorder-layout-root.ts
kill $DEV_PID
# React 19: dev/react-19 + --config-file=cypress.react-19.json
```

## Scope

**In scope**:
- `packages/motion-dom/src/projection/node/create-projection-node.ts` — ONLY
  the didUpdate trigger condition (:546-552) and, if Step 2 demands, the
  :703-707 forced `willUpdate`.
- `dev/react/src/tests/reorder-layout-root.tsx` (create)
- `packages/framer-motion/cypress/integration/reorder-layout-root.ts` (create)

**Out of scope**:
- `packages/framer-motion/src/components/Reorder/*` — owned by plans 015–018;
  this bug is in projection, not Reorder.
- `mixTargetDelta` instant-commit semantics (:1713) — changing it breaks
  layoutRoot's core contract.
- Making bare `layoutRoot` (without `layout`) animate — report as follow-up.

## Git workflow

- Branch: `fix/issue-2425-layout-root-reorder-perf`
- No PR until the failing-test gate passes. `gh pr edit` is broken; use
  `gh api -X PATCH repos/motiondivision/motion/pulls/<n>` for edits.

## Steps

### Step 1: Reproduce with a deterministic failing spec — THE GATE

Sandboxes (`kwqsnd`, `rx63nl`) are Cloudflare-blocked at planning time; try
WebFetch once, else reconstruct from the issue steps (they're complete).

`dev/react/src/tests/reorder-layout-root.tsx`, exporting `App`:
- `Reorder.Group` with `layout layoutRoot` (and `?layoutRoot=false` variant
  reading URL params), `axis="y"`, ~8 `Reorder.Item`s with distinct ids,
  visible 60px rows; `onReorder` updates state.
- On the Group: `onLayoutAnimationStart={() => { window.groupAnimStarts = (window.groupAnimStarts ?? 0) + 1 }}`.
  This counts the restarts from mechanism (2): on current main, every swap
  fires it because of `layoutRoot ||` (the `onPlay` wired at :563), even
  though the Group's own layout never changes.

`cypress/integration/reorder-layout-root.ts`, modeled on
`packages/framer-motion/cypress/integration/drag-layout-reorder-strict.ts`
(pointerdown/pointermove sequencing on an item to force several swaps in one
drag):

1. With `layoutRoot`: perform a drag crossing 3 items. In a `.then()`, read
   `win.groupAnimStarts`. **Expected (post-fix)**: `0` (Group layout
   unchanged → no animation restarts). **On main**: ≥3 → test fails. This is
   the deterministic proxy for the jitter.
2. Without `layoutRoot`: same drag, assert `groupAnimStarts === 0` and that
   items reorder correctly (sanity baseline, passes on main).

**Verify (must FAIL case 1 on unmodified main)**: if `groupAnimStarts` is 0 on
main, mechanism (2) is wrong — STOP, re-instrument (log inside :546-552) and
report. Additionally confirm the user-visible symptom once by eye: run the
page in the dev server with 50 items and compare drag smoothness with/without
`layoutRoot` (record observation in the PR body; the video in the issue is
the reference).

### Step 2: Fix the trigger condition

Target shape at :546-552 — `layoutRoot` may only force an animation when
something about the node actually changed, preserving the instant-commit
behavior for real changes:

```ts
if (
    (this.options.layoutRoot && (hasLayoutChanged || hasTargetChanged)) ||
    this.resumeFrom ||
    hasOnlyRelativeTargetChanged ||
    (hasLayoutChanged && (hasTargetChanged || !this.currentAnimation))
) {
```

Keep the `:567-573` instant-transition branch untouched. If the sticky
fixtures (Step 3) fail with this shape, the unconditional restart is
load-bearing for sticky/scroll cases — try scoping the condition to
"unchanged AND a current committed target exists" before giving up; two
failed shapes = STOP.

If Step 1 instrumentation shows the dominant cost is the forced re-snapshot
(mechanism 1) rather than restarts, note that `updateSnapshot()` (:885-896)
already early-returns when `this.snapshot` exists, so the forced
`willUpdate(false)` measures at most once per update cycle (snapshots are
cleared per cycle in `clearAllSnapshots`). Any further guard there needs
measurements in hand — do not change :705-707 speculatively.

**Verify**: `yarn build` exits 0; Step 1 case 1 passes; case 2 still passes.

### Step 3: Regression gates (layoutRoot's other consumers)

- HTML projection sticky fixtures — the only in-repo `layoutRoot` coverage
  (verified by grep): `dev/html/public/projection/sticky-*.html` run via the
  Cypress HTML config (`cypress.html.json`, dev/html Vite server on port 8000
  per CLAUDE.md). All must pass.
- `cypress run ... --spec cypress/integration/drag-layout-reorder-strict.ts`
  (known-flaky: re-run once; twice-red = STOP).
- `cypress run ... --spec cypress/integration/layout.ts,cypress/integration/layout-group.ts`.
- `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="layout|Reorder"` → no new failures.

### Step 4: Both React versions + PR

Run the new spec on React 18 AND React 19. Open PR referencing #2425; include
the before/after `groupAnimStarts` counts and the manual smoothness
observation.

## Done criteria

- [ ] New spec verified failing on main (restart count > 0), passing post-fix, both React versions
- [ ] All `sticky-*.html` projection fixtures pass
- [ ] Reorder/layout Cypress + Jest gates pass
- [ ] `yarn lint` exits 0; `plans/issues/README.md` row updated

## STOP conditions

- Step 1 gate: `groupAnimStarts` already 0 on main, or no observable
  degradation reproducible — report; recommend needs-repro close ONLY behind
  an `APPROVED-CLOSE` row in `plans/issues/README.md`
  (`gh api -X PATCH repos/motiondivision/motion/issues/2425 -f state=closed -f state_reason=not_planned`).
- Two fix shapes fail the sticky fixtures (Step 2) — the restart is
  load-bearing; report findings and the failing fixture names.
- PR #3748 or #3749 merged and the :546/:703/:1713 excerpts no longer match —
  these PRs reshape projection internals; re-ground before editing, and if the
  logic moved into `LayoutAnimationBuilder`, hand findings to the maintainer
  instead of patching both.
- Plan 018 (multidimensional reorder) landed and rewrote Reorder drag flows —
  re-run its Cypress gates and rebase the test page on the new component
  behavior before continuing.

## Maintenance notes

- Follow-up finding to file: bare `layoutRoot` without `layout` is semi-inert
  (listener gating at :495-498) — the issue explicitly asked for it; deserves
  a maintainer decision.
- If plans 019–021 (drag port to motion-dom) land, the pointer-sequencing
  helpers used by the new spec may move; the spec itself is framework-level
  and should survive.
