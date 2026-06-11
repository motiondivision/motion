# Plan issue-3658: Stop ViewTimeline acceleration mistracking targets inside fixed-position ancestors

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this issue
> in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/3658 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/framer-motion/src/render/dom/scroll/ packages/framer-motion/src/value/use-scroll.ts`
> If any in-scope file changed since planning, compare the "Current state"
> excerpts against live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the native-timeline eligibility decision used by every accelerated `useScroll`)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/3658

## Why this matters

A tagged regression: since 12.37.0, `useScroll` with string offsets
(`["start start", "end end"]`) can hardware-accelerate via the native
ViewTimeline API. The original report (sticky child + scaled `motion.div`
parent) was **already fixed on main** by `2ffc157b4` ("Fix useScroll
acceleration binding wrong timeline for nested motion components", shipped
v12.39.0 — root cause was a ref-hydration race binding inner motion
components to a generic ScrollTimeline). **But the issue is still open and
still real**: commenter lezan (2026-06-01) reports breakage on 12.40.0 with a
public repro (https://github.com/lezan/use-scroll-bug) whose target lives
inside a `position: fixed` ancestor. There, the native ViewTimeline correctly
reports that the subject never moves relative to the scrollport (constant
progress), while Motion's JS fallback measures layout offsets via the
`offsetParent` chain and produces the 0→1 progress users relied on through
12.36.0. The two paths have divergent semantics whenever a fixed-position
ancestor sits between target and scroll container; acceleration must bail out
to the JS path in that layout.

## Current state

- `packages/framer-motion/src/render/dom/scroll/attach-animation.ts:23-25` —
  decides native vs JS:
  ```ts
  const useNative = options.target
      ? canUseNativeTimeline(options.target) && !!range
      : canUseNativeTimeline()
  ```
- `packages/framer-motion/src/render/dom/scroll/utils/can-use-native-timeline.ts:3-6` —
  only checks API support, knows nothing about layout:
  ```ts
  export function canUseNativeTimeline(target?: Element) {
      if (typeof window === "undefined") return false
      return target ? supportsViewTimeline() : supportsScrollTimeline()
  }
  ```
- `packages/framer-motion/src/render/dom/scroll/utils/get-timeline.ts:63-75` —
  second decision site: creates `new ViewTimeline({subject: options.target, axis})`
  when `canUseNativeTimeline(options.target)` and the offset maps to a range,
  else `scrollTimelineFallback` (the JS path). Timelines are cached per
  container/target/axisKey (lines 23-26, 47-60).
- `packages/framer-motion/src/render/dom/scroll/utils/offset-to-range.ts:69-83` —
  maps `undefined` offset → `contain 0%/100%`, preset arrays and (since
  `6bae74ee6`, v12.37.0) string offsets like `"start start"`/`"end end"` to
  named ranges. This widening is why 12.37.0 is the reported regression
  point; the underlying fixed-ancestor divergence also applies to the
  `undefined`-offset mapping shipped in v12.35.0 (`3995b3408`) — lezan's
  repro passes **no** offset.
- JS-path measurement that defines Motion's compat semantics:
  `packages/framer-motion/src/render/dom/scroll/on-scroll-handler.ts:21-28`
  walks `node.offsetLeft/offsetTop` + `node.offsetParent` — pure layout,
  blind to fixed positioning and transforms.
- `packages/framer-motion/src/value/use-scroll.ts:37-75` — the `accelerate`
  factory defers `scroll(animation, …)` by one microtask so refs are
  hydrated; that call lands in `attachToAnimation` above, so an attach-time
  layout guard there sees the real DOM.
- Existing regression assets for the *original* repro (scaled parent +
  sticky + string offsets):
  `dev/react/src/tests/scroll-view-timeline-transformed-parent.tsx` and
  `packages/framer-motion/cypress/integration/scroll-view-timeline-transformed-parent.ts`
  (compares a WAAPI-driven probe against a forced-JS `#js-progress` readout;
  skips ViewTimeline assertions when unsupported — CI Electron lacks
  ViewTimeline, so the real gate runs in Chrome).
- lezan repro structure (fetched from github.com/lezan/use-scroll-bug,
  app/page.tsx + components/ui/text-reveal.tsx): page body scrolls 200vh; a
  `position: fixed; inset: 0` overlay contains the `useScroll` target (a
  `relative h-[200vh]` div with a sticky child); `useScroll({ target })` with
  **no offset**; per-word `useTransform` opacities on `motion.span`s.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Build | `yarn build` (repo root) | exit 0 |
