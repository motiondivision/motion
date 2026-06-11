# Plan 001: Promote `animateLayout()` from the dev-fixture harness into motion-dom's public API

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/layout/ packages/motion-dom/src/index.ts dev/html/src/imports/animate-layout.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `42bfbe3ed`, 2026-06-10

## Why this matters

Imperative layout animations (FLIP animations over plain DOM, driven by the same projection engine that powers React's `layout` prop) are fully built in `motion-dom`: the `LayoutAnimationBuilder` class and its argument parser are on `main` and exported. But the user-facing entry point — `animateLayout()` — exists only as a 12-line wrapper inside the dev test harness (`dev/html/src/imports/animate-layout.js`), where it is consumed by 24 E2E fixture pages and a Playwright suite. Vanilla-JS users currently cannot call layout animations at all without constructing internal classes by hand. Promoting the wrapper into `motion-dom` closes the single biggest React-vs-vanilla parity gap that is already 95% built and 100% tested.

## Current state

Relevant files:

- `packages/motion-dom/src/layout/LayoutAnimationBuilder.ts` — the builder (class at lines 62–88, `parseAnimateLayoutArgs` at lines 232–259). The intended public overloads are documented in comments inside the parser:

  ```ts
  // packages/motion-dom/src/layout/LayoutAnimationBuilder.ts:232-252
  export function parseAnimateLayoutArgs(
      scopeOrUpdateDom: ElementOrSelector | (() => void),
      updateDomOrOptions?: (() => void) | AnimationOptions,
      options?: AnimationOptions
  ): {
      scope: Element | Document
      updateDom: () => void
      defaultOptions?: AnimationOptions
  } {
      // animateLayout(updateDom)
      if (typeof scopeOrUpdateDom === "function") { ... }

      // animateLayout(scope, updateDom, options?)
      const elements = resolveElements(scopeOrUpdateDom)
      ...
  }
  ```

- `packages/motion-dom/src/index.ts:309-315` — current export block:

  ```ts
  /**
   * Layout animations
   */
  export {
      LayoutAnimationBuilder,
      parseAnimateLayoutArgs,
  } from "./layout/LayoutAnimationBuilder"
  ```

- `dev/html/src/imports/animate-layout.js` — the wrapper to promote (complete file):

  ```js
  import {
      LayoutAnimationBuilder,
      frame,
      parseAnimateLayoutArgs,
      animate,
  } from "framer-motion/dom"

  export function unstable_animateLayout(
      scopeOrUpdateDom,
      updateDomOrOptions,
      options
  ) {
      const { scope, updateDom, defaultOptions } = parseAnimateLayoutArgs(
          scopeOrUpdateDom,
          updateDomOrOptions,
          options
      )

      return new LayoutAnimationBuilder(scope, updateDom, defaultOptions)
  }

  window.AnimateLayout = {
      animateLayout: unstable_animateLayout,
      LayoutAnimationBuilder,
      frame,
      animate,
  }
  ```

- `dev/html/public/animate-layout/*.html` — 24 fixture pages calling `window.AnimateLayout.animateLayout(...)`.
- `tests/animate-layout/animate-layout.spec.ts` — Playwright spec exercising those fixtures.
- `packages/framer-motion/cypress/integration-html/animate-layout-timing.ts` — Cypress (HTML config) spec.

Export chain (why no further wiring is needed): `packages/framer-motion/src/dom.ts:1` is `export * from "motion-dom"`, and `packages/motion/src/index.ts` is `export * from "framer-motion/dom"`. Anything exported from `motion-dom/src/index.ts` is automatically public on the `motion` package.

Repo conventions: named exports only (no default exports), `interface` over `type` where applicable, arrow callbacks, small-file-size-first. TypeScript function overloads are used elsewhere in the codebase for multi-signature APIs.

Naming decision (made by the advisor, do not re-litigate): export as `animateLayout`. The `unstable_` prefix in the harness was a harness-local hedge; the comments in `parseAnimateLayoutArgs` name the API `animateLayout`.

## Commands you will need

| Purpose | Command (from repo root unless noted) | Expected on success |
|---|---|---|
| Build all packages | `yarn build` | exit 0 |
| motion-dom unit tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="layout"` | all pass (or "no tests found" if none match before you add any) |
| Lint | `yarn lint` | exit 0 |
| Playwright animate-layout suite | `npx playwright test tests/animate-layout/` | all pass (config auto-starts the dev server) |
| Cypress HTML spec | start server: `cd dev/html && yarn vite --port 8000` (background), then `cd packages/framer-motion && npx cypress run --config-file=cypress.html.json --spec cypress/integration-html/animate-layout-timing.ts` | all pass |

Staleness traps (from prior sessions in this repo): after editing motion-dom source you MUST rebuild (`yarn build`) before E2E runs — fixtures consume built output, not source. Build output can be suppressed/cached by turbo; if a change doesn't seem to take effect, rebuild and confirm the file under `packages/motion-dom/lib/` or `dist/` updated. Run Cypress in the foreground (background runs hang silently).

## Scope

**In scope** (the only files you should modify/create):
- `packages/motion-dom/src/layout/animate-layout.ts` (create)
- `packages/motion-dom/src/index.ts` (add one export line)
- `packages/motion-dom/src/layout/__tests__/animate-layout.test.ts` (create)
- `dev/html/src/imports/animate-layout.js` (re-point at the new export)

**Out of scope** (do NOT touch, even though they look related):
- `packages/motion-dom/src/layout/LayoutAnimationBuilder.ts` — there is an in-flight rewrite on branch `worktree-animate-layout-v2` ("batched commits on a shared projection tree"). Any change here will conflict with it.
- The 24 fixture HTML pages and the Playwright/Cypress specs — they must pass UNCHANGED; that is the regression gate.
- `packages/framer-motion/src/dom.ts`, `packages/motion/src/*` — the `export *` chain already publishes the new export.

## Git workflow

- Branch: `advisor/001-animate-layout-public-api`
- Commit style: short imperative subject, matching repo history (e.g. "Add public animateLayout() entry point").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the public function

Create `packages/motion-dom/src/layout/animate-layout.ts`:

```ts
import type { AnimationOptions } from "../animation/types"
import type { ElementOrSelector } from "../utils/resolve-elements"
import {
    LayoutAnimationBuilder,
    parseAnimateLayoutArgs,
} from "./LayoutAnimationBuilder"

export function animateLayout(
    updateDom: () => void | Promise<void>,
    options?: AnimationOptions
): LayoutAnimationBuilder
export function animateLayout(
    scope: ElementOrSelector,
    updateDom: () => void | Promise<void>,
    options?: AnimationOptions
): LayoutAnimationBuilder
export function animateLayout(
    scopeOrUpdateDom: ElementOrSelector | (() => void | Promise<void>),
    updateDomOrOptions?: (() => void | Promise<void>) | AnimationOptions,
    options?: AnimationOptions
): LayoutAnimationBuilder {
    const { scope, updateDom, defaultOptions } = parseAnimateLayoutArgs(
        scopeOrUpdateDom as Parameters<typeof parseAnimateLayoutArgs>[0],
        updateDomOrOptions as Parameters<typeof parseAnimateLayoutArgs>[1],
        options
    )

    return new LayoutAnimationBuilder(scope, updateDom, defaultOptions)
}
```

If the signature of `parseAnimateLayoutArgs` on `main` accepts these argument types directly without casts, drop the casts — match the real types you find. Note `LayoutAnimationBuilder`'s constructor accepts `updateDom: () => void | Promise<void>` (line 73) while `parseAnimateLayoutArgs` returns `updateDom: () => void`; reconcile the overload types against what compiles without modifying `LayoutAnimationBuilder.ts`.

**Verify**: `yarn build` → exit 0.

### Step 2: Export from motion-dom

In `packages/motion-dom/src/index.ts`, extend the layout block (currently lines 309–315):

```ts
export { animateLayout } from "./layout/animate-layout"
export {
    LayoutAnimationBuilder,
    parseAnimateLayoutArgs,
} from "./layout/LayoutAnimationBuilder"
```

**Verify**: `yarn build` → exit 0, then `grep -n "animateLayout" packages/motion-dom/dist/index.d.ts packages/motion-dom/types/index.d.ts 2>/dev/null` → at least one match in generated types.

### Step 3: Unit test

Create `packages/motion-dom/src/layout/__tests__/animate-layout.test.ts`. JSDOM cannot run real layout animations (no real layout), so test only argument-routing and return type:

- `animateLayout(fn)` returns a `LayoutAnimationBuilder` instance, scope defaults to `document`.
- `animateLayout(element, fn)` uses the element as scope.
- `animateLayout("#id", fn, { duration: 1 })` resolves the selector and passes options through.

You can assert scope/options via the builder's private fields with a typed-as-any cast, or by spying on `parseAnimateLayoutArgs` — prefer asserting on the instance. Model the file layout after `packages/motion-dom/src/utils/__tests__/stagger.test.ts`.

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="animate-layout"` → all new tests pass.

### Step 4: Re-point the dev harness at the real export

Edit `dev/html/src/imports/animate-layout.js`: delete the local `unstable_animateLayout` implementation, import `animateLayout` from `"framer-motion/dom"`, and keep `window.AnimateLayout = { animateLayout, LayoutAnimationBuilder, frame, animate }` exactly as-is so all 24 fixtures keep working unmodified.

**Verify**: `yarn build` → exit 0 (the harness consumes built output — rebuild first), then run the Playwright suite: `npx playwright test tests/animate-layout/` → all pass.

### Step 5: Full regression gates

**Verify**:
1. `npx jest --config packages/motion-dom/jest.config.json` → no new failures (pre-existing known failures in this repo: SSR "TextEncoder not defined" and use-velocity tests — ignore those if present).
2. Cypress HTML spec (commands table above) → `animate-layout-timing.ts` passes.
3. `yarn lint` → exit 0.

## Test plan

- New: `packages/motion-dom/src/layout/__tests__/animate-layout.test.ts` — 3 cases listed in Step 3.
- Existing (regression gate, unchanged): `tests/animate-layout/animate-layout.spec.ts` (Playwright, 24 fixtures), `cypress/integration-html/animate-layout-timing.ts`.
- Verification: commands in Step 5.

## Done criteria

- [ ] `yarn build` exits 0
- [ ] `grep -rn "export function animateLayout" packages/motion-dom/src/layout/animate-layout.ts` → 1+ matches
- [ ] `grep -n "animate-layout" packages/motion-dom/src/index.ts` → 1 match
- [ ] `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="animate-layout"` → all pass
- [ ] `npx playwright test tests/animate-layout/` → all pass
- [ ] `grep -n "unstable_animateLayout" dev/html/src/imports/animate-layout.js` → no matches
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `parseAnimateLayoutArgs` or `LayoutAnimationBuilder`'s constructor signature on `main` no longer matches the excerpts (the `worktree-animate-layout-v2` rewrite may have merged — the public function must then be built against the new internals, which needs advisor review).
- An `animateLayout` export already exists in `packages/motion-dom/src/index.ts` (someone shipped it since this plan was written).
- The Playwright animate-layout suite fails on `main` BEFORE your changes (broken baseline — record the failure and stop).
- Step 4's Playwright run fails twice after rebuild.

## Maintenance notes

- The `worktree-animate-layout-v2` branch rewrites `LayoutAnimationBuilder` internals; this plan deliberately adds only a thin wrapper so the rewrite can land underneath it without changing the public signature. Reviewer should confirm the wrapper contains zero logic beyond arg parsing + construction.
- Once public, the API surface (`animateLayout`, `.shared()`, thenable builder) becomes a semver commitment — the maintainer may want a changelog entry under "Added" and docs on motion.dev (out of scope here).
- Follow-up deliberately deferred: React-side interop guarantees (calling `animateLayout` on DOM owned by `motion` components) — covered by the `modal-open-after-animate.html` fixture but not documented.
