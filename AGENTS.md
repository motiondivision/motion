## Structure

This is a monorepo. Development and test environments live in `/dev`, packages live in `/packages`.

Packages are:

-   `framer-motion`: For React-specific code. More of this should be refactored to `motion-dom` where possible.
-   `motion`: Re-export of `framer-motion`.
-   `motion-dom`: Vanilla/JS animation library.
-   `motion-utils`: Pure functions and easing functions.

## Tests

There are three types of test suites in Motion.

1. Jest (unit) tests
2. Cypress e2e tests
3. Playwright e2e tests

### Jest

Structure code to be unit testable where possible. Co-locate a unit test in a `__tests__` folder. Name the unit tests for a file `<filename>.test.ts(x)`.

Run with `yarn test`.

### Cypress

The Cypress test suite is for testing React code in a browser environment.

When a piece of UI is interactable, or we rely on browser APIs, write a Cypress test. The UI files should live in `dev/react/src/tests` and the test files to run against them live in `packages/framer-motion/cypress/integration`.

Run with `yarn test-e2e`.

### Playwright

The Cypress test suite is for testing vanilla JS code in a browser environment.

The UI files live in `dev/html/public/playwright` and the test files live in `/tests`.

Run with `yarn test-playwright`.

## Cursor Cloud specific instructions

### Environment

- Node v22 (specified in `.nvmrc`) and Yarn 3.6.4 (bundled at `.yarn/releases/yarn-3.6.4.cjs`) are required. The `node-modules` linker is used (not PnP).
- No external services, databases, or Docker containers are needed — this is a pure JS library.

### Building

- **Always build before running E2E tests or dev servers**: `yarn build` (runs Turborepo across all packages in dependency order).
- Builds are cached by Turborepo. After code changes, re-run `yarn build` to update `dist/` outputs.

### Dev servers

All four dev servers are started together with `yarn dev-server` (Turborepo parallel):

| App | Port | Purpose |
|---|---|---|
| `dev/react` | 9990 | React 18 playground (Vite) — used by Cypress React tests |
| `dev/react-19` | 9991 | React 19 playground (Vite) — used by Cypress React 19 tests |
| `dev/html` | 8000 | Vanilla JS playground (Vite) — used by Cypress HTML + Playwright tests |
| `dev/next` | 3000 | Next.js 15 RSC app — used by Cypress RSC tests |

The Next.js dev server may occasionally stop when started via `yarn dev-server`; restart it individually with `cd dev/next && npx next dev --port 3000`.

### Playwright

Before running Playwright tests, ensure browsers are installed: `npx playwright install --with-deps chromium webkit`. The tests target both Chromium and WebKit. The HTML dev server on port 8000 must be running.

### Lint

`yarn lint` runs ESLint across all packages. Pre-existing lint errors exist in `dev/react` example/test files — these are not in the core library packages.
