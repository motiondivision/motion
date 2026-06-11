# Plan issue-2189: Expose max scroll offset from `useScroll` (or document the existing `scrollInfo` route)

> **Executor instructions**: Follow this plan step by step. Step 0 is a
> decision gate — which route you execute depends on the maintainer's edit to
> this issue's row in `plans/issues/README.md`. Run every verification
> command. On any STOP condition, stop and report. When done, update the
> status row in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2189 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/value/use-scroll.ts packages/framer-motion/src/render/dom/scroll/`
> On changes, re-verify "Current state" excerpts; mismatch = STOP.

## Status

- **Priority**: P3
- **Effort**: S (Route B) / M (Route A)
- **Risk**: LOW (additive API)
- **Depends on**: none. Related but NOT overlapping: PR #3713 adds
  `rangeStart`/`rangeEnd` options to `scroll()` (see `plans/issues/pr-3713.md`)
  — that is about *input* offsets; this issue is about *output* values. Do
  not duplicate any of #3713's work; issue #3001 is already covered there.
- **Category**: feature
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2189

## Why this matters

The request (2023, 0 comments): `useScroll` exposes `scrollX/Y` and
`scrollX/YProgress` but not the maximum scrollable offset, even though Motion
computes it internally to derive progress. Users wanting "pixels remaining
until max scroll" must duplicate measurement (resize listeners +
scrollHeight math) that Motion already does per frame. The data exists today
on the JS path as `info[axis].scrollLength`; the gap is purely surface.
A secondary ask — `calc(100% - 300px)`-style offsets measured from the end —
is a separate input-side feature and stays out of scope (see Maintenance
notes).

## Current state

- `packages/framer-motion/src/render/dom/scroll/info.ts:50` — the value the
  issue asks for, computed every measurement:
  ```ts
  axis.scrollLength = element[`scroll${length}`] - element[`client${length}`]
  ```
  stored on `AxisScrollInfo` (`types.ts:21-35`, field `scrollLength`).
- `packages/framer-motion/src/value/use-scroll.ts:25-30` — `useScroll`
  currently materializes exactly four motion values:
  ```ts
  const createScrollMotionValues = () => ({
      scrollX: motionValue(0), scrollY: motionValue(0),
      scrollXProgress: motionValue(0), scrollYProgress: motionValue(0),
  })
  ```
- `packages/framer-motion/src/value/use-scroll.ts:112-134` — the JS
  subscription receives `{ x, y }` per frame and `.set()`s the four values.
  NOTE the callback currently destructures only `current` and `progress`
  from each axis; the full `AxisScrollInfo` (including `scrollLength`) is
  what `scroll()` passes (`attach-function.ts:19-22` forwards the whole
  `info`).
- Already-public escape hatch: `scrollInfo` and 2-arg `scroll()` are exported
  (`packages/framer-motion/src/dom.ts:6-7`) and re-exported by the `motion`
  package — `scrollInfo((info) => info.y.scrollLength, options)` answers the
  issue with zero API changes.
- Acceleration interaction: only `scrollXProgress`/`scrollYProgress` carry
  `accelerate` configs (`use-scroll.ts:94-107`). Absolute values
  (`scrollX/Y`) are always JS-driven; a max-offset value would be too — no
  WAAPI work needed.
- The issue's quoted file (`value/scroll/utils.ts`) no longer exists in that
  form; the architecture above replaced it.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build | `yarn build` (repo root) | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-scroll"` | all pass |
| Comment | `gh api repos/motiondivision/motion/issues/2189/comments -f body="…"` | created |
| Close | `gh api -X PATCH repos/motiondivision/motion/issues/2189 -f state=closed -f state_reason=completed` | closed |

## Step 0: Decision gate (maintainer)

The issue's row in `plans/issues/README.md` must be edited by the maintainer:

- `APPROVED-FEATURE` → execute Route A (add API to `useScroll`).
- `APPROVED-CLOSE` → execute Route B (answer with `scrollInfo` and close).
- Anything else → STOP after reporting both routes are ready.

## Route A: add max-offset motion values to `useScroll`

### Step A1: Write the failing test first

