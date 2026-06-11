# Plan issue-2563: Close "display: 'none' cannot be set" as covered by the issue-2656 fix (v11.2.0)

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2563 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/issues/issue-2656.md (run its Step 1 verification first)
- **Category**: bug / covered
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2563

## Verdict: COVERED — same root cause as issue #2656, fixed in v11.2.0

Reported 2024-03-16 against 11.0.14: with `useAnimate`,
`animate(el, { opacity: 0, display: "none" }, { duration: 0.7 })` animated
opacity but left `display` at its previous value; every other display keyword
(`inline`, `contents`, `flex`) worked. 8 comments confirm the same symptom and
that the `transitionEnd: { display: "none" }` workaround functioned. One
commenter (modulareverything, 2024-05-03) bisected it to the v10→v11.1.x
upgrade — i.e. the same 11.0.11 async-keyframe-resolution regression as #2656.

Why only `"none"` broke: `"none"` (unlike `"inline"`/`"contents"`) is treated
as a special keyframe by the resolver (`isNone()` —
`packages/motion-dom/src/animation/keyframes/utils/is-none.ts:8`) and by the
mixers, so it followed the broken discrete-mix path while other keywords fell
through to `mixImmediate`.

The fix is the same one verified in `plans/issues/issue-2656.md`: commit
`9dc6e6aa1` (released v11.2.0, CHANGELOG.md:1936) added `mixVisibility`
(`packages/motion-dom/src/utils/mix/visibility.ts:8-14`), which applies
`display: "none"` at the end of a hide animation. The `useAnimate`/standalone
`animate()` path is covered too: element animations create DOM visual elements
(`packages/framer-motion/src/animation/animate/subject.ts:134` →
`createDOMVisualElement`) and run through the same
`AsyncMotionValueAnimation` → `JSAnimation` → `mix` pipeline (display is never
WAAPI-accelerated — it is not in `acceleratedValues`, see
`packages/motion-dom/src/animation/waapi/supports/waapi.ts:60`).

Note: the post-fix behaviour is intentionally that `display: "none"` is set
when the animation **completes** (0.7s in the reporter's code), not at the
start — that is the designed behaviour, not a bug.

## Steps

### Step 1: Verify via issue-2656's regression tests

```
npx jest --config packages/framer-motion/jest.config.json --testPathPattern="animate-prop" -t "display"
```

**Verify**: all display tests pass. If any fail, STOP (see issue-2656 plan).

### Step 2: Approval gate

Open `plans/issues/README.md` and find the row for issue-2563. If not marked
APPROVED, set this plan's row to BLOCKED and stop.

### Step 3: Comment + close

```
gh api repos/motiondivision/motion/issues/2563/comments -f body="This was the same regression as #2656 and was fixed in v11.2.0 (2024-05-14). Since then, animating to display: 'none' holds the visible value for the duration of the animation and applies 'none' when the animation completes — so with your 0.7s duration, display switches to none after 0.7s (by design, so the element stays visible while it fades out). The transitionEnd workaround is no longer required. If you can still reproduce on motion@12, please open a new issue with a reproduction."
gh api -X PATCH repos/motiondivision/motion/issues/2563 -f state=closed -f state_reason=completed
```

**Verify**: `gh api repos/motiondivision/motion/issues/2563 --jq .state` → `"closed"`.

## Done criteria

- [ ] Step 1 Jest tests pass
- [ ] Issue commented and closed as `completed` (only after APPROVED)
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Step 1 tests fail → report back; do not close.
- README row not APPROVED → BLOCKED.
