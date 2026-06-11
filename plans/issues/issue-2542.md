# Plan issue-2542: Close "whileHover not working when child has variant-string animate" as working-as-designed

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2542 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support / by-design
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2542

## Verdict: INVALID/SUPPORT — documented variant-propagation behaviour

The issue (2024-03-05, 0 comments, screenshot only — no sandbox) shows:

- Parent: `<motion.div whileHover="hover">`
- Child: `<motion.img variants={imageVariant} animate={"enter"}
  initial="initial" custom={index} />`

Expectation: hovering the parent plays the child's `hover` variant. Actual:
nothing — because the child sets its own `animate` prop, which makes it a
*controlling* variant node, and controlling nodes opt out of parent variant
propagation. This is documented behaviour ("variants flow down through
children until a child defines its own `animate`"), not a bug.

Code grounding (working tree):

- `packages/motion-dom/src/render/utils/is-controlling-variants.ts:6-13` —
  any variant-label animation prop (incl. `animate="enter"`) marks the node
  as controlling variants.
- `packages/motion-dom/src/render/VisualElement.ts:462` — a child only
  registers for parent variant propagation when it is NOT controlling:
  ```ts
  if (this.parent && this.isVariantNode && !this.isControllingVariants) {
  ```
- `packages/framer-motion/src/context/MotionContext/utils.ts` —
  `getCurrentTreeVariants` likewise stops passing tree variants through a
  controlling node.

Supported patterns for the reporter's goal:

1. Move the enter animation up: put `initial="initial" animate="enter"` on the
   **parent** and let both `enter` and `hover` propagate to the child via its
   `variants` (child keeps `variants`/`custom` but no `animate`).
2. Or drive hover explicitly: track hover state on the parent
   (`onHoverStart`/`onHoverEnd`) and set the child's
   `animate={isHovered ? "hover" : "enter"}`.

## Steps

### Step 1: Approval gate

Open `plans/issues/README.md`, find the issue-2542 row. If not APPROVED, mark
this plan BLOCKED and stop.

### Step 2: Comment + close

```
gh api repos/motiondivision/motion/issues/2542/comments -f body="This is working as designed: variant labels set via whileHover on a parent propagate down only to children that don't define their own animate prop. Because the motion.img sets animate={'enter'}, it becomes a controlling variant node and opts out of inheriting the parent's hover variant. Two supported ways to get the effect you want: (1) move initial/animate variant labels to the parent and let enter + hover propagate to the child via its variants, or (2) track hover on the parent with onHoverStart/onHoverEnd and set the child's animate={isHovered ? 'hover' : 'enter'}."
gh api -X PATCH repos/motiondivision/motion/issues/2542 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2542 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned` (only after APPROVED)
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- README row not APPROVED → BLOCKED.
- If, while sanity-checking, you find that pattern (1) above does NOT work in
  a quick dev/react sandbox, stop and report — that would indicate a real
  propagation bug and a different plan.
