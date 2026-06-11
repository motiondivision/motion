# Plan 036: Restore dead-code elimination of dev warnings broken by `process.env?.NODE_ENV`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-utils/src/errors.ts packages/framer-motion/scripts/check-bundle.js packages/framer-motion/rollup.config.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (soft: 035 — if it landed, Step 5 ratchets budgets; skip Step 5 otherwise)
- **Category**: perf (bundle size)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

Commit `7a78368b3` (2026-01-05, "Fix ReferenceError: process is not defined
in native browser ESM") changed the dev-warning guard in motion-utils to use
optional chaining: `process.env?.NODE_ENV`. That token does **not** match the
exact-string pattern `process.env.NODE_ENV` used by `@rollup/plugin-replace`
in this repo's production builds, nor by older consumer bundlers (e.g.
webpack < 5.38 DefinePlugin). Consequence, verified in the built artifacts at
`42bfbe3ed`: the production UMD bundles (`framer-motion/dist/framer-motion.js`,
`motion/dist/motion.js` — what CDNs like unpkg serve) and every size bundle
contain a live runtime `NODE_ENV` check plus the full `warning`/`invariant`
implementations, `formatErrorMessage`, the `motion.dev/troubleshooting` URL
builder, and every call-site message string. Measured cost by patching the
minified bundle and re-running terser: **~0.27 kB gz on the main motion
bundle, ~0.2 kB gz on each of the animate/scroll/waapi bundles**. The fix
keeps the `typeof` guard (the actual ReferenceError fix) while restoring the
exact replaceable token.

## Current state

- `packages/motion-utils/src/errors.ts:9-27` (the whole relevant file):

```ts
let warning: DevMessage = () => {}
let invariant: DevMessage = () => {}

if (
    typeof process !== "undefined" &&
    process.env?.NODE_ENV !== "production"
) {
    warning = (check, message, errorCode) => { ... console.warn(formatErrorMessage(message, errorCode)) ... }
    invariant = (check, message, errorCode) => { ... throw new Error(formatErrorMessage(message, errorCode)) ... }
}
```

- This is the ONLY `process.env?.` (optional-chaining) occurrence in any
  package's `src/` — all other env checks use the plain replaceable form
  (verify with the grep in Step 1).
- `packages/framer-motion/rollup.config.mjs:17-28` — `replaceSettings(env)`
  configures `@rollup/plugin-replace` with key `"process.env.NODE_ENV"`. The
  production UMD (`createUmd`, line 78) and the size bundles
  (`rollup.size.config.mjs:8`) use `replaceSettings("production")`.
- Evidence of the leak in built artifacts:
  `grep -c "process.env" packages/framer-motion/dist/framer-motion.js` → 1
  (and it is `process.env?.NODE_ENV`).
- `packages/framer-motion/scripts/check-bundle.js` — post-build assertion
  script (`yarn build` runs it last). It already enforces several
  bundle-integrity invariants by reading dist files and throwing; new checks
  are appended at the end of the file following the existing pattern (each
  check is a block comment explaining the regression + a `readFileSync` +
  conditional `throw`).
- `packages/motion-utils/src/__tests__/errors.test.ts` exists — the runtime
  behavior gate for `warning`/`invariant` (jest runs with NODE_ENV=test, so
  the dev branch is active under test).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Build all | `yarn build` | exit 0 (includes check-bundle.js) |
| motion-utils tests | `cd packages/motion-utils && yarn test` | all pass |
| Size bundles | `yarn measure` | exit 0 if plan 035 landed; otherwise read the table |
| Leak grep (prod UMD) | `grep -c "process.env" packages/framer-motion/dist/framer-motion.js` | `0` after fix |
| Leak grep (motion UMD) | `grep -c "process.env" packages/motion/dist/motion.js` | `0` after fix |

## Scope

**In scope** (the only files you should modify):
- `packages/motion-utils/src/errors.ts`
- `packages/motion-utils/src/__tests__/errors.test.ts` (extend)
- `packages/framer-motion/scripts/check-bundle.js` (add regression assertion)
- `packages/framer-motion/package.json` + `packages/motion-dom/package.json`
  bundlesize values — ONLY in Step 5, only if plan 035 landed

**Out of scope** (do NOT touch, even though they look related):
- `packages/motion-utils/src/format-error-message.ts` — it becomes dead code
  in production builds automatically once DCE works; do not delete or inline it.
- `rollup.config.mjs` / `rollup.size.config.mjs` — the replace config is
  correct; the source token was the problem. (A possible dev-UMD follow-up is
  noted in Maintenance, not here.)
- All other `process.env.NODE_ENV` checks across packages — already in the
  replaceable form.

## Git workflow

- Branch: `advisor/036-node-env-dce`
- One commit, e.g. `Fix NODE_ENV check defeating dead-code elimination of dev warnings`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the leak is singular

`grep -rn "process.env?." packages/motion-utils/src packages/motion-dom/src packages/framer-motion/src --include="*.ts" --include="*.tsx" | grep -v __tests__`

**Verify**: exactly one hit — `packages/motion-utils/src/errors.ts:14`. If
there are more hits, fix them all with the same pattern and list them in your
report.

### Step 2: Restore the replaceable token in `errors.ts`

Replace the condition at `errors.ts:12-15` with:

