# Plan 035: Make bundle-size budgets a blocking gate (CI + publish) and re-baseline them

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- .circleci/config.yml package.json dev/inc/bundlesize.mjs packages/framer-motion/package.json packages/motion-dom/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (007 also adds a CircleCI job — independent jobs, trivial merge for whichever lands second)
- **Category**: dx
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

This is a library where shipped bytes are a headline feature, and the repo
already has good size tooling: per-entry-point size bundles
(`rollup.size.config.mjs`) and gzip budgets in each package's
`package.json#bundlesize`, checked by `dev/inc/bundlesize.mjs`. But **nothing
runs the check**: CircleCI has no measure job, and the publish path
(`prepare`/`prepack`) runs the rollup `measure` task without the budget
script. The result, measured at commit `42bfbe3ed`: **6 of 9 budgets are
failing**, and the main `<motion.div>` bundle drifted from 35.65 kB gz
(v12.23.24, Oct 2025) to 38.56 kB gz (+10%) with zero signal. Budgets were
last calibrated April 2025 (commit `596e0eee8`). This plan re-baselines the
budgets to current reality and wires the existing check into CI and the
publish flow so future growth is a deliberate decision, not silent drift.

## Current state

- `dev/inc/bundlesize.mjs` — the budget checker. Reads each package's
  `package.json#bundlesize` array, gzips each listed dist file (zlib default
  level), exits 1 on any breach. **It resolves paths from `process.cwd()`**
  (`bundlesize.mjs:15-17`: `path.join(process.cwd(), "packages", packageName, ...)`),
  so today it only works when run from the repo root. Takes an optional
  package-name argv (`framer-motion` or `motion-dom`).
- Root `package.json:20`: `"measure": "turbo run measure --force && node dev/inc/bundlesize.mjs"`
  — the ONLY place the check runs, and nothing invokes it.
- Root `package.json:23`: `"prepare": "turbo run build measure"` — runs the
  per-package rollup `measure` tasks but NOT the check.
- `packages/framer-motion/package.json` scripts:
  `"prepack": "yarn build && yarn measure"` (no check);
  `"measure": "rollup -c ./rollup.size.config.mjs"`.
- `packages/motion-dom/package.json` scripts: has `"measure"` but no
  `"prepack"`.
- `.circleci/config.yml` — jobs `setup` / `test` / `test-react` /
  `test-react-19` / `test-html`. `setup` runs `yarn install --immutable` then
  `yarn build` and persists the whole workspace; all other jobs
  `attach_workspace` and `requires: setup`. There is no measure/size job.
  4-space YAML indentation throughout.
- Budgets and actuals at `42bfbe3ed` (from `yarn build && yarn measure`):

  | Bundle | Actual (kB gz) | Budget | Status |
  |---|---|---|---|
  | framer-motion size-rollup-motion.js | 38.56 | 34.9 | ❌ |
  | framer-motion size-rollup-m.js | 6.31 | 6 | ❌ |
  | framer-motion size-rollup-dom-animation.js | 13.58 | 17.85 | ✅ (loose) |
  | framer-motion size-rollup-dom-max.js | 26.86 | 29.8 | ✅ (loose) |
  | framer-motion size-rollup-animate.js | 21.61 | 19.1 | ❌ |
  | framer-motion size-rollup-scroll.js | 6.18 | 5.2 | ❌ |
  | framer-motion size-rollup-waapi-animate.js | 3.15 | 2.26 | ❌ |
  | motion-dom size-rollup-style-effect.js | 3.10 | 2.9 | ❌ |
  | motion-dom size-rollup-motion-value.js | 1.70 | 1.8 | ✅ |

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Install | `yarn install` (only if node_modules missing) | exit 0 |
| Build | `yarn build` | exit 0 |
| Measure + check | `yarn measure` | exit 0 after Step 2, all ✅ |
| Check one package | `node dev/inc/bundlesize.mjs framer-motion` | exit 0 after Step 2 |
| Validate CI YAML | `python3 -c "import yaml; yaml.safe_load(open('.circleci/config.yml'))"` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `dev/inc/bundlesize.mjs` — make cwd-independent
- `package.json` (root) — no change expected, verify only
- `packages/framer-motion/package.json` — budgets + prepack
- `packages/motion-dom/package.json` — budgets + prepack
- `.circleci/config.yml` — add `measure` job

**Out of scope** (do NOT touch, even though they look related):
- `rollup.size.config.mjs` in either package — the measurement itself is fine.
- Any source file — this plan changes process, not bytes. Plans 036/037/038
  reclaim bytes.
- The loose budgets' historical values — re-baseline them tight like the rest;
  do not try to reconstruct why they were loose.

## Git workflow

- Branch: `advisor/035-bundle-size-budget-enforcement`
- Single commit is fine; message style matches repo (sentence case, concise),
  e.g. `Enforce bundle-size budgets in CI and prepack, re-baseline to actuals`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make `bundlesize.mjs` cwd-independent

