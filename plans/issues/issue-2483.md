# Plan issue-2483: Verify production-only late-ref `useScroll` failure is fixed by v12.39.0 and close

> **Executor instructions**: Follow this plan step by step. Verification-only:
> no library source changes. If anything in "STOP conditions" occurs, stop
> and report. When done, update the status row for this issue in
> `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2483 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/value/use-scroll.ts`
> — on changes, re-verify the excerpts below.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (VERIFY-FIXED)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2483

## Why this matters

2024 report: `useScroll({ container })` stops tracking when the container ref
is passed down through child components — **production builds only**; the
documented-in-thread workaround is `layoutEffect: false`. The thread
(nianiam, 2024-07-02) correctly identifies the mechanism: in dev, StrictMode's
double render hides the race; in prod, `useScroll`'s layout effect runs while
the ref is still `null` and the subscription permanently attaches to the
window. Main now contains dedicated machinery for exactly this
(`5401a9e4a` "Fix useScroll falling back to window scroll when ref hydrates
late", first released in **v12.39.0**, with Cypress regression spec
`use-scroll-target-late-ref.ts`). The issue predates it by two years and is
very likely fixed; verify and close rather than leave a stale `bug` open.

## Current state

- `packages/framer-motion/src/value/use-scroll.ts:141-179` — the fix: the
  layout effect defers when `isRefPending(container) || isRefPending(target)`
  (`needsStart`), a follow-up `useEffect` retries on a microtask so
  sibling/parent effects can hydrate the ref first, and an `invariant`
  ("Container ref is defined but not hydrated", error code `use-scroll-ref`)
  fires if it never resolves.
- `packages/framer-motion/src/value/use-scroll.ts:44-69` — the accelerated
  path has the same protection (microtask retry in the factory; comment
  "Refs attach child-first; defer so target.current is populated").
- Regression coverage already on main:
  `packages/framer-motion/cypress/integration/use-scroll-target-late-ref.ts`
  (asserts a late-hydrated target tracks the element, not the window; was a
  known-flaky spec, fixed on main 2026-05-18 per `plans/issues/README.md`).
- Note: that spec covers a late **target**; this issue is a late **container**
  ref two component levels down — same `isRefPending` code path
  (`use-scroll.ts:144,159`), but verify the container variant explicitly
  (Step 1).
- Reporter's repro: https://github.com/eeshankeni/famer-motion-scroll-bug
  (public repo, fetchable via `gh api repos/eeshankeni/famer-motion-scroll-bug`)
  — Next.js static export, break visible only after `yarn build` + serve.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Fetch repro source | `gh api repos/eeshankeni/famer-motion-scroll-bug/contents/<path>` | file JSON (base64) |
| Run existing spec (React 18, Chrome) | CLAUDE.md Cypress recipe with `--spec cypress/integration/use-scroll-target-late-ref.ts` | pass |
| Comment | `gh api repos/motiondivision/motion/issues/2483/comments -f body="…"` | created |
| Close | `gh api -X PATCH repos/motiondivision/motion/issues/2483 -f state=closed -f state_reason=completed` | closed |

## Scope

**In scope**: a throwaway verification page in `dev/react/src/tests/` ONLY if
needed for Step 1 (delete before finishing — do not commit new test files
unless Step 1 finds a real gap); GitHub comment; gated close.
**Out of scope**: `use-scroll.ts` changes; documenting `layoutEffect` on
motion.dev (docs live outside this repo).

## Steps

### Step 1: Verify the container-ref-passed-down case against current main

Recreate the reporter's shape in a scratch page (do not commit): a parent
holding `const ref = useRef(null)` + `useScroll({ container: ref })` via
`useMotionValueEvent` logging, passing `ref` down two component levels to the
scrollable div. Reproduce the prod condition by rendering WITHOUT StrictMode
(the dev/react harness app — check `dev/react/src/index.tsx` for whether
StrictMode wraps tests; the late-ref fixture `use-scroll-target-late-ref`
already documents StrictMode interplay in its spec comments). Scroll the
container; confirm `scrollYProgress` updates from the first attempt with NO
`layoutEffect: false`.

**Verify**: progress values change on scroll (manually via the dev server, or
by temporarily pointing the existing late-ref spec pattern at the container
case). Record the evidence (screenshot or console output) for the issue
comment.

### Step 2: Comment with findings

Cover: (1) root cause as analyzed in-thread (prod has no StrictMode second
pass; ref not yet hydrated when the layout effect ran); (2) fixed since
v12.39.0 by `5401a9e4a` — `useScroll` now defers and retries until provided
refs hydrate, and throws a descriptive `use-scroll-ref` invariant instead of
silently tracking the window; (3) ask reporter to upgrade to ≥12.39.0;
`layoutEffect: false` workaround no longer needed.

**Verify**: comment visible.

### Step 3: Close (GATED)

Only if the row for issue-2483 in `plans/issues/README.md` reads `APPROVED`:
close with `state_reason=completed`.

**Verify**: state `closed`.

## Done criteria

- [ ] Step 1 evidence captured (container ref passed down ≥2 levels tracks
      correctly without workarounds, non-StrictMode render)
- [ ] Comment posted; close only with APPROVED gate
- [ ] `git status` shows no committed source changes (scratch page deleted)
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Step 1 reproduces the failure on current main (progress stuck at 0 /
  window-tracking) → the fix doesn't cover the container variant; reclassify
  as FIX, report with the failing setup — that becomes the failing test for a
  follow-up plan.
- The `use-scroll-ref` invariant fires in Step 1 → ref genuinely never
  hydrates in the harness; fix the harness wiring, not the library.

## Maintenance notes

- If this closes, #2452 (the issue where `layoutEffect: false` was first
  documented) likely deserves the same verification sweep.
- The `JSON.stringify(options.offset)` dep at `use-scroll.ts:139` is a known
  deferred wart (`plans/README.md`) — unrelated, leave it.