| Unit tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="offset-to-range\|use-scroll"` | all pass |
| Cypress (per CLAUDE.md recipe, React 18) | `PORT=$((10000 + RANDOM % 50000)); cd dev/react && TEST_PORT=$PORT yarn vite --port $PORT & npx wait-on http://localhost:$PORT; cd packages/framer-motion && cypress run --headed --browser chrome --spec cypress/integration/scroll-view-timeline-fixed-parent.ts --config baseUrl=http://localhost:$PORT` | all pass |
| Cypress React 19 | same with `dev/react-19` + `--config-file=cypress.react-19.json` | all pass |

Run the new spec with `--browser chrome`: Electron lacks ViewTimeline so the
spec self-skips there (model the skip on
`scroll-view-timeline-transformed-parent.ts:19-20`).

## Scope

**In scope** (the only files you should modify/create):
- `packages/framer-motion/src/render/dom/scroll/utils/can-use-native-timeline.ts`
- `packages/framer-motion/src/render/dom/scroll/attach-animation.ts`
- `packages/framer-motion/src/render/dom/scroll/utils/get-timeline.ts`
- `packages/framer-motion/src/render/dom/scroll/utils/__tests__/can-use-native-timeline.test.ts` (create)
- `dev/react/src/tests/scroll-view-timeline-fixed-parent.tsx` (create)
- `packages/framer-motion/cypress/integration/scroll-view-timeline-fixed-parent.ts` (create)

**Out of scope**:
- `offset-to-range.ts` string-offset mapping — do NOT revert `6bae74ee6`;
  the binding race it exposed is already fixed and reverting would re-disable
  a shipped feature for layouts that work.
- `use-scroll.ts` — its render-time `canAccelerateScroll` cannot see the DOM;
  the guard belongs at attach time.
- The JS measurement path (`on-scroll-handler.ts`, `inset.ts`) — its
  layout-offset semantics are the compat baseline, not the bug.

## Git workflow

- Branch: `fix/issue-3658-fixed-ancestor-viewtimeline`
- Conventional plain messages (match `git log`), end with the Claude
  co-author trailer per CLAUDE.md. Do not push/open a PR until tests pass on
  both React versions.

## Steps

### Step 1: Reproduce with a failing Cypress test (failing-test-first)

Create `dev/react/src/tests/scroll-view-timeline-fixed-parent.tsx` modeled on
`scroll-view-timeline-transformed-parent.tsx` but matching lezan's layout:

- Page root renders a 200vh scrollable body (plain spacer div).
- A `position: fixed; inset: 0` overlay contains the `useScroll` target: a
  `position: relative; height: 200vh` div with a `position: sticky; top: 0`
  child.
- `useScroll({ target: ref })` with **no offset** (this is the still-broken
  case), feeding a `useTransform(scrollYProgress, [0, 1], [0, 1])` opacity on
  `<motion.div id="opacity-probe">`.
- A forced-JS readout `#js-progress` via the two-argument `scroll()` callback
  exactly as in `scroll-view-timeline-transformed-parent.tsx:36-49`.

Create the spec `packages/framer-motion/cypress/integration/scroll-view-timeline-fixed-parent.ts`
modeled on `scroll-view-timeline-transformed-parent.ts`:

- Test A: scroll to 25%/50%/75% of the scroll range, `.then()`-read computed
  opacity of `#opacity-probe` and `#js-progress`; assert max drift < 0.05.
- Test B: assert `#opacity-probe`'s `getAnimations()` contains **no**
  ViewTimeline-driven animation after the fix (i.e. the JS path was chosen).
  Skip both tests when `!(win as any).ViewTimeline` (Electron).

**Verify**: run the spec in Chrome on current code → Test A FAILS (probe
opacity stuck near a constant while `#js-progress` advances). If it passes,
the repro translation is wrong — STOP and re-check the fixture against
lezan's repo before touching source.

### Step 2: Add the fixed-ancestor guard

Extend `can-use-native-timeline.ts`:

