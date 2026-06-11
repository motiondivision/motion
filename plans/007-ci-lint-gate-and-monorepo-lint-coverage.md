# Plan 007: Lint every published package and make lint a blocking CI job

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- .circleci/config.yml packages/motion-dom/package.json packages/motion-utils/package.json packages/framer-motion/package.json .eslintrc`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (additive scripts + CI job; the only risk is surfacing pre-existing lint errors, handled by an escape hatch)
- **Depends on**: none (006 also edits `.circleci/config.yml` — if both run, rebase carefully; both add independent jobs)
- **Category**: dx
- **Planned at**: commit `42bfbe3ed`, 2026-06-10

## Why this matters

`yarn lint` at the repo root runs `turbo run lint`, but only **framer-motion** defines a `lint` script — `packages/motion-dom` (246 source files, the core animation engine) and `packages/motion-utils` are **never linted**, locally or in CI. On top of that, CircleCI (`.circleci/config.yml`) has **no lint job at all**: the workflow runs `setup`, `test`, `test-react`, `test-react-19`, `test-html` only. The repo carries a serious lint setup (`eslint-plugin-redos-detector`, `eslint-plugin-regexp`, react-hooks, react-compiler) whose ReDoS/regex rules specifically matter for motion-dom's value-parsing code — and that package is exactly the one not covered. A PR can merge with lint violations and nobody notices.

## Current state

- Root `package.json:16` — `"lint": "turbo run lint"`.
- `turbo.json` — has a `lint` pipeline entry (`"lint": {}`), no dependencies.
- `packages/framer-motion/package.json` — `"lint": "yarn eslint src/**/*.ts"` (the exemplar to copy).
- `packages/motion-dom/package.json` — scripts: `clean`, `build`, `dev`, `test`, `measure`. **No `lint`.**
- `packages/motion-utils/package.json` — scripts: `clean`, `build`, `dev`, `test`. **No `lint`.**
- `.eslintrc` — single shared config at the repo root (eslint 8, classic config format; do not migrate to flat config in this plan).
- `.circleci/config.yml` — jobs `setup` / `test` / `test-react` / `test-react-19` / `test-html`; workflow `build` at the bottom lists them. `setup` runs `yarn install --immutable` then `yarn build` and persists the workspace; all other jobs `attach_workspace` and require `setup`. There is no lint job.
- `Makefile:100-101` — a `lint: bootstrap` target that runs `yarn lint` (works today, but only lints framer-motion due to the missing scripts).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `yarn install` (only if node_modules missing) | exit 0 |
| Lint one package | `cd packages/motion-dom && yarn lint` | exit 0 after fixes |
| Lint all | `yarn lint` (repo root) | exit 0; turbo shows 3 lint tasks |
| Validate CI YAML | `python3 -c "import yaml; yaml.safe_load(open('.circleci/config.yml'))"` | exit 0 |
| Unit tests (regression gate after auto-fixes) | `cd packages/motion-dom && yarn test` and `cd packages/motion-utils && yarn test` | pass (note: a couple of pre-existing failures exist in framer-motion SSR/use-velocity tests — those are NOT yours; motion-dom/motion-utils suites are expected green) |

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/package.json` — add `lint` script
- `packages/motion-utils/package.json` — add `lint` script
- `.circleci/config.yml` — add `lint` job + workflow entry
- Source files inside `packages/motion-dom/src` and `packages/motion-utils/src` **only** for mechanical lint fixes (see Step 2 escape hatch)
- `plans/README.md` — status update

**Out of scope** (do NOT touch):
- `.eslintrc` — do not weaken or rewrite rules to make lint pass (exception: per-line `eslint-disable-next-line` with a one-line justification comment is allowed where a fix would change behavior).
- `packages/framer-motion` — already linted; leave as is.
- `dev/*` apps — they have known lint errors; linting them is a separate decision for the maintainer.
- ESLint 9 / flat-config migration — explicitly deferred.
- Any behavioral code change. Lint fixes must be semantics-preserving.

## Git workflow

- Branch: `advisor/007-lint-gate`
- One commit for the scripts/CI wiring, one commit per package for lint fixes (keeps review tractable). Message style: short imperative, e.g. "Add lint scripts to motion-dom and motion-utils".
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add lint scripts

