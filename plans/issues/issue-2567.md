# Plan issue-2567: Activate layout animations when `layout` prop becomes true after mount

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the row for this issue in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2567 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/motion/utils/use-visual-element.ts packages/motion-dom/src/projection/node/create-projection-node.ts packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`
> Mismatch with "Current state" excerpts = STOP. Also check whether
> plans/issues/issue-1411.md has been executed (see Depends on).

## Status

- **Priority**: P2
- **Effort**: S (M if issue-1411 has not landed first)
- **Risk**: MED
- **Depends on**: plans/issues/issue-1411.md (strongly recommended first — it
  builds the option-sync + idempotent listener this plan needs)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2567

## Why this matters

Setting `layout` to `true` after mount does nothing — the element never
layout-animates until remounted. Reporter use case: virtualized/expanding
lists where `layout` is enabled lazily for perf. The cause is identical in
kind to issue #1411 (projection options frozen at node creation), so fixing
them together is the cheap path.

## Current state

Root cause has two halves, both keyed off mount-time props:

1. **Options never sync.**
   `packages/framer-motion/src/motion/utils/use-visual-element.ts:97-109`:
   the projection node is created on FIRST render (the `ProjectionNode`
   constructor is supplied whenever layout features are loaded, regardless of
   `isEnabled` — see `getProjectionFunctionality`,
   `packages/framer-motion/src/motion/index.tsx:204-219`, which returns
   `ProjectionNode: combined.ProjectionNode` unconditionally). So a div
   rendered with `layout={undefined}` gets a projection node whose
   `options.layout === undefined`, and `setOptions` is never called again
   with the new prop (TODO at use-visual-element.ts:221-227).

2. **The layout-animation listener is never attached.**
   `packages/motion-dom/src/projection/node/create-projection-node.ts:493-498`
   — in `mount()`:
   ```ts
   if (this.options.animate !== false && visualElement && (layoutId || layout)) {
       this.addEventListener("didUpdate", ...)
   ```
   With `layout` falsy at mount, the `didUpdate` handler that starts layout
   animations is missing forever.

What DOES already work when `layout` flips to true: `MeasureLayout`
(`packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`)
mounts at that point because `getProjectionFunctionality` re-evaluates
`isEnabled(props)` every render (feature props list:
`packages/framer-motion/src/motion/features/definitions.ts:23`
`layout: ["layout", "layoutId"]`). Its `componentDidMount` (lines 39-66) adds
the node to the LayoutGroup and calls `projection.setOptions({...projection.options, layoutDependency, onExitComplete})`
— but that spread copies the STALE `layout: undefined`, and `willUpdate`/
`didUpdate` snapshots are taken for a node that never starts animations.

So the symptom in the repro (items rendered before "Toggle" never animate;
items rendered after do) is fully explained by the code above.

Reproduction sandbox
(https://codesandbox.io/p/sandbox/framer-virtual-hgzcgz) was unreachable at
planning time (CodeSandbox blocked, HTTP 403). The issue body's steps are
complete enough to rebuild: list of items, "Add" button, "Toggle" flips a
boolean passed as `layout={enabled}` to every item.

## Commands you will need

Same as plans/issues/issue-1411.md (build, motion-dom jest, Cypress React
18/19 recipe, HTML projection suite). New spec name:
`cypress/integration/layout-prop-dynamic.ts`.

## Scope

**In scope**:
- `packages/framer-motion/src/motion/utils/use-visual-element.ts` (option
  sync — shared with issue-1411)
- `packages/motion-dom/src/projection/node/create-projection-node.ts`
  (idempotent listener attach — shared with issue-1411)
- `dev/react/src/tests/layout-prop-dynamic.tsx` (create)
- `packages/framer-motion/cypress/integration/layout-prop-dynamic.ts` (create)

**Out of scope**:
- Turning `layout` OFF dynamically (removing the listener). Acceptable to
  leave the listener attached and rely on synced `options.layout` being
  falsy; verify with a test case rather than building teardown machinery.
- MeasureLayout unmount-path changes.

## Git workflow

- Branch: `fix/2567-dynamic-layout-prop` (or fold into the issue-1411 branch
  if executing together — preferred; one PR closing both issues is fine).

## Steps

### Step 1: Failing Cypress test (FIRST)

`dev/react/src/tests/layout-prop-dynamic.tsx` exporting `App`, modeled on the
issue repro:

- A column of `<motion.div layout={layoutEnabled} />` items, each ~50px tall,
  with ids `#item-0`, `#item-1`, ...; start with 2 items.
- Button `#add` prepends an item (so existing items move down); button
  `#toggle` flips `layoutEnabled`.
- `transition={{ type: "tween", ease: "linear", duration: 10 }}` on items.

Spec `layout-prop-dynamic.ts`:
1. Click `#toggle` (now layout=true on already-mounted items).
2. Click `#add`.
3. `cy.wait(500)` then `.then()` on `#item-0`'s bounding rect: with the fix,
   the displaced item should be mid-animation (visually near its OLD
   position, offset < item height); on current main it will already sit at
   its final position (no animation). Assert the mid-animation position.
4. Control case: items mounted WITH layout=true from the start must still
   animate (guards against regressions).

**Verify**: spec FAILS on unpatched main (React 18 recipe). Capture output
with `tail -60` on first run.

### Step 2: Apply the shared mechanism

If issue-1411 landed: confirm its option-sync in `useInsertionEffect` already
copies `layout`/`animationType` and that `setOptions` calls the extracted
`attachLayoutAnimationListener()` when `(layout || layoutId)` becomes truthy.
If it covers `layoutId` but not `layout`, extend both trigger conditions to
include `layout`.

If issue-1411 did NOT land: implement its Steps 3–4 (listener extraction +
prop→option sync in `useInsertionEffect`), restricted to what this issue
needs (`layout`, `animationType`), following that plan's exact instructions.

Additionally make sure `animationType` is recomputed on sync:
`typeof layout === "string" ? layout : "both"`
(use-visual-element.ts:228).

**Verify**: `yarn build` exits 0; Step 1 spec passes on React 18 AND 19.

### Step 3: Regression pass

- HTML projection suite (collect script → Vite :8000 → cypress.html.json) →
  green.
- Existing layout specs:
  `--spec "cypress/integration/layout.ts,cypress/integration/layout-shared.ts,cypress/integration/layout-group.ts"`
  (layout.ts / layout-group.ts are known flaky — re-run once before
  treating red as real).
- `cd packages/framer-motion && yarn test-client` → matches pre-change
  baseline.

## Test plan

- New spec (Step 1): (a) layout enabled post-mount animates displaced items;
  (b) control: mount-time layout still animates; (c) optional: toggling
  layout back OFF stops animations (assert item snaps).
- Failing-first on main; green with fix; both React versions.

## Done criteria

- [ ] `layout-prop-dynamic.ts` fails on unpatched main, passes with fix (React 18 + 19)
- [ ] HTML projection suite green; framer-motion `test-client` at baseline
- [ ] No out-of-scope files touched (`git status`)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Code at the cited lines doesn't match (PR #3748/#3749 merged into
  `create-projection-node.ts`, or issue-1411 implemented differently than its
  plan) — reconcile by reading the landed code, and report before deviating.
- Step 1 spec cannot be made to fail (bug may have been fixed by an
  interim option-sync change) — reclassify VERIFY-FIXED, report.
- Fix requires touching `MeasureLayout` mount ordering — that interacts with
  snapshot timing (`hasTakenAnySnapshot`, MeasureLayout.tsx:31) — report
  first.

## Maintenance notes

- Once options sync on every render, audit other options for staleness
  complaints (`layoutScroll`, `layoutRoot` changing dynamically) — same
  mechanism now fixes them for free; mention in PR description.
- Reviewer: check that the per-render comparison in the insertion effect is
  cheap (no object allocation unless something changed).