In `packages/framer-motion/src/value/__tests__/use-scroll.test.tsx` (existing
file — match its setup/render patterns), add a test rendering a hook
consumer and asserting the returned object exposes `scrollXMax`/`scrollYMax`
motion values that update when the JS callback fires. JSDOM gives zero
dimensions; follow the existing tests' approach to triggering/asserting
scroll values in that file (if existing tests only smoke-test value
existence, matching that depth is acceptable — the E2E in A3 is the
behavioral gate).

**Verify**: test fails on current code (`scrollXMax` undefined).

### Step A2: Implement

1. `createScrollMotionValues` (`use-scroll.ts:25-30`): add
   `scrollXMax: motionValue(0)` and `scrollYMax: motionValue(0)`.
2. The `start` callback (`use-scroll.ts:112-128`): widen the destructured
   axis type to include `scrollLength` and add
   `values.scrollXMax.set(x.scrollLength)` /
   `values.scrollYMax.set(y.scrollLength)`.
3. Keep naming `scrollXMax`/`scrollYMax` unless the maintainer's gate edit
   specifies otherwise. Do NOT add derived "FromMax" values — users compose
   that with `useTransform`.
4. Keep file-size discipline (CLAUDE.md): no new helpers, extend existing
   structures.

**Verify**: Step A1 test passes; `yarn build` exits 0;
`npx jest --config packages/framer-motion/jest.config.json --testPathPattern="use-scroll"` all green.

### Step A3: E2E sanity

Add a minimal case to an existing scroll test page
(`dev/react/src/tests/scroll.tsx` family) rendering `scrollYMax.get()` into a
DOM node, with a spec assertion in
`packages/framer-motion/cypress/integration/scroll.ts` that it equals
`document.scrollingElement.scrollHeight - clientHeight` after a scroll event.
Run on React 18 AND React 19 per the CLAUDE.md Cypress recipe.

**Verify**: both runs pass.

### Step A4: Comment + close

Comment on #2189: shipped `scrollXMax`/`scrollYMax` (version TBD by release),
plus the `scrollInfo` route for richer data; note the offset-`calc()` ask is
tracked separately if the maintainer wants it. Close
(`state_reason=completed`) — the Step 0 gate already covers approval.

## Route B: answer and close (no API change)

### Step B1: Comment

Explain: `scrollInfo()` (public from the `motion` package) and the
two-argument `scroll()` callback already expose everything `useScroll`
computes — `info.x/y.scrollLength` is the max offset; example:

```ts
import { scrollInfo } from "motion"
scrollInfo(({ y }) => { const remaining = y.scrollLength - y.current }, { container })
```

and that pixels-from-max composes as
`useTransform(() => scrollYMax.get() - scrollY.get())` once inside React (or
plain subtraction in the callback). Note the second ask (end-relative px
offsets) and invite a dedicated issue if still needed (offset input grammar
now lives in `render/dom/scroll/offsets/edge.ts`).

### Step B2: Close

`state_reason=completed`. Gate already satisfied by Step 0
(`APPROVED-CLOSE`).

## Done criteria

- [ ] Step 0 gate read; correct route executed
- [ ] Route A: failing-test-first evidenced; unit + Cypress (React 18 & 19) green;
      no files outside `use-scroll.ts`, its test, one test page, one spec touched
- [ ] Route B: comment posted with working code sample
- [ ] Issue closed only per the gate
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Gate row absent/unedited → report readiness, do nothing else.
- Route A test reveals the `scroll()` callback does not deliver
  `scrollLength` through `useScroll`'s subscription (type or runtime) — the
  excerpts have drifted; report.
- You're tempted to also implement `calc()`/end-relative offsets — explicitly
  out of scope; that touches `offsets/edge.ts` parsing and PR #3713's
  territory.

## Maintenance notes

- If Route A lands, motion.dev docs (external repo) need the two new values
  documented; flag in the PR body.
- The end-relative offset ask (`calc(100% - 300px)`) would extend
  `resolveEdge` (`offsets/edge.ts:9-47`) — cheap parser-wise, but design
  should follow how PR #3713's `rangeStart/rangeEnd` resolves; plan
  separately if demand recurs.
- `AxisScrollInfo.targetOffset` has a `// TODO Rename before documenting`
  (`types.ts:28-29`) — if `useScroll` output ever expands further, resolve
  that rename first.
