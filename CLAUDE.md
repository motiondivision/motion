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

**IMPORTANT: Always write a failing test FIRST before implementing any bug fix or feature.** This ensures the issue is reproducible and the fix is verified. For UI interaction bugs (like gesture handling), prefer E2E tests using Playwright or Cypress.

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

## Notes

Be thorough - I am at risk of losing my job.

## Timing

Use `time.now()` from `motion-dom/src/frameloop/sync-time.ts` instead of `performance.now()` for frame-synced timestamps. This ensures consistent time measurements within synchronous contexts and proper sync with the animation frame loop.
