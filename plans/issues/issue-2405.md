# Plan issue-2405: Verify whether the "second close" layout-transition glitch still reproduces

> **Executor instructions**: Verification-first plan. The reproduction
> sandboxes are unreachable, and repo policy is **no repro → no fix** (and no
> speculative test coverage). Follow the steps; the reproduction outcome
> decides the path. Honor the approval gate before closing. Update the row in
> `plans/issues/README.md` when done.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2405 --jq .state` → must be `open`.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (verify-fixed candidate)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2405

## Why this matters

Reported Nov 2023 (framer-motion ~10.x): open a popup via layout transition,
close it — first close is perfect, every subsequent close glitches. A second
user (+1 comment, Dec 2023) reproduced with a card-expand pattern. The
symptom signature (first cycle fine, later cycles broken) points at stale
shared-stack state, and that exact area has had substantial fixes since:

- `90a3dfbda` "Discard zero snapshots (#3030)" (2025-01) — now in
  `updateSnapshot()`, `create-projection-node.ts:885-897`
- `656a77142` "Fix stale shared layout nodes during SPA navigations"
  (2026-02) and `ea1448e4b` "actually fix SPA, simplify logic" (2026-02) —
  the disconnected-member cleanup now in `NodeStack.add()`,
  `packages/motion-dom/src/projection/shared/stack.ts:12-20`

So this is a strong VERIFY-FIXED candidate, but it must be proven with a
reproduction, not assumed.

## Current state

- Both sandboxes are unreachable at planning time (CodeSandbox API/pages
  behind Cloudflare 403): `codesandbox.io/s/young-tree-wmwqv5` (issue) and
  `codesandbox.io/p/devbox/framer-motion-shared-layout-animation-v26vfg`
  (comment). Retry them first — access may differ from the planning
  environment.
- The issue text fully specifies the interaction: red square → popup with
  layout transition; blue square → close; repeat; close #2+ glitches.
  The canonical pattern this describes is the docs' card-expand:
  `{!open && <motion.div layoutId="card" />}` plus
  `<AnimatePresence>{open && <motion.div layoutId="card" className="overlay" />}</AnimatePresence>`.
- Existing similar specs to model on:
  `packages/framer-motion/cypress/integration/layout-shared-lightbox-crossfade.ts`
  and its test page `dev/react/src/tests/layout-shared-lightbox-crossfade.tsx`;
  also `dev/react/src/examples` contains AnimateSharedLayout-style card
  demos.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build | `yarn build` (root) | exit 0 |
| Cypress React 18 | CLAUDE.md recipe (Vite `dev/react` on random port → `cypress run --headed --config baseUrl=... --spec cypress/integration/layout-shared-repeat-toggle.ts`) | see steps |
| Cypress React 19 | same with `dev/react-19` + `--config-file=cypress.react-19.json` | see steps |

## Scope

**In scope**:
- `dev/react/src/tests/layout-shared-repeat-toggle.tsx` (create)
- `packages/framer-motion/cypress/integration/layout-shared-repeat-toggle.ts` (create)
- Fix code ONLY if Step 2 reproduces, and then expect it in
  `packages/motion-dom/src/projection/shared/stack.ts` or the
  promote/relegate/snapshot path of `create-projection-node.ts` — report
  before any change larger than ~30 lines there.

**Out of scope**:
- Speculative fixes without a red test (repo policy).
- Merging happy-path-only tests: if the test never fails on the bug, do NOT
  open a PR with it (see memory: no repro → no speculative coverage).

## Steps

### Step 1: Try the sandboxes once more

WebFetch/curl both sandbox URLs. If reachable, base the test page on the
actual code. If not (expected), proceed with the reconstruction below and say
so explicitly in any issue comment.

### Step 2: Build the repeat-toggle repro

`dev/react/src/tests/layout-shared-repeat-toggle.tsx` exporting `App`:

- `#card`: 100×100 `motion.div layoutId="popup"` rendered when `!open`.
- `#overlay`: 400×400 centered `motion.div layoutId="popup"` inside
  `<AnimatePresence>` rendered when `open`.