In `packages/motion-dom/package.json` and `packages/motion-utils/package.json`, add to `scripts` (mirroring framer-motion's):

```json
"lint": "yarn eslint src/**/*.ts"
```

**Verify**: `cd packages/motion-utils && yarn lint; echo "exit: $?"` → runs eslint (exit code may be non-zero if violations exist — that's Step 2's job; here you only verify the script resolves and eslint executes rather than erroring on config).

### Step 2: Fix surfaced violations

Run lint in each package. Count the errors (not warnings) first:

- `cd packages/motion-dom && yarn lint 2>&1 | tail -5` — eslint prints a summary line like "✖ N problems (X errors, Y warnings)".

**Escape hatch**: if either package has **more than ~40 errors**, STOP and report the count and the top rule IDs instead of fixing — the maintainer should decide between a fix sweep and rule tuning. If under that bar:

1. Run `yarn eslint src/**/*.ts --fix` in the package for auto-fixables.
2. Fix the remainder by hand, preserving semantics. For any error where the "fix" would change runtime behavior (e.g. a redos-detector or regexp-plugin finding on a real regex), do NOT alter the regex — add `// eslint-disable-next-line <rule> -- <one-line reason>` and list it in your report for the maintainer to review. There is exactly one pre-existing example of this pattern at `packages/motion-dom/src/animation/utils/css-variables-conversion.ts:16`.

**Verify**: `cd packages/motion-dom && yarn lint` → exit 0; same for motion-utils. Then `cd packages/motion-dom && yarn test` → suite passes; `cd packages/motion-utils && yarn test` → suite passes.

### Step 3: Add the CI lint job

In `.circleci/config.yml`, add (match the file's 4-space YAML indentation; model on the existing `test` job):

```yaml
    lint:
        docker:
            - image: cimg/node:20.11.1-browsers
        working_directory: ~/repo
        steps:
            - attach_workspace:
                  at: ~/repo
            - run:
                  name: Lint
                  command: yarn lint
```

Add to the `workflows: build: jobs:` list:

```yaml
            - lint:
                  requires:
                      - setup
```

**Verify**: `python3 -c "import yaml; yaml.safe_load(open('.circleci/config.yml'))"` → exit 0.

### Step 4: Full-repo lint pass

**Verify**: `yarn lint` from the repo root → exit 0, and turbo's output lists lint tasks for `framer-motion`, `motion-dom`, and `motion-utils` (3 packages).

## Test plan

No new unit tests. The regression gates are: each package's existing jest suite green after lint fixes (Step 2 verify), plus the root `yarn lint` exit 0 (Step 4). Run `cd packages/framer-motion && yarn test-client` only if you touched any file it imports (you shouldn't have).

## Done criteria

- [ ] `grep -n '"lint"' packages/motion-dom/package.json packages/motion-utils/package.json` → one match each
- [ ] `yarn lint` (root) exits 0 and covers 3 packages
- [ ] `.circleci/config.yml` parses and contains a `lint` job requiring `setup` in the `build` workflow
- [ ] `cd packages/motion-dom && yarn test` exits 0; `cd packages/motion-utils && yarn test` exits 0
- [ ] Every new `eslint-disable` comment carries a reason and is listed in the executor's report
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Either package shows more than ~40 lint **errors** (report counts + rule breakdown).
- Any lint fix would change a regex, a public type signature, or observable behavior and a disable-comment feels wrong — report the specific case.
- `yarn test` in a package fails after your fixes and the failure isn't one of the documented pre-existing flakes (SSR "TextEncoder not defined", use-velocity) — revert the offending fix and report.
- The `.eslintrc` appears to be ignored for motion-dom (e.g. eslint errors on parserOptions/project) — config plumbing issues are maintainer territory.

## Maintenance notes

- Plan 006 also adds a job to `.circleci/config.yml`. The two changes are independent (different job names); whichever lands second needs a trivial merge.
- When the maintainer eventually migrates to ESLint 9 flat config, these two `lint` scripts come along for free; only `.eslintrc` and the devDependency change.
- Reviewer focus: the manual (non-`--fix`) lint fixes in motion-dom — each must be a pure refactor. Anything touching `value/types/` parsing or frameloop code deserves a close read.
- Deferred follow-up (not in this plan): a repo-wide `tsc --noEmit` typecheck script that includes `__tests__` and cypress code — both package tsconfigs currently exclude tests, so test-file type errors only surface at runtime.
