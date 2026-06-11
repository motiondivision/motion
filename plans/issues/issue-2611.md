# Plan issue-2611: Make `rotateZ` work during/after shared layout animations

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the row for this issue in `plans/issues/README.md`.
>
> **Drift check (run first)**:
> `gh api repos/motiondivision/motion/issues/2611 --jq .state` → must be `open`.
> `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/projection/styles/transform.ts packages/motion-dom/src/projection/utils/has-transform.ts packages/motion-dom/src/projection/animation/mix-values.ts`
> If any of these changed, re-read them and compare against the "Current state"
> excerpts; on a mismatch treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `42bfbe3ed`, 2026-06-11
- **Issue**: https://github.com/motiondivision/motion/issues/2611

## Why this matters

Reporter: an element with `style={{ rotateZ: 45 }}` and a `layoutId` loses its
rotation when a shared layout animation runs; the same code with `rotate`
instead of `rotateZ` works (confirmed by the reporter in the issue comments).
`rotate` and `rotateZ` are aliases in CSS, and the normal (non-projection)
render path supports both — commit `768877517` (2022) added `rotateZ` to
`packages/framer-motion/src/render/html/utils/transform.ts`. The projection
engine was never given the same treatment, so any projection-driven render
silently drops `rotateZ`.

## Current state

Three projection-side sites handle `rotate`/`rotateX`/`rotateY` but omit
`rotateZ`:

1. `packages/motion-dom/src/projection/styles/transform.ts:32-51` —
   `buildProjectionTransform()` builds the transform string applied while a
   projection node is active. It destructures and emits:
   ```ts
   const { transformPerspective, rotate, pathRotation, rotateX, rotateY, skewX, skewY } = latestTransform
   ...
   if (rotate) transform += `rotate(${rotate}deg) `
   // Additive `rotate()` so user `rotate` isn't clobbered.
   if (pathRotation) transform += `rotate(${pathRotation}deg) `
   if (rotateX) transform += `rotateX(${rotateX}deg) `
   if (rotateY) transform += `rotateY(${rotateY}deg) `
   ```
   `rotateZ` is never read → dropped from the projected transform. **This is
   the primary bug.**

2. `packages/motion-dom/src/projection/utils/has-transform.ts:16-27` —
   `hasTransform()` checks `values.rotate || values.rotateX || values.rotateY`
   (plus skews/scale/translate) but not `values.rotateZ`. A node whose only
   transform is `rotateZ` is treated as untransformed in box measurement
   correction (`applyTransform`, `removeTransform`).

3. `packages/motion-dom/src/projection/animation/mix-values.ts:92-96` —
   `mixValues()` crossfades `follow.rotate`/`lead.rotate` between shared
   stack members but not `rotateZ`.

Note the projection engine already knows about `rotateZ` elsewhere:
`resetSkewAndRotation()` in
`packages/motion-dom/src/projection/node/create-projection-node.ts:1934-1944`
checks `latestValues.rotateZ`, and `transformAxes = ["", "X", "Y", "Z"]`
(line 84) means rotateZ IS reset to 0 before measurement — and then never
re-applied by `buildProjectionTransform`. That is exactly the reported symptom
("rotateZ no longer works after the animation").

