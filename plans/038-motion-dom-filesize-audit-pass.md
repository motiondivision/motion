# Plan 038: `[audit]` filesize pass over the heaviest non-contended motion-dom modules

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/animation packages/motion-dom/src/render/utils packages/motion-dom/src/value`
> Drift here is EXPECTED (this is active code) — it doesn't block the plan,
> but re-measure the baseline (Step 1) rather than trusting this plan's byte
> table, and re-check the exclusion list against `plans/README.md` statuses.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (behavior-preserving constraint across the animation engine)
- **Depends on**: 035 (soft — gives the budget ratchet); coordinate against 030–033 (own `generators/spring.ts`), 019–021 (move drag/pan), branch `cleanup/strip-unused-stats` (owns stats)
- **Category**: perf (bundle size)
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

The `<motion.div>` bundle grew +3.8 kB gz between Oct 2025 and now
(npm-tarball bisection: +1.1 kB in v12.24.0 — `{type:"svg"}` + CSS logical
properties; +0.5 kB in v12.25.0 — Reorder auto-scroll; +0.6 kB across
v12.32–33 — resize observers entering the drag graph; +0.6 kB in v12.36.0 —
spring consolidation + axis-locked layout). Those were features, but no
offsetting reductions ever landed, and the heaviest modules have never had a
dedicated **size** pass (prior `[audit]` commits — `53b90b239`, `c8dcf8a70`,
`616a88767` — targeted allocations and dead code, with size as a
side-effect). CLAUDE.md's first code-style rule is "prioritise small file
size". This plan is a measured, module-by-module byte audit in the
established `[audit]` commit style, scoped to modules **no in-flight work
contends for**. Realistic yield based on past passes: 0.3–0.8 kB gz off the
main bundle; the floor is a documented "nothing left here" verdict, which has
value too.

## Current state

Per-module minified bytes inside `dist/size-rollup-motion.js` at `42bfbe3ed`
(source-map attribution — methodology in Step 1):

**Audit targets (in this order — biggest first):**

| Module (motion-dom/src/…) | min B | Notes |
|---|---|---|
| `animation/JSAnimation.ts` | 4512 | core engine; prior `[audit]` 53b90b239 was allocations, not bytes |
| `animation/keyframes/KeyframesResolver.ts` + `DOMKeyframesResolver.ts` | 3117 | two-class resolver pipeline; look for duplicated flow |
| `render/utils/animation-state.ts` | 2697 | variant resolution state machine |
| `value/index.ts` (MotionValue) | 2474 | |
| `animation/NativeAnimation.ts` + `NativeAnimationExtended.ts` + `AsyncMotionValueAnimation.ts` | 2755 + 2152 | WAAPI wrappers; check overlap with JSAnimation option plumbing |
| `animation/interfaces/visual-element-target.ts` + `-variant.ts` + `motion-value.ts` + `visual-element.ts` | ~3020 | orchestration layer; repeated option-merging patterns |
| `value/types/complex/index.ts` + `utils/mix/complex.ts` | 2428 | parser + mixer share value-walking logic |
| `render/dom/parse-transform.ts` | 1151 | |
| `animation/generators/spring.ts` `toString()` | ~300 | ONLY the investigation below — the file is otherwise owned by plans 030–033 |

**Spring `toString` investigation (bounded):** `spring.ts:427-433` attaches a
`toString()` (pulling `generateLinearEasing` + `calcGeneratorDuration`) to
every spring generator for CSS serialization. Determine whether anything in
the `motion.div` graph calls it (check `NativeAnimationExtended` and the
pregenerate/WAAPI path). If nothing does, propose (do not implement here if
plans 030–033 are IN PROGRESS — coordinate via the index) moving it to a
wrapper used only by the public CSS-spring entry. If the WAAPI spring path
needs it, write one line in the report saying so and drop the idea.

**Excluded, with reasons (do NOT edit these even though they're the biggest):**

- `projection/node/create-projection-node.ts` — 22,938 B min, 18.6% of the
  whole bundle, the single biggest target. Excluded because PR #3748 and the
  effects/VisualElement unification (`worktree-style-effect`) are actively
  reshaping it, and `plans/README.md` already records the decomposition
  deferral. **Your deliverable for this file is measurement + a findings
  list in the report, not edits.**
- `render/VisualElement.ts` (7,036 B) — same unification owns it.
- `framer-motion/src/gestures/drag/*`, `pan/*` (VisualElementDragControls
  7,456 B; PanSession 3,829 B, +68% since v12.24) — plans 019–021 move these
  files to motion-dom; auditing them pre-move is guaranteed merge conflict.
  Note in the report that a post-019 size pass is the follow-up.
- `stats/*` — branch `cleanup/strip-unused-stats` owns it.
- `animation/generators/spring.ts` beyond the bounded `toString`
  investigation above — plans 030–033 own that file (033 alone projects
  ~−1 kB min).

## Commands you will need

| Purpose | Command (from repo root) | Expected on success |
|---|---|---|
| Build | `yarn build` | exit 0 |
| Size bundles | `yarn measure` (needs prior build) | table prints; exit 0 if 035 landed |
| motion-dom tests | `cd packages/motion-dom && yarn test` | all pass |
| framer-motion tests | `cd packages/framer-motion && yarn test` | all pass (see CLAUDE.md for known pre-existing failures) |
| Full E2E (final gate) | `make test-e2e` | all pass |
| Lint | `cd packages/framer-motion && yarn lint` | exit 0 |

## Suggested executor toolkit

Per-module byte attribution script — save as `/tmp/sizemap.mjs` (do NOT
commit it), run with
`node /tmp/sizemap.mjs packages/framer-motion/dist/size-rollup-motion.js`:

```js
import { SourceMapConsumer } from "/PATH/TO/REPO/node_modules/source-map/source-map.js"
import fs from "fs"
import zlib from "zlib"
const file = process.argv[2]
const code = fs.readFileSync(file, "utf8")
const map = JSON.parse(fs.readFileSync(file + ".map", "utf8"))
const lines = code.split("\n")
const consumer = await new SourceMapConsumer(map)
const bytes = {}
const mappings = []
consumer.eachMapping((m) => mappings.push(m), null, SourceMapConsumer.GENERATED_ORDER)
for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i], next = mappings[i + 1]
    const end = next && next.generatedLine === m.generatedLine
        ? next.generatedColumn
        : lines[m.generatedLine - 1].length + 1
    const src = (m.source || "(unmapped)").replace(/^.*?packages\//, "")
    bytes[src] = (bytes[src] || 0) + (end - m.generatedColumn)
}
console.log("gzip:", zlib.gzipSync(code).length)
Object.entries(bytes).sort((a, b) => b[1] - a[1]).slice(0, 80)
    .forEach(([s, b]) => console.log(String(b).padStart(8), s))
```

Reduction techniques that worked in prior `[audit]` commits (read their
diffs first: `git show 616a88767`, `git show e530cc6cd`, `git show 53b90b239`):

1. `/*@__NO_SIDE_EFFECTS__*/` annotations on factory functions so terser and
   consumer bundlers can drop unused call results.
2. Deduplicate near-identical code paths (parser/mixer pairs, option-merging
   in the interfaces layer).
3. Replace verbose patterns with the repo's preferred small idioms (optional
   chaining over `if` chains — see CLAUDE.md Code Style).
4. Delete dead exports — but verify "dead" against ALL size bundles and the
   public API (`motion-dom/src/index.ts` exports are public; `framer-motion`
   re-exports them via `src/dom.ts`), not just the motion bundle.
5. Shorten internal-only strings; never alter user-facing error codes or
   public string constants.

## Scope

**In scope** (modify only):
- The target-table files under `packages/motion-dom/src/`
- Their `__tests__` neighbours (extend only — never weaken an assertion)
- `packages/framer-motion/package.json` / `packages/motion-dom/package.json`
  bundlesize values (final ratchet, only if 035 landed)

**Out of scope**: everything in the exclusion list above; any public API
shape; any behavior (this is byte golf, not refactoring — if a change needs
a test *changed* rather than *added*, it changed behavior: revert it).

## Git workflow

- Branch: `advisor/038-filesize-audit`
- **One commit per module/cluster**, message format matching the existing
  convention: `[audit] motion-dom/<area>: <what>` (e.g.
  `[audit] motion-dom/animation: deduplicate keyframes resolver flow`).
  Include the measured delta in the commit body: `size-rollup-motion.js: -412 B min / -147 B gz`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Baseline

`yarn build && yarn measure`, then run the attribution script on
`size-rollup-motion.js`, `size-rollup-m.js`, and `size-rollup-animate.js`.
Record gz totals and the per-module table in a scratch file.

**Verify**: your attribution table for the targets is within ~10% of this
plan's byte table (drift beyond that → re-read `plans/README.md` for what
landed, adjust targets, continue).

### Step 2: Per-module loop (repeat for each target, biggest first)

1. Read the module and its attribution-heavy neighbours.
2. Apply reductions from the toolkit. Keep each edit behavior-preserving.
3. `yarn build && yarn measure` + attribution → measure the delta.
4. `cd packages/motion-dom && yarn test` and
   `cd packages/framer-motion && yarn test` → all pass.
5. Delta ≥ 50 B min and tests green → commit with the measured delta.
   Delta < 50 B min or any behavioral doubt → `git checkout -- .` and record
   "no win" for the module in the report. **Do not keep churn that doesn't
   pay.**

### Step 3: Measurement-only findings for the excluded heavyweights

Run the attribution script's view of `create-projection-node.mjs` and write
up (report only, no edits): the largest internal contributors, anything that
looks like dead weight, and what a post-unification pass should target.
Same, briefly, for the drag/pan follow-up after plan 019.

### Step 4: Final gates

`make test-e2e` → all pass. `cd packages/framer-motion && yarn lint` → exit 0.
If plan 035 landed: ratchet improved budgets (actual × 1.01, round up to
0.05) and `node dev/inc/bundlesize.mjs` → exit 0.

### Step 5: Report

Append a short summary to the PR description / report: per-module deltas
(including "no win" entries), total gz saved on motion/m/animate bundles, the
Step 3 findings, and the spring-`toString` verdict.

## Test plan

No new feature tests — the suites are the behavior gate. Add a test ONLY
when a reduction exploits an invariant the suite doesn't pin (e.g. you
dedupe two code paths on the assumption they receive the same input shape —
pin that with a test before relying on it). Every commit must leave
`yarn test` (both packages) green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Every commit message matches `[audit] motion-dom/...` and contains a measured delta
- [ ] `yarn build` exits 0; motion-dom + framer-motion jest suites pass; `make test-e2e` passes
- [ ] Net change on `size-rollup-motion.js` is ≤ 0 bytes gz (no regression smuggled in)
- [ ] Report exists with per-module deltas + Step 3 findings + spring-toString verdict
- [ ] No exclusion-list file modified (`git diff --stat` vs the exclusion list)
- [ ] If 035 landed: `node dev/inc/bundlesize.mjs` exits 0 with ratcheted budgets
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- After auditing the first three targets the cumulative win is < 150 B min —
  the well is dry; write the report (including Step 3) and stop rather than
  forcing churn through the remaining modules.
- A reduction makes ANY test fail and the fix isn't reverting the reduction.
- You find a tree-shake leak (module in a bundle that shouldn't contain it —
  the `m` bundle is the canary) rather than verbose code: that's a separate
  targeted fix like plan 037; report it as a new finding instead of folding
  a graph change into byte-golf commits.
- `plans/README.md` shows 030–033 or 019–021 IN PROGRESS on a file you're
  about to touch.

## Maintenance notes

- The deliberate exclusions are the real backlog: `create-projection-node`
  (after effects/VE unification) and drag/pan (after plan 019) are ~33 KB min
  combined — re-run this plan's method on them when the contention clears.
- `NO_SIDE_EFFECTS` annotations are load-bearing for consumer tree-shaking;
  reviewers should treat their removal like an API change.
- Reviewer focus: behavior preservation in `animation-state.ts` and the
  interfaces layer — those encode subtle variant-resolution ordering that
  the jest suite covers unevenly.
