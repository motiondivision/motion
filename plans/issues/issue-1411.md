# Plan issue-1411: Support changing `layoutId` after mount

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the row for this issue in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/1411 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/motion/utils/use-visual-element.ts packages/motion-dom/src/projection/node/create-projection-node.ts packages/motion-dom/src/projection/shared/stack.ts`
> If `create-projection-node.ts` changed substantially (PR #3748/#3749
> landing), re-verify every excerpt below before proceeding; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but coordinate with plans/issues/issue-2567.md — same mechanism, do this plan first)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1411

## Why this matters

`layoutId` is read once when the projection node is created and never updated,
so changing the prop is silently ignored. Maintainer confirmed in 2022: "this
is definitely a bug, we should change this at some point". The issue has 11
comments spanning 2022–2025 with repeated user demand (galleries, calendars).
Two abandoned fix branches exist, so demand is proven and an approach has
already been sketched — it just never landed.

## Current state

- `packages/framer-motion/src/motion/utils/use-visual-element.ts:97-109` —
  `createProjectionNode(...)` is called only when `!visualElement.projection`,
  i.e. once per component instance.
- `use-visual-element.ts:191-235` — `createProjectionNode` calls
  `visualElement.projection.setOptions({ layoutId, layout, ... })` once. The
  inline TODO (lines 221-227) states the known gap:
  ```
  TODO: Update options in an effect. This could be tricky as it'll be too late
  to update by the time layout animations run.
  ```
- `use-visual-element.ts:112-120` — `useInsertionEffect` already runs
  `visualElement.update(props, presenceContext)` on every re-render after
  mount; this is the natural place to also sync projection options.
- `packages/motion-dom/src/projection/node/create-projection-node.ts:440-491`
  — `mount()` registers the node into the shared stack exactly once:
  ```ts
  if (layoutId) {
      this.root.registerSharedNode(layoutId, this)
  }
  ```
  and (lines 493-498) attaches the `didUpdate` layout-animation listener only
  if `(layoutId || layout)` at mount time.
- `create-projection-node.ts:1150-1158` — `setOptions()` is a plain merge; it
  does not react to a changed `layoutId`.
- `create-projection-node.ts:1855-1871` — `registerSharedNode(layoutId, node)`
  adds to `root.sharedNodes` (a `Map<string, NodeStack>`) and promotes the
  node to lead.
- `create-projection-node.ts:1888-1891` — `getStack()` resolves the stack from
  `this.options.layoutId`, so stack membership must be updated in the same
  operation as the option, or `unmount()`/`relegate()` will operate on the
  wrong stack.
- `packages/motion-dom/src/projection/shared/stack.ts` — `NodeStack.add /
  remove / promote`. `remove()` promotes the previous member if the removed
  node was lead.
- `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx:39-66`
  — `componentDidMount` registers with `switchLayoutGroup` only when
  `layoutId` is set at mount (line 47). Minor, AnimateSharedLayout-legacy.

### Prior art (read-only reference — do NOT cherry-pick blindly)

- Branch `origin/claude/allow-layoutid-changes-a1aJ2` (commits `5e350b0b2`
  fix + `5e6605787` E2E tests, based on v12.19.3): two-part approach —
  (a) in `setOptions()`, when `this.instance && prevLayoutId !== newLayoutId`,
  remove from old stack and `registerSharedNode(newLayoutId, this)`;
  (b) in `useVisualElement`'s insertion effect, re-call `setOptions` with the
  fresh prop-derived options.
- Branch `origin/fix/dynamic-layout-id-update` (commit `f35268c6d`): earlier
  variant.
- Known gaps in the prior art that THIS plan must cover:
  1. If the node mounted with neither `layout` nor `layoutId`, the `didUpdate`
     listener (mount lines 493-498) was never attached — gaining a `layoutId`
     later still won't animate. Extract that listener attachment into a
     private method (e.g. `attachLayoutAnimationListener()`), guard with a
     boolean flag field, call it from `mount()` AND from `setOptions()` when
     `(layoutId || layout)` becomes truthy while `this.instance` exists.
  2. The prior art re-spreads options in the effect but drops
     `initialPromotionConfig`/`layoutAnchor`; build the new options object the
     same way `createProjectionNode()` does (use-visual-element.ts:215-234) or
     refactor that body into a shared helper used by both call sites.
  3. View the branch diff before starting:
     `git diff main...origin/claude/allow-layoutid-changes-a1aJ2 -- packages/motion-dom/src/projection/node/create-projection-node.ts packages/framer-motion/src/motion/utils/use-visual-element.ts`

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (repo root) | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="layout"` | pass (note: some pre-existing JSDOM layout failures exist — record baseline first) |
| Cypress React 18 | see recipe below | spec green |
| Cypress React 19 | see recipe below | spec green |

