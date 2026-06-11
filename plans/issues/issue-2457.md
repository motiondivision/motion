# Plan issue-2457: Pan handle jumps after page scroll — explain coordinate space, request fresh repro

> **Executor instructions**: This is a NEEDS-REPRO plan: both CodeSandboxes
> are Cloudflare-blocked, so the reporter's coordinate math cannot be
> inspected, and per repo policy (no repro → no fix) no code change is
> allowed here. Post the diagnostic comment; close only behind the gate.
> Update this issue's row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2457 --jq .state` → `open`.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: soft: plans/issues/issue-2024.md (shared "drag after
  scroll" family — if 2024's fix lands, the comment should mention it)
- **Category**: bug (unverified)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2457

## Why this matters

Reporter (Dec 2023, framer-motion v10-era): slider handles driven by `onPan`
work until the page is scrolled; afterwards the handle "jumps away from the
cursor" by what looks like the scroll offset. A follow-up comment says
switching to `onDrag` shows a similar offset. Repro sandboxes
(`82zwjq`, `xm4nv3`) are blocked, so we cannot see how the reported handles
are positioned — but the symptom is the classic page-vs-client coordinate
mixup, and the genuine library-side bugs in this family have since been
fixed.

## Current state (verified in working tree at `42bfbe3ed`)

- `PanInfo.point` is **page-space**, not client-space:
  `packages/framer-motion/src/events/event-info.ts:8-15` —
  `point: { x: event.pageX, y: event.pageY }`. Positioning an element from
  `info.point` while measuring its container with `getBoundingClientRect()`
  (client/viewport-space) produces exactly a "jumps by scroll offset" bug in
  user code. This is the most likely explanation for the `onPan` symptom.
- Library-side fixes in the same symptom family that landed since the report:
  - `5d53f132f` (2026-01-06) — element detaching from cursor when the page or
    a container scrolls *during* drag (#1691).
  - `cfccb0300` (2026-05-12) — stale root scroll when measuring ref
    constraints (#2829).
  - `9f228395e` (2026-02-04) — velocity/momentum carry-over fixes.
- Possible remaining genuine bug: ref-based `dragConstraints` measured before
  a *nested container* scroll are stale at drag start — that is exactly
  issue #2024's diagnosis (see `plans/issues/issue-2024.md`). If the
  commenter's `onDrag` variant used `dragConstraints`, it may be a duplicate
  of #2024 rather than its own bug.

## Steps

### Step 1: Post the diagnostic comment

```bash
gh api repos/motiondivision/motion/issues/2457/comments -f body='<comment>'
```

Comment content (adapt tone, keep facts):

- `info.point` in `onPan`/`onDrag` is **page-relative** (`pageX/pageY`,
  includes scroll). If you position the handle using `info.point` together
  with viewport-relative measurements (`getBoundingClientRect()`), the result
  will be offset by exactly the scroll distance — to mix them, subtract
  `window.scrollX/scrollY`, or use `info.offset` / `info.delta`, which are
  scroll-independent.
- Several scroll-related drag bugs were fixed in 2026 releases (drag during
  scroll #1691; stale scroll constraint measurement #2829). Please retest on
  the latest `motion` v12.
- The original sandboxes can no longer be fetched (Cloudflare-blocked for
  automation); if the problem persists on v12, please share a fresh minimal
  repro and we'll reopen the investigation.

### Step 2: Close (GATED)

**Gate**: row for issue-2457 in `plans/issues/README.md` is `APPROVED`.
If approved:

```bash
gh api -X PATCH repos/motiondivision/motion/issues/2457 -f state=closed -f state_reason=not_planned
```

If not approved: leave open, mark row `BLOCKED (awaiting close approval)`.

## Done criteria

- [ ] Comment posted (check `gh api .../issues/2457/comments --jq '.[-1].body'` mentions pageX)
- [ ] Closed only if gate APPROVED
- [ ] No source files modified
- [ ] `plans/issues/README.md` row updated; if issue-2024's plan was executed
      first, the comment cross-references that fix/PR

## STOP conditions

- You manage to fetch either sandbox after all and the code shows the jump is
  NOT a coordinate mixup (e.g. pure `onPan` with `info.offset` still jumps):
  this becomes a real bug — stop and report so a FIX plan can be written
  (likely joining the issue-2024 root cause).
- The reporter replies with a fresh failing v12 repro before the close gate
  is exercised: stop, report, do not close.