In `dev/inc/bundlesize.mjs`, replace the `process.cwd()`-based path
resolution so the script works when invoked from a package directory (needed
for prepack). At the top of the file add:

```js
import { fileURLToPath } from "url"

const repoRoot = fileURLToPath(new URL("../..", import.meta.url))
```

Then replace both uses of `process.cwd()` (the `packagePath` join at
~line 15 and the `fullPath` join at ~line 37) with `repoRoot`.

**Verify**: `node dev/inc/bundlesize.mjs framer-motion` from repo root still
prints the per-bundle table (exit 1 is expected — budgets not yet
re-baselined), AND `cd packages/framer-motion && node ../../dev/inc/bundlesize.mjs framer-motion`
prints the same table.

### Step 2: Re-baseline all budgets to current actuals + ~1%

Run from repo root: `yarn build && yarn measure` (the measure step will exit
1 — read the printed actuals). For EVERY entry in
`packages/framer-motion/package.json#bundlesize` and
`packages/motion-dom/package.json#bundlesize`, set `maxSize` to the printed
actual × 1.01, rounded UP to the nearest 0.05 kB. Use the actuals from YOUR
build, not the table in this plan (toolchain noise of ±0.05 kB is normal).
Expected ballpark: motion 39, m 6.4, dom-animation 13.75, dom-max 27.15,
animate 21.85, scroll 6.25, waapi-animate 3.2, style-effect 3.15,
motion-value 1.75.

**Verify**: `node dev/inc/bundlesize.mjs` → all ✅, exit 0.

### Step 3: Gate publishing via prepack

- `packages/framer-motion/package.json`:
  `"prepack": "yarn build && yarn measure && node ../../dev/inc/bundlesize.mjs framer-motion"`
- `packages/motion-dom/package.json`: add
  `"prepack": "yarn build && yarn measure && node ../../dev/inc/bundlesize.mjs motion-dom"`

**Verify**: `cd packages/motion-dom && yarn prepack` → exit 0 (builds, then
prints ✅ rows). Same for framer-motion.

### Step 4: Add a blocking CircleCI `measure` job

In `.circleci/config.yml`, add (match the file's 4-space indentation; model
on the existing `test` job):

```yaml
    measure:
        docker:
            - image: cimg/node:20.11.1-browsers
        working_directory: ~/repo
        resource_class: large
        steps:
            - attach_workspace:
                  at: ~/repo

            - run:
                  name: Check bundle sizes
                  command: yarn measure
```

And in `workflows: build: jobs:` add:

```yaml
            - measure:
                  requires:
                      - setup
```

Note: `setup` persists the workspace after `yarn build`, so `lib/` (the tsc
output the size rollup consumes) is already present; `yarn measure` re-runs
only the size rollups plus the check.

**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.circleci/config.yml'))"` → exit 0.

## Test plan

No unit tests — this is build/process tooling. The verification commands in
each step are the test. Final end-to-end check: `yarn build && yarn measure`
from a clean `git stash`-free tree → exit 0, every row ✅.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `yarn measure` exits 0 with all rows ✅
- [ ] `cd packages/framer-motion && node ../../dev/inc/bundlesize.mjs framer-motion` exits 0 (cwd-independence)
- [ ] `grep -c "bundlesize.mjs" packages/framer-motion/package.json packages/motion-dom/package.json` → 1 each (prepack wired)
- [ ] `grep -c "measure:" .circleci/config.yml` → ≥1 and YAML parses
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `yarn build` fails at HEAD before you change anything — the baseline is
  broken and re-baselining would encode garbage numbers.
- An actual measured size differs from this plan's table by more than 1 kB gz
  in either direction — something landed between planning and execution
  (possibly branch `cleanup/strip-unused-stats` or plans 036/037); re-read
  `plans/README.md`, re-baseline against the NEW reality, and note it.
- Plan 007 already landed a conflicting edit to the same `workflows:` block
  and the merge isn't trivially mechanical.

## Maintenance notes

- **The budgets are now a ratchet.** Plans 036/037/038 each end by
  re-tightening the budgets they improve. Any PR that legitimately grows a
  bundle must raise the budget in the same commit — that diff line is the
  review signal this plan exists to create.
- The re-baselined numbers bless ~3.7 kB gz of historical drift on the main
  motion bundle. That debt is tracked by plans 036/037/038; do not treat the
  new budgets as endorsed targets.
- `dev/inc/bundlesize.mjs` gzip (zlib default ≈ level 6) reads ~0.4% smaller
  than `gzip -9`; budgets are calibrated to the script, not to CLI gzip.
- If CircleCI minutes become a concern, the `measure` job can be folded into
  the `test` job as an extra step; it was kept separate for signal clarity.
