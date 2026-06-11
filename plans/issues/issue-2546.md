# Plan issue-2546: Answer horizontal target-tracking with `axis: "x"` and confirm before closing

> **Executor instructions**: Follow this plan step by step. No source changes.
> If anything in "STOP conditions" occurs, stop and report. When done, update
> the status row for this issue in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2546 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/render/dom/scroll/`
> — if `on-scroll-handler.ts` or `offsets/index.ts` changed, re-verify the
> "Current state" excerpts before relying on the diagnosis.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: support
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2546

## Why this matters

Reporter forked the vertical element-tracking sandbox from #2076 into a
horizontal container and found the returned progress reflects the container's
scroll, not the target element. The mechanism is fully explainable from the
code: target-relative offset resolution only runs for the configured `axis`,
which defaults to `"y"`. `scrollXProgress` from a `useScroll` call that never
passes `axis: "x"` is therefore the **raw container** x-progress — exactly
the reported symptom. This is a support answer (plus a possible docs/DX gap),
not an engine bug.

## Current state

- `packages/framer-motion/src/render/dom/scroll/on-scroll-handler.ts:66-73` —
  per scroll event: `updateScrollInfo` fills raw container progress for BOTH
  axes, then offsets are resolved for one axis only:
  ```ts
  measure(element, options.target, info)
  updateScrollInfo(element, info, time)
  if (options.offset || options.target) {
      resolveOffsets(element, info, options)
  }
  ```
- `packages/framer-motion/src/render/dom/scroll/offsets/index.ts:22` —
  `const { target = container, axis = "y" } = options` — `resolveOffsets`
  writes `info[axis].progress` for that single axis only (line 84).
- `packages/framer-motion/src/render/dom/scroll/info.ts:55` — the raw
  fallback the reporter is seeing on x:
  `axis.progress = progress(0, axis.scrollLength, axis.current)`.
- `packages/framer-motion/src/value/use-scroll.ts:19-23` — `UseScrollOptions`
  extends `ScrollInfoOptions` minus container/target, so `axis: "x"` IS
  accepted by `useScroll` and forwarded (`use-scroll.ts:129-133` spreads
  options into `scroll()`).
- Reproduction access: the CodeSandbox
  (`framer-motion-track-element-position-forked-xph5yn`) is behind Cloudflare
  — not fetchable at planning time, so the "missing `axis: 'x'`" diagnosis is
  high-confidence (symptom matches the code exactly) but unconfirmed against
  the actual sandbox source. Hence: reply-and-ask, don't silently close.
- Thread context: the last comments (2024-04) are the reporter and a helper
  concluding "probably an html/css issue"; no maintainer reply ever given.
- Related known-flaky CI spec `use-scroll-target-late-ref.ts` was checked
  during planning: it covers late ref hydration, **not** this axis behavior —
  unrelated.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Read issue/comments | `gh api repos/motiondivision/motion/issues/2546/comments` | JSON |
| Comment | `gh api repos/motiondivision/motion/issues/2546/comments -f body="…"` | created |
| Close | `gh api -X PATCH repos/motiondivision/motion/issues/2546 -f state=closed -f state_reason=completed` | closed |
| Sanity-check claim locally (optional) | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="scroll"` | existing tests pass |

## Scope

**In scope**: one GitHub comment; gated close. **Out of scope**: changing
`resolveOffsets` to compute both axes (behavior change + per-frame cost —
maintainer decision, see Maintenance notes); any docs site edits (motion.dev
docs live outside this repo).

## Steps

### Step 1: Post the answer

Comment content:
1. When tracking a target on the horizontal axis you must tell `useScroll`
   which axis to resolve: `useScroll({ target, container, axis: "x" })`.
   Without it, offsets resolve on the default `"y"` axis and
   `scrollXProgress` falls back to the container's own scroll progress —
   precisely what the sandbox shows.
2. Also ensure the scroll container has non-static `position` (Motion now
   warns about this in dev — `on-scroll-handler.ts:42-56`).
3. Ask the reporter to confirm with `axis: "x"`; offer to reopen if it still
   mistracks with that set.

**Verify**: comment visible on the issue.

### Step 2: Close (GATED)

Only if the row for issue-2546 in `plans/issues/README.md` reads `APPROVED`,
close with `state_reason=completed` (it's an answered usage question, not a
rejected report). If the reporter replies that `axis: "x"` does NOT fix it,
do not close — report back for reclassification as FIX.

**Verify**: `gh api repos/motiondivision/motion/issues/2546 --jq .state` → `closed`.

## Done criteria

- [ ] Comment posted with the `axis: "x"` answer and confirmation request
- [ ] Close performed only with APPROVED gate
- [ ] No source files modified
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Sandbox becomes accessible and shows `axis: "x"` WAS already passed →
  diagnosis wrong; report for re-investigation (likely `calcInset`
  `offsetParent` walk vs the horizontal container).
- README row not `APPROVED` → stop after Step 1.

## Maintenance notes

- Real DX gap behind this: `useScroll` returns all four motion values but
  only resolves target offsets for one axis; `scrollXProgress` silently means
  something different from `scrollYProgress` when `axis` defaults. Options if
  recurring: resolve offsets for both axes (small per-frame cost), or
  dev-warn when a target is set and the off-axis progress value is consumed.
  Either is a maintainer decision; record demand on the issue before
  planning it.