- `#toggle` button flips `open`.
- `transition={{ type: "tween", ease: "linear", duration: 0.3 }}` (short —
  we must run multiple full cycles), plus expose a counter of completed
  cycles via `onLayoutAnimationComplete` writing to a `data-` attribute so
  the spec can wait deterministically instead of guessing with waits.

Spec `layout-shared-repeat-toggle.ts`:
1. Cycle open→close twice, waiting for each animation to complete via the
   data-attribute.
2. On the SECOND close, sample `#card`'s bounding rect ~mid-animation with
   `.then()` (not `.should()`) and assert it lies on the straight-line path
   between overlay box and card box (within tolerance ~30px), and that after
   completion it exactly equals the first-close resting rect.
3. Repeat for a third cycle (issue says "always buggy from then on").

**Verify**: run on React 18. Two outcomes:
- **Reproduces** (assertions fail the way the videos show — wrong origin /
  jump): continue to Step 3.
- **Does not reproduce** after honest effort (try also `position: fixed`
  overlay variant and a crossfade-disabled variant `layoutCrossfade={false}`;
  2-3 variants max per repo debugging policy): go to Step 5.

### Step 3 (repro only): Bisect to the responsible state

With a red test in hand, instrument: log `projection.snapshot`,
`stack.members.length`, `stack.lead`/`prevLead` identity across cycles
(`window`-expose from the test page or via `cy.window()`). The hypothesis
hierarchy: (a) exited members never leave `stack.members` so `relegate()`
promotes a dead node; (b) `snapshot` from cycle 1 leaks into cycle 2 via
`promote()` copying `prevLead.snapshot` (stack.ts:64-68); (c) `resumingFrom`
chain not cleared (`create-projection-node.ts:553-556`).

### Step 4 (repro only): Fix + gates

Fix in the location implicated by Step 3 (expected: stack membership
cleanup on exit completion). Then: red test goes green on React 18 AND 19;
HTML projection suite green; `layout-shared*.ts`, `layout-group.ts` (flaky —
re-run once), `animate-presence-layout.ts` specs green.

### Step 5 (no repro): VERIFY-FIXED path

Post a comment on #2405: reconstruction attempted at `<commit>`, sandboxes
unreachable (Cloudflare), describe the three variants tested, link the test
page code, and ask the reporter to confirm against framer-motion ≥ 12.34
(which contains the stale-shared-node fixes). Recommend closing. Close ONLY
after the `plans/issues/README.md` row is set to `APPROVED-CLOSE`:
`gh api -X PATCH repos/motiondivision/motion/issues/2405 -f state=closed -f state_reason=not_planned`.
Per policy, do NOT merge the reconstruction test if it never failed — delete
it or stash it in the comment as a gist.

## Done criteria

- [ ] Reproduction verdict recorded (which variant, which assertion, React 18/19)
- [ ] If fixed: failing-first test + fix merged-ready, all gates green
- [ ] If no repro: comment drafted/posted, close gated on README approval, no test-only PR
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- Step 2 reproduces but Step 3 implicates `create-projection-node.ts`
  animation internals beyond promote/relegate/snapshot (>30-line change) —
  report with findings; PRs #3748/#3749 are reshaping this file.
- The bug reproduces in Cypress/Electron only intermittently — flaky-repro
  bugs in this suite are a known trap (layout-group.ts family); re-run and
  report rather than landing a racy test.

## Maintenance notes

- If VERIFY-FIXED: note on the issue which commits likely fixed it
  (`90a3dfbda`, `656a77142`, `ea1448e4b`) so future archaeology is cheap.
- This issue's symptom overlaps issue #2338's (stale stack state across
  unmount/remount); share the test-page pattern if both plans execute.