```ts
function hasFixedAncestor(target: Element, container: Element): boolean {
    let node: HTMLElement | null = target as HTMLElement
    while (node && node !== container && node !== document.documentElement) {
        if (getComputedStyle(node).position === "fixed") return true
        node = node.parentElement
    }
    return false
}

export function canUseNativeTimeline(target?: Element, container?: Element) {
    if (typeof window === "undefined") return false
    if (!target) return supportsScrollTimeline()
    return (
        supportsViewTimeline() &&
        !hasFixedAncestor(target, container ?? document.documentElement)
    )
}
```

Notes: include the target itself in the walk (a fixed target is equally
untrackable by ViewTimeline); the walk runs once per attach (precedent:
`PanSession.startScrollTracking` walks ancestors per gesture). Keep it
small — this ships to end users.

Update both call sites to pass the container:
- `attach-animation.ts:24` → `canUseNativeTimeline(options.target, options.container)`
- `get-timeline.ts:63` → `canUseNativeTimeline(options.target, container)`
- `get-timeline.ts:76` (no-target branch) unchanged.

**Verify**: `yarn build` → exit 0.

### Step 3: Unit-test the guard

Create `can-use-native-timeline.test.ts` (jsdom): stub
`supportsViewTimeline`/`supportsScrollTimeline` true via
`window.ViewTimeline = class {}` etc. or jest module mock; build a DOM with
`document.body > fixedDiv(style.position="fixed") > target` and assert
`canUseNativeTimeline(target)` is false; sibling case without fixed ancestor
→ true; fixed target itself → false.

**Verify**: `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="can-use-native-timeline"` → pass.

### Step 4: Re-run the Cypress gates

Run the new spec AND the two existing regression specs
(`scroll-view-timeline.ts`, `scroll-view-timeline-transformed-parent.ts`)
plus `use-scroll-target-late-ref.ts` and `scroll-accelerate.ts` in Chrome,
on React 18 and React 19 (CLAUDE.md recipe).

**Verify**: all pass, including Step 1's spec now green.

## Test plan

- New Cypress spec (Step 1): fixed-ancestor target falls back to JS and
  matches JS progress; no ViewTimeline animation attached.
- New Jest unit tests (Step 3): guard true/false matrix.
- Existing regression suite (Step 4) unchanged and green — proves the guard
  does not de-accelerate the working transformed-parent and preset cases.

## Done criteria

- [ ] Step 1 spec failed before the fix (record the failing output in the PR)
- [ ] `yarn build` exits 0; Jest scroll/offset tests pass
- [ ] New + existing scroll Cypress specs pass in Chrome on React 18 AND 19
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] PR references #3658 and explains: original race fixed in v12.39.0
      (`2ffc157b4`); this closes the remaining fixed-ancestor divergence
- [ ] `plans/issues/README.md` status row updated

## STOP conditions

- Step 1's spec passes on unmodified main in real Chrome → the remaining bug
  is not reproducible as analyzed; report findings and ask lezan for an exact
  diff vs his repo instead of guessing.
- The guard fixes the fixture but `scroll-view-timeline.ts` acceleration
  assertions start failing (guard too broad) — report rather than loosening
  assertions.
- You find yourself wanting to revert `6bae74ee6` or edit
  `offset-to-range.ts` — that is a maintainer decision, STOP.

## Maintenance notes

- Sticky ancestors *between target and container* likely diverge the same way
  (ViewTimeline respects sticky visual position; the JS `offsetParent` walk
  does not). Not reported, not guarded here — extend `hasFixedAncestor` to a
  position allowlist if a repro arrives.
- Flagged during planning, verify before acting: `ScrollOffset.Any`
  (`offsets/presets.ts:12-15`, `[[1,0],[0,1]]` = `["end start","start end"]`)
  maps to ViewTimeline `cover`, whose 0%→100% direction is the *reverse*
  ordering; and `All`→`contain` reverses for targets **smaller** than the
  scrollport (Motion's JS interpolator handles decreasing offsets, CSS ranges
  always run in scroll direction). Both predate this issue (v12.35.0).
- The original CodeSandbox (codesandbox.io/p/sandbox/5nflw4) is behind
  Cloudflare and was not fetchable at planning time; lezan's GitHub repo is
  the canonical repro.
- After landing, comment on #3658 summarizing both root causes and ask the
  original reporter to confirm on the released version before closing
  (closing additionally gated on an APPROVED row in `plans/issues/README.md`).
