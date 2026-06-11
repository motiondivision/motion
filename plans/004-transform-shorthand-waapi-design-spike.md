# Plan 004: Design spike — WAAPI acceleration for transform shorthands (`x`/`y`/`scale`/`rotate`)

> **Executor instructions**: This is a DESIGN SPIKE — the deliverable is a
> design document, NOT source-code changes. Do not modify any file under
> `packages/`. Follow the steps, run the read-only verification commands, and
> write the deliverable. If anything in the "STOP conditions" section occurs,
> stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/waapi/ packages/framer-motion/src/animation/optimized-appear/`
> If these areas changed materially since this plan was written, note it in
> the design doc rather than stopping — this spike is investigative.

## Status

- **Priority**: P2
- **Effort**: M (investigation + writing; the eventual implementation is L and is NOT this plan)
- **Risk**: LOW (no source changes)
- **Depends on**: none (plan 003 shares the eligibility gate; read it for context but neither blocks the other)
- **Category**: direction / perf
- **Planned at**: commit `42bfbe3ed`, 2026-06-10

## Why this matters

The single most common Motion idiom — `animate={{ x: 100 }}`, `scale`, `rotate` — is NOT hardware accelerated. These transform shorthands are independent motion values, so they miss the `acceleratedValues` gate (which only accepts a literal `transform` string) and run as per-frame JS animations that rebuild and rewrite the element's entire style block every frame. The repo's own `PERFORMANCE_AUDIT.md` ranks fixing this as the #1 highest-leverage change ("Map shorthands to a single composited `transform` WAAPI animation, as optimized-appear already does" — HIGH impact, Large effort). Because the implementation is large and has real interrupt/composition hazards, the next step is a design document that settles the approach, not code.

## Current state

- `packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts:4-12` — the set contains `"transform"` but not `x`/`y`/`scale`/`rotate`/etc.
- `packages/motion-dom/src/animation/waapi/supports/waapi.ts:53-74` — per-VALUE eligibility check; today each motion value animates independently, so `x` and `scale` on the same element are two separate animations. A single composited `transform` WAAPI animation must combine them — this is the core design problem.
- `packages/framer-motion/src/animation/optimized-appear/` — the existing prior art: server-rendered appear animations already compose transform shorthands into a single WAAPI `transform` animation. This is the primary code to study.
- `packages/motion-dom/src/animation/AsyncMotionValueAnimation.ts:170-188` — where WAAPI vs JS is chosen per value.
- Modern alternative to evaluate: independent CSS transform properties (`translate`, `scale`, `rotate`) are animatable individually via WAAPI in all evergreen browsers — potentially sidestepping the composition problem for three of the shorthands.
- Known constraint from `waapi.ts:62`: `transformTemplate` forces the JS path; any design must preserve that.
- Related debt (from prior sessions): `pathRotation` composes onto rotation at multiple render sites, and the in-flight effects/VisualElement unification (branch `worktree-style-effect`) changes how transforms are rendered. The design must state its assumptions about which world it lands in.

## Commands you will need

All read-only:

| Purpose | Command | Expected |
|---|---|---|
| Find optimized-appear transform handling | `grep -rn "transform" packages/framer-motion/src/animation/optimized-appear/ --include="*.ts" -l` | file list to read |
| Find per-value animation start | `grep -rn "supportsBrowserAnimation" packages/motion-dom/src --include="*.ts"` | call sites |
| Benchmarks dir | `ls dev/html/public/benchmarks/` | existing benchmark fixtures to model measurement on |

## Scope

**In scope** (files you may create):
- `plans/004-transform-shorthand-waapi/design.md` (the deliverable)
- `plans/004-transform-shorthand-waapi/benchmark-notes.md` (optional, if you run existing benchmarks)

**Out of scope**:
- ANY file under `packages/` or `dev/` — read-only spike.
- Implementing a prototype — only if the operator explicitly asks afterwards.

## Git workflow

- Branch: not required (plans/ only). If the operator prefers a branch: `advisor/004-transform-shorthand-spike`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Study the prior art

Read `packages/framer-motion/src/animation/optimized-appear/` end to end. Document in the design doc: how multiple transform shorthands become one WAAPI keyframe track; how handoff back to the JS world works (`handoff-optimized-appear-animation`); what state is read on interrupt.

**Verify**: design doc section "Prior art: optimized-appear" exists with ≥5 `file:line` citations.

### Step 2: Map the runtime constraints

Document, with citations, how the current runtime would interact with a composed transform animation:

1. Per-value architecture: `MotionValue` per shorthand, each with its own `AsyncMotionValueAnimation`. Where would composition live — a per-element transform coordinator? Who owns it (VisualElement? a new effect in `motion-dom/src/effects/`)?
2. Interrupt semantics: animating `x` then animating `scale` mid-flight — with one composed WAAPI animation, starting `scale` must rebuild keyframes including `x`'s current value. Document how `NativeAnimation` currently samples on interrupt and what velocity information is lost.
3. Mixed-driver cases: `x` via WAAPI + `rotate` via drag/JS simultaneously — both write `transform`. Who wins? (Today: single JS-built transform string; composed WAAPI would conflict.)
4. Projection/layout animations override transform entirely (`applyProjectionStyles`) — the gate must exclude elements with active projection.
5. `transformTemplate`, `onUpdate`, `pathRotation`/`orientToPath` — enumerate every transform contributor and whether it forces the JS path.

**Verify**: design doc section "Constraints" covers all 5 numbered items with citations.

### Step 3: Evaluate the two candidate architectures

- **A. Composed `transform` track** (the optimized-appear approach generalized): one WAAPI animation per element rebuilt on every transform-value change.
- **B. Independent CSS properties**: map `x`/`y` → `translate`, `scale` → `scale`, `rotate` → `rotate` WAAPI animations; no composition needed; but: `translate` is a single property for x+y (partial composition remains), interaction with the existing `transform` string output, browser-support floor, and the value-reading story (`getComputedStyle` returns resolved values).

For each: bundle-size impact (this repo prioritizes small output), correctness risks, what fraction of real-world cases it accelerates, and incremental-delivery path (e.g. B can ship `rotate` alone first). Recommend one, with a staged rollout sketch and the test matrix the implementation plan would need.

**Verify**: design doc section "Decision" contains an explicit recommendation and a staged plan with effort estimates per stage.

### Step 4: Benchmark baseline (optional but recommended)

If `dev/html/public/benchmarks/` contains a transform benchmark, run it on built `main` and record numbers in `benchmark-notes.md` as the baseline the implementation must beat. Do not write new benchmark code into `dev/` — describe needed benchmarks in the design doc instead.

**Verify**: numbers recorded, or a note explaining why not run.

## Test plan

Not applicable (no code). The design doc must instead SPECIFY the test plan the future implementation needs: eligibility unit matrix, interrupt E2E, mixed-driver E2E, projection-exclusion E2E, visual-parity checks.

## Done criteria

- [ ] `plans/004-transform-shorthand-waapi/design.md` exists with sections: Prior art, Constraints (5 items), Candidate architectures A/B, Decision, Staged rollout, Required test matrix, Open questions
- [ ] Every factual claim about current behavior carries a `file:line` citation
- [ ] `git status` shows no modified files outside `plans/`
- [ ] `plans/README.md` status row updated

## STOP conditions

- The effects/VisualElement unification branch (`worktree-style-effect`) has merged to `main` since this plan was written — the rendering substrate changed; flag prominently in the doc's assumptions section and continue (this is the one drift you absorb rather than stop on), but if transforms now render via per-key effects, re-center the design on that world.
- You cannot determine how optimized-appear hands off to the runtime after ~1 hour of reading — report what's unclear rather than guessing in the doc.

## Maintenance notes

- This doc is the input to a future implementation plan (likely 2–3 plans: coordinator/effect, eligibility + handoff, rollout flag). Keep "Open questions" honest — unanswered questions there are cheaper than wrong answers.
- The maintainer context that shapes this: effects unification is the strategic rendering direction; a design that fights it will be rejected.
