# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies (use make bootstrap for first-time setup)
make bootstrap

# Build all packages (ALWAYS run from repo root, not from individual packages)
yarn build           # or: make build

# Watch mode for development
yarn watch           # or: make watch

# Run tests
yarn test            # Unit tests (Jest) for all packages
yarn test-playwright # Playwright E2E tests

# Run tests for a specific package
cd packages/framer-motion && yarn test-client  # Client-side Jest tests
cd packages/framer-motion && yarn test-server  # SSR Jest tests

# Lint
yarn lint            # or: make lint

# Run E2E tests
make test-e2e        # Runs all E2E tests (Next.js, HTML, React, React 19, Playwright)
make test-single     # Run a single Cypress test (edit spec path in Makefile)
```

## Package Architecture

This is a Yarn workspaces monorepo managed by Turborepo and Lerna.

### Core Packages (packages/)

- **motion** - Main public package (`npm install motion`). Re-exports from framer-motion with cleaner entry points (`motion/react`, `motion/mini`)
- **framer-motion** - Core implementation for React. Contains all animation logic, components, hooks, and features
- **motion-dom** - DOM-specific animation utilities (animate, scroll, gestures, effects). Framework-agnostic
- **motion-utils** - Shared utilities (easing, math helpers, error handling). No dependencies

### Development Apps (dev/)

- **dev/react** - React 18 development/test app (port 9990)
- **dev/react-19** - React 19 development/test app (port 9991)
- **dev/next** - Next.js development/test app (port 3000)
- **dev/html** - Vanilla JS/HTML test pages (port 8000)

### Package Dependency Flow

```
motion-utils (base utilities)
    ↓
motion-dom (DOM animation engine)
    ↓
framer-motion (React integration)
    ↓
motion (public API)
```

## Key Source Directories (packages/framer-motion/src/)

- **animation/** - Animation system (animators, sequences, optimized-appear)
- **components/** - React components (AnimatePresence, LayoutGroup, LazyMotion, Reorder)
- **context/** - React contexts (MotionContext, PresenceContext, LayoutGroupContext)
- **gestures/** - Gesture handling (drag, pan, tap, hover, focus)
- **motion/** - Core motion component and feature system
- **projection/** - Layout animation projection system (FLIP animations)
- **render/** - Rendering pipeline (HTML, SVG, DOM utilities)
- **value/** - Motion values and hooks (useMotionValue, useSpring, useScroll, useTransform)

## Writing Tests

**IMPORTANT: Always write tests for every bug fix AND every new feature.** Write a failing test FIRST before implementing, to ensure the issue is reproducible and the fix is verified.

**"Failing test" means a test that reproduces the reported bug.** The test should assert the expected behavior and fail because of the bug — not because your planned code doesn't exist yet. A TypeScript compile error for an API you're about to add is not a failing test. Write the test against the existing codebase, see it fail for the right reason, then implement the fix.

### Test types by feature

- **Unit tests (Jest)**: For pure logic, value transformations, utilities. Located in `__tests__/` directories alongside source. **JSDOM does not support WAAPI** (`Element.animate()`), so Jest tests only cover the JS animation fallback path.
- **E2E tests (Cypress)**: For UI behavior that involves DOM rendering, scroll interactions, gesture handling, or WAAPI animations. Test specs in `packages/framer-motion/cypress/integration/`, test pages in `dev/react/src/tests/`.
- **E2E tests (Playwright)**: For cross-browser testing and HTML/vanilla JS tests. Specs in `tests/`, test pages in `dev/html/public/playwright/`.

### When to escalate from unit tests to Cypress

**If a bug is reported with a reproduction but your unit test passes, do NOT conclude "already works."** JSDOM lacks WAAPI, real layout, and real browser rendering. The bug is likely in the browser code path. You MUST:

1. Create a Cypress E2E test that matches the reporter's reproduction as closely as possible.
2. Verify the Cypress test fails before implementing a fix.
3. If the bug involves `opacity`, `transform`, React.lazy/Suspense, scroll, layout animations, or any visual behavior — **start with Cypress**, skip the unit test entirely.

### Creating Cypress E2E tests

1. **Create a test page** in `dev/react/src/tests/<test-name>.tsx` exporting a named `App` component. It's automatically available at `?test=<test-name>`.
2. **Create a spec** in `packages/framer-motion/cypress/integration/<test-name>.ts`.
3. **Verify WAAPI acceleration** using `element.getAnimations()` in Cypress `should` callbacks to check that native animations are (or aren't) created.

### Running Cypress tests locally

**You MUST run every new Cypress test against both React 18 and React 19 before creating a PR.** CI runs both and will break if you skip this.

Use the `test-single` pattern from the Makefile, adapted per spec:

```bash
# React 18 (port 9990, default cypress.json)
yarn start-server-and-test "yarn dev-server" http://localhost:9990 \
  "cd packages/framer-motion && cypress run --headed --spec cypress/integration/<test-name>.ts"

# React 19 (port 9991, cypress.react-19.json)
yarn start-server-and-test "yarn dev-server" http://localhost:9991 \
  "cd packages/framer-motion && cypress run --config-file=cypress.react-19.json --headed --spec cypress/integration/<test-name>.ts"
```

Both must pass. If a test fails on one React version but not the other, investigate — do not skip it.

### Async test helpers

When waiting for the next frame in async tests:

```javascript
async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}
```

## Code Style

- **Prioritise small file size** — this is a library shipped to end users. Prefer concise patterns that minimise output bytes.
- Prefer optional chaining (`value?.jump()`) over explicit `if` statements
- Use `interface` for type definitions (enforced by ESLint)
- No default exports (use named exports)
- Prefer arrow callbacks
- Use strict equality (`===`)
- No `var` declarations (use `const`/`let`)

## Fixing Issues from Bug Reports

When working on a bug fix from a GitHub issue:

1. **The reporter's reproduction code is the basis for your test.** If the issue links to a CodeSandbox/StackBlitz, fetch it. Try multiple URL patterns if the first fails. If the issue has inline code, use that directly.
2. **If you cannot get the reproduction code, STOP and ask for help.** Do not guess at what the reporter meant — that leads to tests that prove nothing. Message the team lead with the URL and ask them to provide the code.
3. **Do not proceed to a fix without a test that fails for the right reason.** See the "Writing Tests" section above.

## Known GitHub CLI Issues

`gh pr edit` fails on this repo due to GitHub's Projects Classic deprecation blocking the GraphQL mutation. **This is expected — do not investigate, retry, or work around it.** If `gh pr create` succeeded and the code is pushed, you're done. Move on.

## Notes

Be thorough - I am at risk of losing my job.

## Timing

Use `time.now()` from `motion-dom/src/frameloop/sync-time.ts` instead of `performance.now()` for frame-synced timestamps. This ensures consistent time measurements within synchronous contexts and proper sync with the animation frame loop.
