# Plan issue-2246: Close "layout shift when scrollbar appears" as wontfix (maintainer already ruled)

> **Executor instructions**: Bookkeeping-only plan. No source changes. Honor
> the approval gate. When done, update this issue's row in
> `plans/issues/README.md`.
>
> **Drift check (run first)**: `gh api repos/motiondivision/motion/issues/2246 --jq .state`
> → if already `closed`, mark this plan DONE and stop.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support / wontfix bookkeeping
- **Classification**: INVALID/SUPPORT — maintainer declared wontfix but the issue was never actually closed
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2246

## Why this matters

The report: when content growth makes the vertical scrollbar appear, the body
narrows and every `layout` element measures a changed layout, triggering
unwanted position animations. This is the projection system working as
designed — a scrollbar-induced reflow IS a layout change; Motion cannot
distinguish it from an intentional one. The maintainer (mattgperry) commented
on 2026-02-01: **"Closing this as a wontfix as there's nothing much we can do
here but the scrollable-gutter stable fix will be added to the docs next
week"** — but the issue is still open (likely because `gh`/UI close failed or
was forgotten). The environment-level fix is CSS
[`scrollbar-gutter: stable`](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter)
(also suggested by `boar-is` in the thread, 2024-07-01).

There is also a related code-level note: the projection root has a
resize-blocking path (`updateBlockedByResize` /
`wasBlockedByResize`, `packages/motion-dom/src/projection/node/create-projection-node.ts:733-750`)
that suppresses layout animations during window resize — but a scrollbar
appearing without a window resize doesn't fire `resize`, so that mechanism
can't catch this case. Do not attempt to extend it under this plan; that would
contradict the maintainer's ruling.

## Steps

### Step 1: Approval gate

Confirm this plan's row in `plans/issues/README.md` is `APPROVED-CLOSE`. The
maintainer's own wontfix comment is strong evidence, but per repo policy every
close executes only behind an APPROVED row.

### Step 2: Close

```bash
gh api -X PATCH repos/motiondivision/motion/issues/2246 -f state=closed -f state_reason=not_planned
```

Optionally add a final comment pointing at `scrollbar-gutter: stable` and the
maintainer's 2026-02-01 ruling, so future readers land on the workaround:

```bash
gh api repos/motiondivision/motion/issues/2246/comments -f body="Closing per the maintainer's wontfix above. Workaround: apply \`scrollbar-gutter: stable\` (or \`overflow-y: scroll\`) to the scrolling container so scrollbar appearance doesn't change layout. https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter"
```

**Verify**: `gh api repos/motiondivision/motion/issues/2246 --jq .state` → `closed`.

### Step 3: Docs follow-through (report only)

The maintainer's comment promised a docs addition ("scrollable-gutter stable
fix will be added to the docs"). motion.dev docs live outside this repository
— do not attempt it here. In your completion report, flag whether the docs
update can be confirmed (search motion.dev for "scrollbar-gutter"); if absent,
note it as an open follow-up for the maintainer.

## Done criteria

- [ ] Issue #2246 closed as `not_planned` (only behind the APPROVED-CLOSE row)
- [ ] Workaround comment posted (optional but preferred)
- [ ] Docs follow-up status reported
- [ ] `plans/issues/README.md` row updated; no source files modified (`git status` clean)

## STOP conditions

- Row not `APPROVED-CLOSE`.
- New comments on the issue since 2026-02-01 that contradict the wontfix
  (none at planning time) — surface them instead of closing.