Reproduction sandbox
(https://codesandbox.io/p/sandbox/framer-motion-shared-layout-animation-with-rotatez-forked-j8ptt5)
was unreachable at planning time (CodeSandbox API blocked, HTTP 403). The
issue body + comments are sufficient: shared layout animation between two
elements where one has `rotateZ` in `style`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install (only if needed) | `yarn` (repo root, foreground) | exit 0 |
| Build all | `yarn build` (repo root) | exit 0 |
| Unit tests | `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="transform"` | all pass |
| Collect HTML fixtures | `node dev/inc/collect-html-tests.js` | regenerates `packages/framer-motion/cypress/fixtures/projection-tests.json` |
| HTML fixture server | `cd dev/html && yarn vite --port 8000` (port 8000 is hardcoded in the spec's `Cypress.config`) | serving |
| HTML projection suite | `cd packages/framer-motion && npx cypress run --config-file=cypress.html.json --spec cypress/integration-html/projection.ts` | all fixtures green |

## Scope

**In scope** (the only files you should modify):
- `packages/motion-dom/src/projection/styles/transform.ts`
- `packages/motion-dom/src/projection/styles/__tests__/transform.test.ts`
- `packages/motion-dom/src/projection/utils/has-transform.ts`
- `packages/motion-dom/src/projection/animation/mix-values.ts`
- `dev/html/public/projection/shared-promote-new-mix-rotate-z.html` (create)

**Out of scope**:
- `packages/framer-motion/src/render/html/utils/transform.ts` — the plain
  render path already supports rotateZ.
- `resetSkewAndRotation` / `create-projection-node.ts` — already handles
  rotateZ; do not edit (in-flight PRs #3748/#3749 touch this file).
- Any rotate3d/arbitrary-axis support.

## Git workflow

- Branch: `fix/2611-rotatez-projection`
- Commit message style: short imperative, e.g. `Support rotateZ in projection transforms (#2611)`

## Steps

### Step 1: Failing unit test

In `packages/motion-dom/src/projection/styles/__tests__/transform.test.ts`,
add a test modeled on the existing `rotate` cases (see lines ~35-103 of that
file), e.g.:

```ts
expect(
    buildProjectionTransform(delta, { x: 1, y: 1 }, { rotateZ: 10 })
).toEqual("translate3d(100px, 100px, 0px) rotateZ(10deg) scale(2, 4)")
```
(Reuse the same `delta` the neighbouring `rotate` test uses, and mirror its
exact expected translate/scale output, swapping in `rotateZ(10deg)` after the
treeScale segment in the same position `rotate(...)` occupies.)

**Verify**: `npx jest --config packages/motion-dom/jest.config.json --testPathPattern="transform"` → the new test FAILS (output lacks `rotateZ`). Existing tests pass.

### Step 2: Fix `buildProjectionTransform`

In `packages/motion-dom/src/projection/styles/transform.ts`, add `rotateZ` to
the destructure and emit it alongside the other rotates:

```ts
if (rotateZ) transform += `rotateZ(${rotateZ}deg) `
```
Place it after the `rotateY` line so ordering matches the non-projection
builder.

**Verify**: same jest command → all pass.

### Step 3: Fix `hasTransform` and `mixValues`

- `has-transform.ts`: add `values.rotateZ ||` next to `values.rotateY`.
- `mix-values.ts:92-96`: duplicate the `rotate` mixing block for `rotateZ`:
  ```ts
  if (follow.rotateZ || lead.rotateZ) {
      target.rotateZ = mixNumber(
          (follow.rotateZ as number) || 0,
          (lead.rotateZ as number) || 0,
          progress
      )
  }
  ```
  (Match the exact shape of the `rotate` block at line 92.)

**Verify**: `npx jest --config packages/motion-dom/jest.config.json` → no regressions.

### Step 4: HTML projection fixture (E2E regression gate)

Create `dev/html/public/projection/shared-promote-new-mix-rotate-z.html` as a
copy of `dev/html/public/projection/shared-promote-new-mix-rotate.html`,
replacing `newBoxProjection.setValue("rotate", 40)` with
`setValue("rotateZ", 40)` and the corresponding assertion (that fixture uses
`matchRotate` from `window.Assert` — read
`dev/html/src/imports/script-assert.js` first to confirm how `matchRotate`
reads rotation; if it only inspects the `rotate` latest value rather than
computed style, assert via computed style `transform` containing a rotation
matrix instead, still flipping `data-layout-correct` on failure like the other
fixtures do).

Then: `node dev/inc/collect-html-tests.js`, `yarn build`, start the dev/html
Vite server on port 8000, and run the HTML projection suite (commands table).

**Verify**: suite passes including the new fixture. As a sanity check, revert
Step 2 temporarily and confirm the new fixture fails, then re-apply.

## Test plan

- Unit: `buildProjectionTransform` emits `rotateZ(…deg)` (Step 1).
- Unit (optional, same file): `{ rotateZ: 0 }` emits no rotateZ segment.
- E2E: new HTML fixture proves rotateZ survives a shared-element promote
  (Step 4); must fail without the Step 2 fix.

## Done criteria

- [ ] `yarn build` exits 0
- [ ] motion-dom jest suite passes with new rotateZ test(s)
- [ ] HTML projection Cypress suite passes including `shared-promote-new-mix-rotate-z.html`
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/issues/README.md` row updated

## STOP conditions

- `buildProjectionTransform` signature or file location differs from the
  excerpt (PR #3748/#3749 may have landed and reshaped projection styles).
- The new fixture fails even WITH the fix — the bug then has a second cause
  in `create-projection-node.ts`; report findings rather than editing that
  file.
- HTML suite has unrelated red fixtures on a clean checkout (pre-existing
  flake/regression) — note them, don't chase them.

## Maintenance notes

- If rotate3d or arbitrary transforms are ever supported in projection, this
  per-key approach should be revisited.
- Reviewer should check transform ordering (rotate → pathRotation → rotateX →
  rotateY → rotateZ → skews) matches `render/html/utils/transform.ts`'s
  `transformPropOrder` semantics.
