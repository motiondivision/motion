# Plan 003: Enable WAAPI acceleration for color properties (spike + gated enable)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation/waapi/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction / perf
- **Planned at**: commit `42bfbe3ed`, 2026-06-10

## Why this matters

Color animations (`backgroundColor`, `color`, etc.) are deliberately excluded from WAAPI acceleration — a code comment defers them "until we implement support for linear() easing". That blocker is resolved: Motion now generates `linear()` easing strings for unsupported easings/springs (used by the existing WAAPI path). Plain color animations therefore fall to the per-frame JS animation path unnecessarily, re-rendering the element's styles every frame on the main thread. The repo's own `PERFORMANCE_AUDIT.md` ranks this MEDIUM impact / MEDIUM effort ("Re-enable (offload, not free render); fix `backgroundColor` naming"). Note the honest framing: color is paint-bound, so this is a main-thread *offload*, not free compositor rendering.

## Current state

- `packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts` (complete file):

  ```ts
  /**
   * A list of values that can be hardware-accelerated.
   */
  export const acceleratedValues = new Set<string>([
      "opacity",
      "clipPath",
      "filter",
      "transform",
      // TODO: Can be accelerated but currently disabled until https://issues.chromium.org/issues/41491098 is resolved
      // or until we implement support for linear() easing.
      // "background-color"
  ])
  ```

  ⚠️ Naming trap: the commented entry is dash-case (`"background-color"`), but the `name` checked against this set is the Motion value name, which is camelCase (`"backgroundColor"`). Even uncommented as-is it would never match. Use camelCase names.

- `packages/motion-dom/src/animation/waapi/supports/waapi.ts:53-74` — the eligibility gate `supportsBrowserAnimation()`:

  ```ts
  return (
      supportsWaapi() &&
      name &&
      (acceleratedValues.has(name) ||
          (colorProperties.has(name) &&
              hasBrowserOnlyColors(keyframes))) &&
      (name !== "transform" || !transformTemplate) &&
      !onUpdate &&
      !repeatDelay &&
      repeatType !== "mirror" &&
      damping !== 0 &&
      type !== "inertia"
  )
  ```

  Key fact: a `colorProperties` set already exists and colors ALREADY go through WAAPI when keyframes contain browser-only color formats (oklch/lab/etc.) — so the WAAPI color pipeline (keyframe serialization, easing conversion, interrupt sampling) is already exercised in production. This plan widens that gate from "browser-only colors" to "all animatable colors".

- `packages/motion-dom/src/animation/AsyncMotionValueAnimation.ts:173` — call site of `supportsBrowserAnimation(resolvedOptions)`; the decision happens after keyframe resolution.
- Chromium issue 41491098 referenced in the TODO: before changing code, check its current status (Step 1).

Repo conventions: this is a size-sensitive library; prefer minimal diffs. Cypress E2E pattern notes (from `CLAUDE.md`): use `.then()` not `.should()` for mid-animation measurements; long duration + linear easing + mid-animation computed-style check for target-value bugs; `getAnimations()` is only reliable for compositor properties in Electron — for colors, assert acceleration in Playwright/real Chromium instead, or assert behavior (computed style) in Cypress.

## Commands you will need

| Purpose | Command (from repo root unless noted) | Expected on success |
|---|---|---|
| Build | `yarn build` | exit 0 |
| motion-dom unit tests | `npx jest --config packages/motion-dom/jest.config.json` | no new failures |
| framer-motion client tests | `cd packages/framer-motion && yarn test-client` | no new failures |
| Playwright | `npx playwright test tests/animate/` | all pass |
| Cypress React 18/19 | see CLAUDE.md "Running Cypress tests locally" (Vite directly per React version, foreground) | both pass |
| Lint | `yarn lint` | exit 0 |

## Scope

**In scope**:
- `packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts`
- `packages/motion-dom/src/animation/waapi/supports/waapi.ts` (only if gating needs adjustment beyond the set)
- New unit tests under `packages/motion-dom/src/animation/waapi/**/__tests__/`
- New Playwright fixture+spec (`dev/html/public/playwright/`, `tests/animate/`)
- New Cypress test page + spec (`dev/react/src/tests/`, `packages/framer-motion/cypress/integration/`) if behavior assertions are needed beyond Playwright

**Out of scope**:
- `hasBrowserOnlyColors` / `colorProperties` definitions — widening the gate must not change the browser-only-color fallback semantics (JS path CANNOT parse those formats; that branch is correctness, not perf).
- Transform shorthand acceleration (`x`/`scale`/`rotate`) — that is plan 004's design spike; do not attempt it here.
- `NativeAnimation` / keyframe serialization internals — they already handle colors via the browser-only-colors path; if they need changes, STOP.

