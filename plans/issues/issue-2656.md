# Plan issue-2656: Verify display block→none animation is fixed (landed v11.2.0) and close

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2656 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop. Then
> confirm the excerpts below still match
> `packages/motion-dom/src/utils/mix/visibility.ts` and
> `packages/framer-motion/src/motion/__tests__/animate-prop.test.tsx`.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug / verify-fixed
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2656

## Verdict: VERIFY-FIXED — fix landed in v11.2.0, four days after the report

Reported 2024-05-10 against 11.0.11: variants animating `display: block` ↔
`display: none` (alongside `opacity`) stopped returning to `none` when hiding.
Worked in 11.0.10. Root cause: 11.0.11's async-keyframe-resolution rewrite
(CHANGELOG.md:2111-2118, "Keyframes now resolved asynchronously") changed how
discrete string keyframes were mixed, losing the `none` end state.

mattgperry confirmed the regression on 2024-05-13 ("this did get inadvertently
broken though the previous behaviour wasn't great either — instantly animating
to 'none'") and landed the fix the same day: commit `9dc6e6aa1` ("Updating",
2024-05-13) added `mixVisibility`, released in **v11.2.0** (CHANGELOG.md:1932,
entry at line 1936: "Binary visibility interpolation i.e `display: ["block",
"none"]` now maintains the visible state throughout the animation"). The issue
was never closed. The 2024-08-26 "Any progress?" comment predates wide adoption
of the fix only in the commenter's project — the fix was already released.

## Current state (the fix, in the working tree)

- `packages/motion-dom/src/utils/mix/visibility.ts:8-14` — hiding holds the
  visible keyframe until the end; showing applies the visible keyframe
  immediately:
  ```ts
  export function mixVisibility(origin: string, target: string) {
      if (invisibleValues.has(origin)) {
          return (p: number) => (p <= 0 ? origin : target)
      } else {
          return (p: number) => (p >= 1 ? target : origin)
      }
  }
  ```
- `packages/motion-dom/src/utils/mix/complex.ts:112-120` — `mixComplex` routes
  `display`/`visibility`-style keyframes (`invisibleValues` = `"none"`,
  `"hidden"`) into `mixVisibility`.
- `packages/motion-dom/src/animation/utils/can-animate.ts:36` —
  `if (name === "display" || name === "visibility") return true` keeps these
  values on the JS animation path (display is not in `acceleratedValues`, so
  WAAPI is never used for it).
- On finish, `JSAnimation.tick` writes the real final keyframe:
  `packages/motion-dom/src/animation/JSAnimation.ts:335-342`
  (`state.value = getFinalKeyframe(...)` → `"none"`).
- Regression tests already exist:
  `packages/framer-motion/src/motion/__tests__/animate-prop.test.tsx:250-307`
  ("animate display none => block immediately switches to block", "animate
  display block => none switches to none on animation end").
- Dev fixture: `dev/react/src/examples/Animation-display-visibility.tsx`
  (added by the fix commit).

## Steps

### Step 1: Run the existing regression tests

```
npx jest --config packages/framer-motion/jest.config.json --testPathPattern="animate-prop" -t "display"
```

**Verify**: all display tests pass (≥3 tests, 0 failures). If any fail, STOP —
that's a live regression; this plan's verdict is wrong and the issue needs a
FIX plan instead.

### Step 2 (optional, real-browser confidence): Cypress check

The issue's StackBlitz (vitejs-vite-mc7x2z) is described fully in the issue
body: overlay with variants `{opacity: 1, display: "block"}` /
`{opacity: 0, display: "none"}`, toggled by a button; bug = display stayed
`block` after hiding. If you want browser-level proof, create
`dev/react/src/tests/animate-display-none.tsx` + a spec asserting
`getComputedStyle(el).display === "none"` after the hide animation completes
(and `"block"` mid-animation), and run it per the CLAUDE.md Cypress recipe on
React 18 and 19. Delete nothing — keep the test as permanent coverage if you
write it. This step may be skipped; Step 1 is the gate.

### Step 3: Approval gate

Open `plans/issues/README.md` and find the row for issue-2656. If not marked
APPROVED, set this plan's row to BLOCKED and stop.

### Step 4: Comment + close

```
gh api repos/motiondivision/motion/issues/2656/comments -f body="This was fixed in v11.2.0 (released 2024-05-14, four days after this report): binary visibility interpolation now keeps the element visible throughout the animation and applies display: none only when the hide animation completes (and conversely applies the visible value immediately when showing). The behaviour is covered by unit tests (animate-prop.test.tsx). If you can still reproduce on motion@12, please open a new issue with a reproduction."
gh api -X PATCH repos/motiondivision/motion/issues/2656 -f state=closed -f state_reason=completed
```

**Verify**: `gh api repos/motiondivision/motion/issues/2656 --jq .state` → `"closed"`.

## Done criteria

- [ ] Step 1 Jest tests pass
- [ ] Issue commented and closed as `completed` (only after APPROVED)
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Step 1 tests fail → report back; do not close.
- README row not APPROVED → BLOCKED.

## Related

- issue-2563 (`plans/issues/issue-2563.md`) is the same root cause via
  `useAnimate` — close it together with this one.
