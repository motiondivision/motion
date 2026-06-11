# Plan issue-2636: Answer "whileInView transition overrides whileHover" — by-design (entered variant defines the transition); real fix is issue #1725 — and close

> **Executor instructions**: Follow this plan step by step. If anything in
> "STOP conditions" occurs, stop and report. When done, update this plan's
> row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> 1. `gh api repos/motiondivision/motion/issues/2636 --jq '.state'` → `open`
>    (if closed, mark DONE and stop).
> 2. Check `plans/issues/issue-1725.md`'s row in `plans/issues/README.md` —
>    if `transition.out` already landed, the comment in Step 2 should say
>    "fixed, use `transition: { out: true }`" instead of "tracked in #1725".

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (comment + gated close; no code)
- **Depends on**: soft: plans/issues/issue-1725.md (changes the wording of
  the answer, not the close)
- **Category**: support / by-design
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2636

## Classification: INVALID (by-design) + duplicate-in-substance of #1725 — answer and close (gated)

## Why this matters

Labeled "bug" but the behavior is the documented variant-transition paradigm.
Repro (inline in the issue; the linked CodeSandbox `4flt8c` is
Cloudflare-blocked but the inline code is complete):

```jsx
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1, transition: { duration: 0.4, delay: 3 } }}
  whileHover={{ opacity: [0, 1], transition: { duration: 0.3, delay: 0 } }}
/>
```

Mousing over quickly: hover starts the `[0, 1]` keyframes (opacity snaps to
0), hover ends, and the element animates *back to the `whileInView` state* —
using `whileInView`'s own `transition`, including `delay: 3`. So the element
sits near opacity 0 for 3 seconds. The reporter reads this as the
`whileInView` delay "overriding" the hover transition; actually the hover
animation is over — what they're seeing is the *exit-from-hover* animation,
and the entered (restored) variant defines its transition.

## Why it's by-design (grounding)

- The paradigm, in the maintainer's own words on #1725 (2022-10-05): "the
  current paradigm is that the variant being entered is the one that defines
  the transition used. This is similar to CSS."
- Mechanically: when hover ends, the animation state re-applies the
  `whileInView` target+transition via `animateTarget`
  (`packages/motion-dom/src/animation/interfaces/visual-element-target.ts:33-52`
  — the transition comes from the *target being animated to*; priority
  fallthrough lives in
  `packages/motion-dom/src/render/utils/animation-state.ts`). There is no
  per-edge ("leaving hover") transition in the API today — that is exactly
  issue #1725 / `transition.out` (PR #2951).
- Workarounds to include in the answer:
  1. The one from the issue thread (n-ii-ma, 2024-10-22): put `whileHover`
     on a parent element so the inner `whileInView` element's transition
     never re-runs on hover end.
  2. Once #1725's `transition.out` lands: `whileHover={{ ..., transition:
     { out: true, duration: 0.3 } }}` is the direct fix.
  3. Avoid re-triggering: `whileInView` + `viewport={{ once: true }}` with
     the delay, so the delayed transition runs once and hover exit falls back
     to the default transition — if the reporter's delay is only meant for
     the entrance.

## Steps

### Step 1: Confirm current behavior (cheap sanity check)

No new test infrastructure: confirm by reading
`packages/motion-dom/src/render/utils/animation-state.ts` that gesture-end
re-animates lower-priority variant targets with their own transitions (look
for the props priority list / `whileInView`–`whileHover` ordering). A
throwaway check in the dev app (`dev/react`) is optional; do NOT add tests
for by-design behavior (repo policy: no speculative coverage).

### Step 2 (gate: `plans/issues/README.md` row APPROVED): Answer and close

Comment on #2636: explain the paradigm (entered variant defines the
transition; what they see is the return-to-`whileInView` animation), give
workarounds 1 and 3, and link #1725 as the tracked feature that makes this
expressible (`transition.out`) — or, if 1725's plan already landed, the
direct `out: true` snippet. Close as not_planned (by-design, tracked
elsewhere):
`gh api -X PATCH repos/motiondivision/motion/issues/2636 -f state=closed -f state_reason=not_planned`

## Done criteria

- [ ] Paradigm grounding confirmed in `animation-state.ts`
- [ ] Comment posted linking #1725; issue closed (only with APPROVED row)
- [ ] `plans/issues/README.md` row updated
- [ ] No source files modified

## STOP conditions

- Row not APPROVED → mark row BLOCKED awaiting decision.
- Reading `animation-state.ts` reveals the hover-exit does NOT use the
  re-entered variant's transition (i.e. the premise is wrong and something
  else applies the delay — e.g. a transition-merging bug where `whileInView`'s
  `transition` leaks into the *hover* animation itself) → that would be a
  real bug: STOP and report; the test would then be a Cypress page with the
  issue's exact code asserting the hover animation starts within ~100ms.