```ts
if (
    typeof process !== "undefined" &&
    typeof process.env !== "undefined" &&
    process.env.NODE_ENV !== "production"
) {
```

Why this exact shape: the third clause is byte-for-byte the token
`@rollup/plugin-replace` and consumer define-plugins match, so production
builds fold it to `"production" !== "production"` → `false`, and terser then
drops the whole block (the `typeof` clauses are side-effect-free). The first
two clauses preserve the runtime safety the Jan 2026 commit added for
unbundled native-ESM browsers. Known, accepted semantic delta: an exotic
runtime where `process` exists but `process.env` is undefined now resolves to
production (warnings off) instead of dev — the safer default.

**Verify**: `cd packages/motion-utils && yarn test` → all pass (NODE_ENV=test
keeps the dev branch active under jest).

### Step 3: Add the regression assertion to `check-bundle.js`

Append to `packages/framer-motion/scripts/check-bundle.js`, following the
file's existing comment-block + throw pattern:

```js
/**
 * Verify the production UMD bundle contains no `process.env` reference.
 * `process.env?.NODE_ENV` (optional chaining) is invisible to
 * @rollup/plugin-replace's exact `process.env.NODE_ENV` pattern, so dev-only
 * warning machinery and message strings ship to production (plan 036).
 */
const prodUmd = readFileSync(path.join(dist, "framer-motion.js"), "utf8")
if (prodUmd.includes("process.env")) {
    throw new Error(
        "Production UMD bundle (dist/framer-motion.js) references process.env — " +
            "an env check is not in the exact replaceable `process.env.NODE_ENV` form"
    )
}
```

**Verify**: `git stash` the `errors.ts` change, run `yarn build` →
framer-motion's build MUST FAIL with the new error (proves the assertion
catches the bug). `git stash pop`, run `yarn build` again → exit 0.
(Note: motion-utils must be rebuilt for framer-motion to see the change —
`yarn build` from the repo root handles the ordering.)

### Step 4: Confirm the bytes are gone

After the full `yarn build` from Step 3:

**Verify**:
- `grep -c "process.env" packages/framer-motion/dist/framer-motion.js` → 0
- `grep -c "troubleshooting" packages/framer-motion/dist/framer-motion.js` → 0
  (the `motion.dev/troubleshooting` URL builder is DCE'd)
- `grep -c "process.env" packages/motion/dist/motion.js` → 0
- `yarn measure` (or `turbo run measure --force`):
  `dist/size-rollup-motion.js` shrinks vs the plan-035 baseline by roughly
  0.2–0.3 kB gz (expected ~38.3 kB gz if measured at `42bfbe3ed` + this fix).

### Step 5 (only if plan 035 is DONE): Ratchet the budgets

Re-run `yarn measure`, and lower every `bundlesize` `maxSize` that improved
to the new actual × 1.01 rounded up to the nearest 0.05 kB (same rule as plan
035 Step 2).

**Verify**: `node dev/inc/bundlesize.mjs` → exit 0, all ✅.

## Test plan

- Extend `packages/motion-utils/src/__tests__/errors.test.ts` with a case
  asserting `warning(false, "msg")` calls `console.warn` and
  `invariant(false, "msg")` throws under the test env — locking the runtime
  dev behavior the new guard must preserve. Model on the existing cases in
  that file.
- The build-time regression gate is the `check-bundle.js` assertion (Step 3),
  including its deliberate stash/fail/pop exercise — that is the test that
  the bug cannot return.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "process.env?." packages/*/src --include="*.ts"` (excluding `__tests__`) → no hits
- [ ] `yarn build` exits 0 (check-bundle assertion passing)
- [ ] `grep -c "process.env" packages/framer-motion/dist/framer-motion.js` → 0
- [ ] `cd packages/motion-utils && yarn test` → all pass, including the new cases
- [ ] If 035 landed: `node dev/inc/bundlesize.mjs` exits 0 with ratcheted budgets
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 3 stash exercise does NOT fail the build — the assertion is wired
  wrong (wrong file, wrong dist path), and landing it would give false
  confidence.
- After Step 2, `grep "process.env" packages/framer-motion/dist/framer-motion.js`
  still matches — something else emits an unreplaceable env check; find it
  via Step 1's grep before patching further, and report if it's in generated
  code rather than `src/`.
- Any motion-utils test fails in a way unrelated to console.warn/throw
  expectations.

## Maintenance notes

- **Reviewers**: any future edit to `errors.ts`'s guard must keep the literal
  token `process.env.NODE_ENV` intact — the check-bundle assertion enforces
  this, but the *reason* should be in the review conversation, not just the
  CI failure.
- Known pre-existing limitation, unchanged by this plan: in the **dev** UMD
  bundle loaded in a plain browser `<script>` (no bundler, no `process`),
  warnings are off — true since `7a78368b3`, because the runtime `typeof
  process` guard fails there. If dev-UMD warnings should work, the dev
  rollup config would need to replace the entire guard expression (or define
  `process.env.NODE_ENV` in the dev build too). Deliberately not done here.
- Consumers on modern bundlers (webpack ≥ 5.38, Vite, esbuild) already handle
  optional chaining in define/replace; the populations that benefit are this
  repo's own UMD/size artifacts and older-toolchain consumers.
