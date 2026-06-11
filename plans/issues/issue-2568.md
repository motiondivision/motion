# Plan issue-2568: Answer "How to delay the drag action?" and close as support question

> **Executor instructions**: This is a SUPPORT issue, not a bug. Post the
> answer, then close ONLY if the gate below is satisfied. Update this issue's
> row in `plans/issues/README.md` when done.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2568 --jq .state` → `open`
> (if closed, mark the row DONE and stop).

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs (support)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2568

## Why this matters

The user asks how to start dragging a `Reorder.Item` only after a press-and-
hold, so normal touch scrolling still works inside a scrollable list. This is
a usage question (no `bug` label, no repro): the capability exists today via
`dragListener={false}` + `dragControls`. Answering and closing keeps the
tracker clean.

## Current state (facts verified in the working tree)

- `Reorder.Item` spreads user props onto the underlying motion component
  (`packages/framer-motion/src/components/Reorder/Item.tsx:99-101` —
  `drag={axis}` then `{...props}`), so `dragListener` and `dragControls`
  pass through.
- `dragListener` (default `true`) controls whether pointerdown on the element
  starts drag (`packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:673,687`).
- `useDragControls().start(event)` starts a drag session imperatively from
  any pointer event.
- There is no built-in `dragStartDelay`/long-press option (verified:
  `grep -rn "delay" packages/framer-motion/src/gestures/drag/ packages/framer-motion/src/gestures/pan/` → no start-delay logic). A long-press
  delay feature would belong with the drag QoL work (plans/021) if ever
  requested widely — do NOT implement it here.

## Steps

### Step 1: Post the answer

Post via:

```bash
gh api repos/motiondivision/motion/issues/2568/comments -f body='<answer>'
```

Answer content (adapt wording, keep the code):

````markdown
Motion doesn't have a built-in drag-start delay, but you can build
press-and-hold-to-drag with `dragListener={false}` and `useDragControls`,
which `Reorder.Item` forwards to the underlying motion component:

```jsx
function Item({ item }) {
    const controls = useDragControls()
    const holdTimer = useRef(null)

    return (
        <Reorder.Item
            value={item}
            dragListener={false}
            dragControls={controls}
            onPointerDown={(e) => {
                // Only start dragging if held for 300ms.
                // Until then, native touch scrolling works as usual.
                holdTimer.current = setTimeout(() => controls.start(e), 300)
            }}
            onPointerUp={() => clearTimeout(holdTimer.current)}
            onPointerCancel={() => clearTimeout(holdTimer.current)}
        >
            {item.label}
        </Reorder.Item>
    )
}
```

Notes:
- Keep `touch-action` untouched on the item so the browser can scroll
  before the hold completes; once `controls.start(e)` runs, Motion takes
  over the pointer.
- If scrolling begins during the hold you may also want to clear the timer
  in an `onPointerMove` that checks movement distance.

Closing as this is a usage question rather than a bug — happy to reopen if
something here doesn't work for your case.
````

Before posting, sanity-check the snippet compiles in a dev page
(`dev/react/src/tests/` temp page, then delete it — do not commit it).

### Step 2: Close (GATED)

**Gate**: the row for issue-2568 in `plans/issues/README.md` must read
`APPROVED` (maintainer decision). If it does not, post the comment (Step 1)
but leave the issue open and mark the row `BLOCKED (awaiting close
approval)`.

If approved:

```bash
gh api -X PATCH repos/motiondivision/motion/issues/2568 -f state=closed -f state_reason=not_planned
```

## Done criteria

- [ ] Comment posted (verify: `gh api repos/motiondivision/motion/issues/2568/comments --jq '.[-1].user.login'`)
- [ ] Issue closed ONLY if gate approved
- [ ] No source files modified (`git status` clean)
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- The snippet does not actually work when smoke-tested (e.g. `controls.start`
  with a stale React synthetic event) — fix the snippet first; if
  `Reorder.Item` does not forward `dragListener`/`dragControls` in practice,
  this is a real bug: report back instead of posting.
