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

## Bug Fixes: Test-First Approach

When fixing bugs, always follow a TDD workflow:

1. **Write a failing test first** - Create a test that reproduces the bug before writing any fix
2. **Verify the test fails** - Run the test to confirm it fails as expected
3. **Implement the fix** - Write the minimal code needed to make the test pass
4. **Verify the test passes** - Run the test again to confirm the fix works

This ensures:
- The bug is properly understood and captured
- The fix actually addresses the issue
- Regressions are prevented in the future

Example workflow for Cypress E2E tests:
```bash
# 1. Add test component to dev/react/src/tests/
# 2. Add test case to packages/framer-motion/cypress/integration/
# 3. Run the specific test to verify it fails:
yarn start-server-and-test "yarn dev-server" http://localhost:9990 \
  "cd packages/framer-motion && npx cypress run --spec cypress/integration/your-test.ts"
# 4. Implement the fix
# 5. Run the test again to verify it passes
```

## Writing Tests

When waiting for the next frame in async tests:

```javascript
async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}
```

## Code Style

- Use `interface` for type definitions (enforced by ESLint)
- No default exports (use named exports)
- Prefer arrow callbacks
- Use strict equality (`===`)
- No `var` declarations (use `const`/`let`)
