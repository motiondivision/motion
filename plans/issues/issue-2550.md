# Plan issue-2550: Close docs-note request (custom components with their own `style` prop) — docs live outside this repo

> **Executor instructions**: Follow step by step; run the drift check first.
> Update the status row for this plan in `plans/issues/README.md` when done.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2550 --jq .state`
> → expect `"open"`. If already closed, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs / invalid-here
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2550

## Verdict: INVALID-here — a docs change for a site not maintained in this repo

Filed 2024-03-12. Request: add a note to the "Custom components" section of
the (then framer.com/motion) docs saying that a component passed to
`motion(Component)` shouldn't declare its own `style` prop, because the
resulting type intersection rejects `MotionValue` styles, e.g.:

```
Type 'MotionValue<string>' is not assignable to type
'(Rotate & (string | number | MotionValue<number> | ...)) | undefined'.
```

Grounding:

- The TS behaviour still exists and is structural:
  `packages/framer-motion/src/render/components/create-proxy.ts:13-14` types
  custom components as
  `React.PropsWithoutRef<Props & MotionProps>` — when `Props` already has a
  `style`, the intersection `Props["style"] & MotionProps["style"]` is what
  produces the reported error. "Fixing" the types (e.g. `Omit<Props, keyof
  MotionProps> & MotionProps`) would be a separate, breaking type-level
  change nobody has asked for here — the issue explicitly only requests a
  docs note.
- The docs pages referenced (framer.com/motion) no longer exist; current docs
  are at motion.dev and are maintained outside this repository. There is
  nothing in this repo to change.

## Steps

### Step 1: Approval gate

Open `plans/issues/README.md`, find the issue-2550 row. If not APPROVED, mark
this plan BLOCKED and stop.

### Step 2: Comment + close

```
gh api repos/motiondivision/motion/issues/2550/comments -f body="Thanks — this is a fair note, but the docs aren't maintained in this repository (and the framer.com/motion pages this referenced have since been replaced by motion.dev). The underlying behaviour still holds: motion.create(Component) intersects your component's props with MotionProps, so a component that declares its own style prop will conflict with MotionValue-typed styles; the workaround is to not declare a conflicting style type on the wrapped component (or rename that prop). We'll flag the suggestion for the motion.dev custom-components docs. Closing here as there's no code change to make in this repo."
gh api -X PATCH repos/motiondivision/motion/issues/2550 -f state=closed -f state_reason=not_planned
```

**Verify**: `gh api repos/motiondivision/motion/issues/2550 --jq .state` → `"closed"`.

## Done criteria

- [ ] Comment posted; issue closed as `not_planned` (only after APPROVED)
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- README row not APPROVED → BLOCKED.

## Maintenance notes

- If the maintainer ever wants the type-level fix instead of a docs note,
  that is a separate plan: change `ComponentProps<Props>` in
  `create-proxy.ts` to omit Motion-owned keys from `Props` before
  intersecting — breaking for consumers relying on the current intersection,
  so next-major only.
