# Plan issue-2333: Verify `trackContentSize` answers stale-progress-on-content-change and close

> **Executor instructions**: Verification-only plan; no library source
> changes. Follow steps in order; honor STOP conditions. When done, update
> the status row for this issue in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2333 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/render/dom/scroll/track.ts packages/framer-motion/src/render/dom/scroll/types.ts`
> — on changes, re-verify excerpts.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (VERIFY-FIXED)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2333

## Why this matters

2023 report: when content height changes (button grows on click), the scroll
position shifts but `scrollYProgress` subscribers are not re-notified until
the next real scroll. Commit `8fe80ae8a` ("Fix scrollYProgress recalculation
on dynamic content changes", released **v12.29.0**) was written for exactly
this and its message says "Fixes #2718, #2274, #2333" — but the issue was
never closed, and the shipped mechanism is **opt-in**
(`trackContentSize: true`), not the automatic behavior the reporter expected.
The remaining work is to verify the option resolves the reported scenario,
state the opt-in clearly on the issue (it is undocumented outside a JSDoc
comment), and close.

## Current state

- `packages/framer-motion/src/render/dom/scroll/track.ts:22` —
  `trackContentSize = false` destructured default;
  `track.ts:88-113` — when true, a keep-alive `frame.read` process compares
  `container.scrollWidth/Height` each frame and re-triggers the scroll
  listener (full re-measure + notify) on change.
- `packages/framer-motion/src/render/dom/scroll/types.ts:71-77` — JSDoc:
  "When true, enables per-frame checking of scrollWidth/scrollHeight…
  @default false".
- `packages/framer-motion/src/value/use-scroll.ts:19-23` —
  `UseScrollOptions extends Omit<ScrollInfoOptions, "container" | "target">`,
  so `useScroll({ trackContentSize: true })` is accepted and forwarded
  (`use-scroll.ts:129-134` spreads options into `scroll()`); `scroll()` with
  a 2-arg callback routes through `scrollInfo`
  (`attach-function.ts:19-22`), which honors the flag.
- Existing E2E coverage from the fix commit:
  `dev/react/src/tests/scroll-progress-dynamic-content.tsx` (window
  container) and `scroll-progress-dynamic-content-element.tsx` (element
  container), both passing `trackContentSize: true`, asserted in
  `packages/framer-motion/cypress/integration/scroll.ts` (sections added by
  `8fe80ae8a`).
- Reporter's sandbox (`codesandbox.io/s/framer-motion-usescroll-forked-v8zyv5`)
  is behind Cloudflare — not fetchable at planning time. Its structure is
  fully described in the issue body (10 buttons in a scrollable container;
  last button grows on click) and matches the committed fixtures.
- Caveat to verify in Step 1: the fixtures call the standalone `scroll()`
  function; the reporter used the `useScroll` hook. Confirm the flag flows
  through the hook path too (it should, per the option spreading above).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Run the existing E2E (React 18) | CLAUDE.md Cypress recipe, `--spec cypress/integration/scroll.ts` | dynamic-content tests pass |
| Comment | `gh api repos/motiondivision/motion/issues/2333/comments -f body="…"` | created |
| Close | `gh api -X PATCH repos/motiondivision/motion/issues/2333 -f state=closed -f state_reason=completed` | closed |

## Scope

**In scope**: running existing tests; an uncommitted scratch check of the
`useScroll` hook path if needed; GitHub comment; gated close.
**Out of scope**: changing the default to `true` (per-frame
scrollWidth/scrollHeight reads on every tracked container — a deliberate
opt-in; flipping it is a maintainer perf decision); motion.dev documentation
(outside this repo).

## Steps

### Step 1: Verify the hook path

In the dev/react app, scratch-modify (do not commit) a copy of
`scroll-progress-dynamic-content-element.tsx` to use
`useScroll({ container, trackContentSize: true })` + `useMotionValueEvent`
instead of bare `scroll()`. Click-to-grow content; confirm the logged
progress updates without scrolling.

**Verify**: progress value re-logs after the height change with no scroll
input. Then `git checkout -- dev/react/src/tests/` to discard.

### Step 2: Run the committed regression specs

CLAUDE.md Cypress recipe (React 18 is sufficient for a verify-only plan),
`--spec cypress/integration/scroll.ts`.

**Verify**: the "dynamic content" tests added by `8fe80ae8a` pass.

### Step 3: Comment with the resolution

Cover: (1) fixed since v12.29.0 via the `trackContentSize: true` option on
`useScroll`/`scroll()`/`scrollInfo()`; (2) why opt-in: detection costs
per-frame `scrollWidth`/`scrollHeight` reads on the tracked container, which
not every consumer should pay; (3) minimal example:
`useScroll({ trackContentSize: true })`; (4) related: #2718, #2274 (same
mechanism, named in the fix commit).

**Verify**: comment visible.

### Step 4: Close (GATED)

Only if the row for issue-2333 in `plans/issues/README.md` reads `APPROVED`:
close with `state_reason=completed`.

## Done criteria

- [ ] Hook-path verification observed (Step 1) and specs green (Step 2)
- [ ] Comment posted; close only with APPROVED gate
- [ ] `git status` clean (scratch edits discarded)
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Step 1 shows `trackContentSize` does NOT propagate through `useScroll`
  (progress stays stale) → real bug in option forwarding; reclassify as FIX
  with that scratch page as the failing-test basis.
- Step 2's dynamic-content specs fail on unmodified main → regression on
  main; report immediately.

## Maintenance notes

- #2718 and #2274 (also named in `8fe80ae8a`) should get the same
  comment-and-close treatment if still open.
- If users keep missing the option, candidates: document it on motion.dev
  (external) and/or auto-enable only when a `target` is tracked (targets
  imply layout-sensitive offsets). Maintainer call.
