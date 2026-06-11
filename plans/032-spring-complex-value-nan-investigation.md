# Plan 032: Reproduce and fix NaN when spring-animating SVG polygon points (issue #2791)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/JSAnimation.ts packages/motion-dom/src/utils/mix`
> On drift, compare the "Current state" excerpts against live code before
> proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (investigation-gated; no fix without a failing repro)
- **Depends on**: none (independent of plans 030/031/033 — different subsystem)
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

Open issue [#2791](https://github.com/motiondivision/motion/issues/2791): animating an SVG `<polygon>`'s `points` attribute with `type: "spring"` produces NaN values and console errors at various times during the animation; with non-spring types the NaNs do not occur (though one `expected number, 'undefined'` error appears regardless). Spring-animated complex values silently emitting NaN means broken rendering with no actionable signal for users.

**Important nuance the planner verified**: calling the spring generator directly with string keyframes does yield NaN (`spring({keyframes:['0 0','100 200']}).next(100).value` → NaN), BUT the production pipeline doesn't do that — `JSAnimation.initAnimation` detects non-numeric keyframes and animates a 0→100 progress spring through a mixer (see Current state). So the raw-generator NaN is NOT proven to be the production path. **The root cause is unconfirmed. This plan is reproduce-first; repo policy is explicit: no repro → no fix.**

## Current state

- `packages/motion-dom/src/animation/JSAnimation.ts:131-141` — the complex-value handling that should make springs work on strings:

```ts
        if (
            generatorFactory !== keyframesGenerator &&
            typeof keyframes[0] !== "number"
        ) {
            this.mixKeyframes = pipe(
                percentToProgress,
                mix(keyframes[0], keyframes[1])
            ) as (t: number) => T
            keyframes = [0 as T, 100 as T]
        }
```

- `packages/motion-dom/src/animation/JSAnimation.ts:120-129` — dev-only invariant: springs support only two keyframes; in production builds more than two slip through silently (only `keyframes[0]`/`keyframes[1]` are mixed).
- The mixer for complex strings lives under `packages/motion-dom/src/utils/mix/` (`mix`, `mixComplex` and friends) — mismatched value structures (e.g. point lists with different numbers of points, or differing whitespace/comma shapes) are the prime suspect.
- Issue repro (from the issue body): a `<polygon>` whose `points` is animated with a spring transition. CodeSandbox: https://codesandbox.io/p/sandbox/pensive-khayyam-5mwd29 — fetch it (try several URL patterns; e.g. the sandbox API `https://codesandbox.io/api/v1/sandboxes/5mwd29`). Per repo policy: **if you cannot obtain the reproduction code, STOP and ask for help — do not guess.**
- Test conventions: unit tests in `__tests__/` next to source (see `packages/motion-dom/src/animation/__tests__/` and `packages/framer-motion/src/animation/__tests__/`); Cypress test pages in `dev/react/src/tests/<name>.tsx` exporting `App`, specs in `packages/framer-motion/cypress/integration/<name>.ts`.

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---------|--------------------------|---------------------|
| Read the issue | `gh issue view 2791` | issue body + repro link |
| motion-dom tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="<pattern>"` | pass/fail as stated per step |
| framer-motion client tests | `cd packages/framer-motion && yarn test-client` | pass |
| Build | `yarn build` | exit 0 |
| Cypress (React 18) | see CLAUDE.md "Running Cypress tests locally" — start Vite directly on a random port, then `cypress run --headed --config baseUrl=... --spec ...` | spec passes |

## Scope

**In scope** (expected; confirm during investigation):
- `packages/motion-dom/src/animation/JSAnimation.ts` (only if the fault is in the mixer wiring)
- `packages/motion-dom/src/utils/mix/*` (if the fault is in complex-value mixing)
- New test files in the matching `__tests__/` directories
- `dev/react/src/tests/` + `packages/framer-motion/cypress/integration/` (one new E2E test page/spec, if the bug only reproduces with the full React/SVG pipeline)

**Out of scope** (do NOT touch):
- `packages/motion-dom/src/animation/generators/spring.ts` — the generator receiving numeric `[0,100]` keyframes is working as designed; plans 030/031/033 own that file. If your investigation concludes the fix belongs there, STOP and report instead.
- Adding multi-keyframe spring support — the two-keyframe limit is a known, separately-tracked design constraint; do not expand it here.

## Git workflow

- Branch: `fix/spring-polygon-points-nan-2791`
- Commit 1: failing test; commit 2: fix. Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Obtain the reproduction

`gh issue view 2791`; fetch the CodeSandbox source. Extract: the polygon JSX, the exact `points` strings (origin and target — count the points in each), and the exact transition object.

**Verify**: you can state the two (or more) `points` keyframe strings verbatim. If the sandbox is unreachable after trying multiple URL patterns and the issue body alone doesn't contain the strings, STOP and report (ask the operator to supply the repro).

### Step 2: Reproduce at the lowest layer that fails

Try in order; stop at the first layer that reproduces NaN:

1. **Mixer-only** (Jest, `packages/motion-dom/src/utils/mix/__tests__/`): `mix(pointsA, pointsB)(0.5)` with the repro's actual strings → does the output contain NaN? Also try point lists of differing lengths (`"0,0 100,100"` vs `"0,0 100,100 200,0"`) — springs overshoot, so also evaluate the mixer at progress **> 1 and < 0** (e.g. `mix(a, b)(1.08)`), which is unique to springs and the leading hypothesis for why only `type: "spring"` NaNs.
2. **JSAnimation-level** (Jest, `packages/motion-dom/src/animation/__tests__/`): `new JSAnimation({ keyframes: [pointsA, pointsB], type: "spring", onUpdate })`, drive frames (see the `nextFrame`/`frame.postRender` async helper in CLAUDE.md), assert no `onUpdate` payload matches `/NaN/`.
3. **Full pipeline** (Cypress): test page with the repro's `<motion.polygon animate={{ points }} transition={{ type: "spring" }}>`, spec asserts the `points` attribute never contains `NaN` while sampling during the animation, and no console errors. Per CLAUDE.md, if layers 1–2 pass in JSDOM but the issue is real in the browser, this is the regression gate.

**Verify**: a test exists that FAILS with NaN output. Record which layer and why. If after 2–3 honest attempts at all three layers nothing fails, STOP — report "needs repro" per repo policy (memory: no repro → no fix, no speculative coverage) and recommend closing the issue pending a fresh reproduction.

### Step 3: Diagnose

With a failing test in hand, find where the NaN originates (likely candidates, in order): `mixComplex`/`mixNumber` receiving structurally mismatched values; mixer extrapolation beyond [0,1] on analyzed complex values; the `expected number, 'undefined'` error from the issue hints at a value-type analysis producing fewer template slots than the target has. Write down the one-sentence root cause before fixing.

### Step 4: Fix

Defensive principle from CLAUDE.md applies: if the mixer can receive out-of-range progress or mismatched structures and hand NaN to the DOM, guard at the point where the invalid value is produced — regardless of which upstream path produced it. Keep the fix minimal and in the diagnosed layer.

**Verify**: Step 2's failing test passes; full motion-dom suite + `yarn test-client` pass.

### Step 5: E2E confirmation (if the repro was unit-level)

If Step 2 reproduced in Jest, still add the Cypress page+spec from Step 2.3 as a cheap integration gate **only if** it adds signal (it fails pre-fix when run against the unfixed build, or guards SVG-attribute plumbing the unit test can't). If it cannot fail pre-fix, skip it and say so — don't land happy-path-only E2E.

Run any new Cypress spec against **both React 18 and React 19** per CLAUDE.md before declaring done.

## Test plan

- One failing-first regression test at the lowest reproducing layer (Step 2).
- Optional Cypress spec mirroring the issue's polygon repro (Step 5), run on React 18 + 19.
- Existing mix/animation tests stay green.

## Done criteria

ALL must hold (or the documented "needs repro" exit was taken):

- [ ] A test exists that fails on unfixed code with NaN and passes with the fix
- [ ] `npx jest --config packages/motion-dom/jest.config.json` exits 0
- [ ] `cd packages/framer-motion && yarn test-client` exits 0
- [ ] `yarn build` exits 0
- [ ] If a Cypress spec was added: passes on React 18 and React 19
- [ ] No out-of-scope files modified (`git status`)
- [ ] `plans/README.md` status row updated (DONE, or BLOCKED "needs repro" with a one-line summary of the three failed repro layers)

## STOP conditions

Stop and report back (do not improvise) if:

- The CodeSandbox is unreachable and the issue body lacks the exact keyframe strings.
- No layer reproduces NaN after honest attempts (exit "needs repro" — that IS a valid completion of this plan; record it).
- The diagnosis points into `spring.ts` or into multi-keyframe spring support.
- The fix grows beyond ~30 lines of non-test code — likely treating symptoms; report the diagnosis instead.

## Maintenance notes

- If the root cause is mixer extrapolation (progress > 1 from spring overshoot), audit other overshooting generators' interaction with `mixComplex` in a follow-up — inertia can also overshoot bounds.
- The production-silent two-keyframe invariant (JSAnimation.ts:120-129) deserves a separate look if the repro involved 3+ keyframes: dev warns, prod silently drops middles.