## Git workflow

- Branch: `advisor/003-color-waapi`
- Short imperative commit subjects.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Verify the unblock conditions (read-only)

1. Confirm `linear()` easing generation exists and is used by the WAAPI path: `grep -rn "generateLinearEasing" packages/motion-dom/src --include="*.ts" | grep -v __tests__` → expect hits in the WAAPI easing pipeline.
2. Check the status of Chromium issue 41491098 (web search). Record both findings in `plans/003-notes.md`.

**Verify**: `plans/003-notes.md` exists with both answers. If `linear()` is NOT wired into the WAAPI easing path, STOP.

### Step 2: Widen the gate

Add camelCase color names to `acceleratedValues`, replacing the commented dash-case entry. Start with the two most common: `"backgroundColor"` and `"color"`. Do NOT add the whole `colorProperties` set in this pass (borderColor variants, fill/stroke for SVG have extra constraints — SVG is excluded by the `HTMLElement` instance check anyway, but keep the diff minimal and observable).

Keep the comment, updated to describe the remaining exclusions and why.

**Verify**: `yarn build` → exit 0.

### Step 3: Unit tests for the gate

Find the existing tests for `supportsBrowserAnimation` (`grep -rn "supportsBrowserAnimation" packages/motion-dom/src --include="*.test.ts"`); extend or create a test file asserting:

- `backgroundColor` with standard hex/rgba keyframes → eligible (in a mocked-supporting environment, matching how existing tests mock `supportsWaapi`).
- `backgroundColor` with `onUpdate` present → not eligible (existing kill-switches still apply).
- A color NOT in the set (e.g. `borderTopColor`) with standard keyframes → not eligible; with oklch keyframes → eligible (browser-only path unchanged).

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="waapi"` → all pass.

### Step 4: E2E behavior + acceleration assertion

Playwright (real Chromium): fixture animating `backgroundColor` red→blue, duration 10s, linear ease; assert (a) `element.getAnimations().length > 0` (it is now a WAAPI animation), and (b) mid-animation computed `background-color` is strictly between the endpoints. Add an interrupt case: start a second `animate()` to a new color mid-flight, assert no jump (final value correct, no console errors) — interrupt sampling reads the WAAPI value, which is the riskiest behavior change.

**Verify**: `npx playwright test tests/animate/` → all pass.

### Step 5: Full regression sweep

The blast radius is every color animation in the suite. Run, in order: motion-dom jest, framer-motion `test-client`, the full Cypress integration suite on React 18 AND React 19 (per CLAUDE.md local-run instructions), Playwright.

**Verify**: no new failures versus a baseline run on `main` (if any suite fails, first confirm whether it fails on `main` too before attributing it to this change).

## Test plan

- Unit: gate eligibility matrix (Step 3) — the real regression gate per CLAUDE.md's "choose the right test layer" guidance.
- E2E: Playwright mid-animation + interrupt assertions (Step 4).
- Full-suite sweep (Step 5) as the blast-radius check.

## Done criteria

- [ ] `grep -n "backgroundColor" packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts` → 1 match (uncommented)
- [ ] `grep -n "background-color" packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts` → no uncommented matches
- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="waapi"` → all pass
- [ ] `npx playwright test tests/animate/` → all pass including new interrupt case
- [ ] Cypress suites pass on React 18 and React 19
- [ ] `plans/003-notes.md` records linear()-wiring evidence and Chromium-issue status
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds `linear()` easing is not actually wired into WAAPI easing conversion — the TODO's stated blocker still holds.
- Step 1 finds Chromium 41491098 is unresolved AND describes a rendering bug (not just a feature request) that affects accelerated color animation — record details and stop; the maintainer must weigh it.
- The interrupt case in Step 4 shows a visible value jump or wrong final value and one fix attempt inside the in-scope files doesn't resolve it — interrupt sampling lives in `NativeAnimation`, which is out of scope.
- Springs on color values behave differently (test `type: "spring"` on `backgroundColor` once manually): if spring→linear() conversion produces wrong colors, stop.
- More than 3 existing tests fail for reasons you can trace to acceleration (not flake) — the gate may need to stay opt-in; report.

## Maintenance notes

- Safari de-accelerates `linear()` easing (noted in `PERFORMANCE_AUDIT.md`) — colors with spring easings will run WAAPI-on-main-thread there; acceptable (parity with today) but worth a release-notes line.
- Future widening (borderColor family, `fill`/`stroke`) should reuse the Step 3 eligibility matrix; SVG is currently excluded wholesale by the `subject instanceof HTMLElement` check in `waapi.ts:47`.
- Reviewer should scrutinize: no change to the `hasBrowserOnlyColors` branch semantics, and the updated comment accurately states why remaining colors are excluded.