Cypress recipe (from CLAUDE.md — run BOTH React versions, foreground):
```bash
PORT=$((10000 + RANDOM % 50000))
cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &
DEV_PID=$!; npx wait-on http://localhost:$PORT
cd packages/framer-motion && cypress run --headed --config baseUrl=http://localhost:$PORT --spec cypress/integration/layout-id-change.ts
kill $DEV_PID
# React 19: same but dev/react-19 and --config-file=cypress.react-19.json
```

## Scope

**In scope**:
- `packages/motion-dom/src/projection/node/create-projection-node.ts`
  (`setOptions`, `mount` — listener extraction only; no other surgery)
- `packages/framer-motion/src/motion/utils/use-visual-element.ts`
- `dev/react/src/tests/layout-id-change.tsx` (create)
- `packages/framer-motion/cypress/integration/layout-id-change.ts` (create)
- Optionally `packages/motion-dom/src/projection/shared/stack.ts` if `remove`
  needs a non-promoting variant (justify in PR if so)

**Out of scope**:
- `MeasureLayout.tsx` switchLayoutGroup re-registration (AnimateSharedLayout
  legacy; note as follow-up, don't fix here).
- Animating the layoutId *change itself* as a shared transition between the
  element's old and new stack (i.e. snapshot-on-change). First land "new
  layoutId takes effect"; note enhancement in PR.
- Issue #2567's `layout`-prop activation — sibling plan issue-2567.md.

## Git workflow

- Branch: `fix/1411-dynamic-layout-id`
- Do not push/PR until all gates pass; `gh pr edit` is broken on this repo —
  use `gh api -X PATCH repos/motiondivision/motion/pulls/<n>` for edits.

## Steps

### Step 1: Failing Cypress test (write FIRST)

Test page `dev/react/src/tests/layout-id-change.tsx` exporting `App`,
distilled from the issue: two fixed-size boxes A (left) and B (right). State
`activeId: "a" | "b"`. A single floating `motion.div` rendered over A or B is
NOT what we want — instead mirror the reporter's gallery case:

- Element X: `<motion.div layoutId={selected} />` positioned inside container
  1 (its layoutId CHANGES between "a" and "b" via a button click).
- Element Y: conditionally rendered `<motion.div layoutId="b" />` at a known
  different position (e.g. `position: absolute; top: 400px`), mounted by the
  same click.
- Use `transition={{ type: "tween", ease: "linear", duration: 10 }}`.
- On click: set X's layoutId to "b" AND mount Y. Expected (post-fix): Y
  starts a shared layout animation from X's box (they now share "b").
  Buggy (today): X is still registered under "a", so Y mounts with no
  animation, snapping into place.

Spec `packages/framer-motion/cypress/integration/layout-id-change.ts`:
visit `?test=layout-id-change`, click, `cy.wait(500)` then `.then()` (NOT
`.should()`) on Y's `getBoundingClientRect()` — assert it is far from its
final resting place (mid-animation) post-fix; pre-fix it will already be at
the final position. Also assert after the change that calling a second click
animates back (round-trip).

**Verify**: spec FAILS on current main (Y snaps; mid-animation position equals
final position). Run React 18 recipe.

### Step 2: Projection-side support in `setOptions`

In `create-projection-node.ts` `setOptions()` (line 1150), before the merge,
capture `prevLayoutId = this.options.layoutId`. After the merge, if
`this.instance && prevLayoutId !== this.options.layoutId`:

1. `const oldStack = prevLayoutId && this.root.sharedNodes.get(prevLayoutId)`;
   `oldStack && oldStack.remove(this)`.
2. `this.options.layoutId && this.root.registerSharedNode(this.options.layoutId, this)`
   (this promotes the node in the new stack — matching `mount()` behavior).
3. Ensure the layout listener exists: call the extracted
   `attachLayoutAnimationListener()` (Step 3).

**Verify**: `yarn build` exits 0;
`npx jest --config packages/motion-dom/jest.config.json` no regressions.

### Step 3: Extract idempotent layout-animation listener

Move the `addEventListener("didUpdate", ...)` block (mount lines 493-605) into
a method guarded by a new private flag (e.g. `hasAttachedLayoutListener`),
keeping the existing condition `this.options.animate !== false &&
visualElement && (layoutId || layout)` evaluated at call time. Call it from
`mount()` (unchanged behavior) and from the Step 2 branch. Pure move — do not
alter the listener body (it is large and PRs #3748/#3749 are nearby).

**Verify**: `yarn build`; full HTML projection suite
(`node dev/inc/collect-html-tests.js`, dev/html Vite on port 8000,
`npx cypress run --config-file=cypress.html.json --spec cypress/integration-html/projection.ts`)
→ green (this suite exercises mount-time listener behavior heavily).

### Step 4: React-side option syncing

In `use-visual-element.ts`, extract the option-object construction from
`createProjectionNode` (lines 197-234) into a helper, and in the existing
`useInsertionEffect` (lines 112-120), after `visualElement.update(...)`, call
`visualElement.projection?.setOptions(buildProjectionOptions(props, visualElement))`
— but only when one of `layoutId`/`layout`/`layoutScroll`/`layoutRoot`/
`layoutCrossfade`/`drag`/`dragConstraints` actually changed (compare against
`visualElement.projection.options`) to avoid churn on every render.
Preserve `initialPromotionConfig` (do not overwrite it with `undefined` —
spread `...projection.options` first or omit unchanged keys).

**Verify**: Step 1 spec now PASSES on React 18 AND React 19 (both recipes).

### Step 5: Full regression pass

`yarn test` for framer-motion client tests
(`cd packages/framer-motion && yarn test-client`) and the HTML projection
suite again. Run existing shared-layout Cypress specs:
`--spec "cypress/integration/layout-shared.ts,cypress/integration/layout-group.ts,cypress/integration/layout-shared-lightbox-crossfade.ts"`
(note `layout-group.ts` is a known flaky spec — re-run once before treating a
failure as real).

## Test plan

- Cypress `layout-id-change.ts` (new): (1) changing layoutId lets a later
  mount with the new id resume from this element; (2) round-trip change.
  Failing-first per Step 1, both React 18 and 19.
- Existing suites as regression gates (Step 5).
- Reference (do not copy verbatim without review): test files on
  `origin/claude/allow-layoutid-changes-a1aJ2` —
  `layout-id-change.test.tsx`, `layoutId-change.test.ts`. JSDOM returns
  zero rects, so treat those unit tests as secondary; the Cypress spec is the
  regression gate.

## Done criteria

- [ ] New Cypress spec fails on unpatched main, passes with fix, on React 18 and 19
- [ ] HTML projection suite green
- [ ] `yarn test-client` (framer-motion) green vs. pre-change baseline
- [ ] No files outside scope modified
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- `setOptions`/`mount` no longer match excerpts (effects/VE unification PR
  #3749 or animateLayout PR #3748 merged and reshaped
  `create-projection-node.ts`) — report, do not adapt on the fly.
- Step 1 spec cannot be made to fail on main (would mean dynamic layoutId
  somehow works now) — re-test against the reporter's exact shape, then
  reclassify as VERIFY-FIXED and report.
- Moving the didUpdate listener (Step 3) changes any HTML projection fixture
  result — the move was not behavior-preserving; report.

## Maintenance notes

- Follow-up A: snapshot/`willUpdate()` at the moment layoutId changes so the
  *change itself* can animate (out of scope here).
- Follow-up B: `MeasureLayout` switchLayoutGroup re-registration for
  AnimateSharedLayout-style promotion configs.
- issue-2567.md builds directly on Steps 3–4; execute it after this lands to
  reuse the helper + idempotent listener.
- Reviewer: scrutinize stack `remove()` promoting a previous member when the
  re-keyed node was lead of its old stack — that promotion is desired (old id
  falls back to remaining member) but is the most likely source of surprise.
