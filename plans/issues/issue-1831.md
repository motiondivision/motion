# Plan issue-1831: Attempt a minimal repro of "drag release triggers onAnimationComplete for all variants"; report if real, else close needs-repro

> **Executor instructions**: Follow this plan step by step; run every
> verification command. If a STOP condition occurs, stop and report.
> When done, update this plan's row in `plans/issues/README.md`.
> Repo policy: **no repro → no fix, no speculative coverage tests**.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/1831 --jq .state` → `open` (if `closed`, mark DONE-ALREADY and stop).

## Status

- **Classification**: NEEDS-REPRO
- **Priority**: P3 (2022, framer-motion v7-era, repro depends on Chakra UI, 1 comment)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (triage)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/1831

## Why this matters

The report bundles three symptoms from a Chakra-UI-based slideshow sandbox
(`e6q75o`, Cloudflare-blocked for agents, built on framer-motion ~7):
(1) releasing a drag fires `onAnimationComplete` for ALL three variants in
quick succession, not just the winning one; (2) the first drag on a box
doesn't move it; (3) a first-drag flick kills the re-centering animation.
Symptom 1 is plausibly *current by-design behavior*: ending a drag calls
`animationState.setActive("whileDrag", false)`, which re-evaluates every
variant layer; values already at target produce instantly-completing
animations, each firing `onAnimationComplete` with its variant name. Symptoms
2–3 match first-drag bugs that have since been fixed (see the comment block
at `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:571–577`,
"fixes an issue where elements with initial coordinates would snap to the
wrong position on the first drag", and the momentum fixes in `9f228395e`).
Four major versions later, the sandbox is unfetchable and entangled with
Chakra — this needs a fresh minimal repro before any code is touched.

## Current state

- `packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:305`
  — `cancel()` runs `animationState.setActive("whileDrag", false)` on every
  release; variant re-evaluation then animates whatever layers are active.
- Variant resolution/animation: `packages/framer-motion/src/render/utils/animation-state.ts`
  (read before forming any theory about which layers fire callbacks).
- No `gh` access to the sandbox; the issue body fully specifies the minimal
  shape: one `motion.div` with `drag`, three variants (base / exiting /
  centered, later variants overriding earlier), `animate={[...]}`-style
  multi-variant array, and `onAnimationComplete={(def) => log(def)}`.

## Commands you will need

| Purpose | Command | Expected |
|---------|---------|----------|
| Build | `yarn build` (repo root) | exit 0 |
| Server (React 18) | `PORT=$((10000 + RANDOM % 50000)); cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT &` then `npx wait-on http://localhost:$PORT` | up |
| Manual probe | open `http://localhost:$PORT/?test=<fixture>` | console output |

## Scope

**In scope**: a throwaway fixture `dev/react/src/tests/drag-variants-complete.tsx`
(uncommitted unless a real bug is confirmed); `plans/issues/README.md` row;
the GitHub comment/close.
**Out of scope**: any change to `animation-state.ts`, drag source, or any
committed test without a confirmed repro.

## Steps

### Step 1: Build the minimal fixture (no Chakra)

`dev/react/src/tests/drag-variants-complete.tsx`: a draggable `motion.div`
with `variants` containing `base`, `exiting`, `center` (distinct `x`/`scale`/
`opacity` targets), `animate={["base", "center"]}`, `whileDrag={{ scale: 1.05 }}`,
and `onAnimationComplete` pushing the definition into a `window.__completed`
array. Time-box: ~45 min.

### Step 2: Probe the headline symptom

Manually (or via a quick foreground Cypress run): drag the box a few px and
release without a flick; inspect `window.__completed`.

- If only the expected variant(s) complete → symptom 1 not reproducible on
  main → Step 3.
- If ALL variant names fire immediately on release → reproduced. Determine in
  one read of `animation-state.ts` whether this is by-design layer
  re-evaluation (likely) or a genuine double-fire. Either way: STOP and
  report findings — by-design gets a documentation-style close proposal,
  a genuine bug gets its own fix plan.

Also note (don't deep-dive) whether the first drag moves the box — symptoms
2–3 are believed fixed by later first-drag/momentum work.

**Verify**: a written observation of `__completed` contents for at least 3 release scenarios (no-flick, flick, release-during-animation).

### Step 3 (gated): Close as needs-repro / outdated

**Gate: only if this plan's row in `plans/issues/README.md` is marked APPROVED.**

Comment via `gh api repos/motiondivision/motion/issues/1831/comments -f body="..."`:
the original sandbox targets framer-motion 7 and is no longer accessible; a
minimal reconstruction on the current release does not reproduce the
all-variants-complete behavior (include your fixture code inline so the
reporter can extend it); first-drag bugs were fixed separately (`9f228395e`
and the snap-to-cursor origin fix); ask for a fresh repro on the latest
release if it persists.
Close: `gh api -X PATCH repos/motiondivision/motion/issues/1831 -f state=closed -f state_reason=not_planned`.

## Done criteria

- [ ] Fixture built; the three release scenarios observed and recorded
- [ ] No source changes; fixture not committed unless a bug was confirmed (`git status`)
- [ ] Issue commented + closed only if README row APPROVED; otherwise row set to the branch reached ("NO-REPRO — awaiting close approval" / "REPRO — needs follow-up plan")

## STOP conditions

- Step 2 reproduces the all-variants-complete behavior — report; do not
  patch `animation-state.ts` under this plan.
- The fixture can't express the scenario without AnimatePresence-style
  exit flags after 2 attempts — report what's missing instead of growing the
  fixture toward the full Chakra sandbox.

## Maintenance notes

- If reproduced and judged by-design, the actionable follow-up is docs: the
  `onAnimationComplete` contract with multi-variant `animate` arrays is
  undocumented and this issue is evidence of the confusion.
