# Plan 012: Design spike — unify MotionValue derivation on a mark-dirty/pull-compute graph (doc only)

> **Executor instructions**: This plan produces a **design document, not code**.
> Follow the steps, read every listed file in full, and write the deliverable
> described in "Deliverable". You may write throwaway prototype code in a
> scratch worktree to answer the open questions empirically, but no changes to
> `packages/` may be part of the result. If anything in "STOP conditions"
> occurs, stop and report. When done, update the status row for this plan in
> `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 42bfbe3ed..HEAD -- packages/motion-dom/src/value/ packages/motion-dom/src/effects/ packages/motion-dom/src/frameloop/`
> If these changed since this plan was written, read the diffs first — the
> design must target the code as it is, not as excerpted here. Also run
> `git branch -a | grep style-effect` and check whether the effects/VisualElement
> unification branch (`worktree-style-effect`) has merged to `main`; if it has,
> the design substrate is that code, and the "Current state" section below
> understates how much already runs through `MotionValueState`.

## Status

- **Priority**: P2
- **Effort**: M (the spike; the eventual implementation is L and is NOT this plan)
- **Risk**: LOW (doc only)
- **Depends on**: none hard. Soft: coordinate with the effects/VisualElement unification direction (`worktree-style-effect` branch); the design doc must state which substrate it assumes.
- **Category**: tech-debt / perf / direction
- **Planned at**: commit `42bfbe3ed`, 2026-06-11

## Why this matters

`MotionValue` has **two parallel derivation channels** that want to be one:

1. **Eager push** — `subscribeValue` subscribes to inputs' `change` events and re-runs the transformer on a frame-batched callback, pushing the result through the full `MotionValue.set()` machinery (velocity bookkeeping, prev-frame tracking, change notification). Derived values recompute on every input change **whether or not anything observes their output**.
2. **A half-built signal graph** — `MotionValue.dependents` + `dirty()`, whose own comment calls it "a rough start to a proper signal-like dirtying system". `dirty()` notifies a dependent's `change` subscribers with its **stale** current value, without recomputing. It works today only because its sole consumers (placeholder values in `MotionValueState`) treat the notification as "schedule a re-render" and never read the dependent's value. The moment someone wires `addDependent` to a real computed value, stale values flow silently downstream.

This spike designs the unification: derived values become nodes in a mark-dirty graph that compute lazily (on `get()` or at the frame boundary), while sources keep their public synchronous push semantics. The wins: unobserved computeds cost zero, intermediate nodes skip `set()` bookkeeping they don't need, the `dirty()` footgun disappears before the effects migration spreads `addDependent` further, and `subscribeValue`/`useCombineMotionValues` collapse into one mechanism. The constraint that disqualifies an off-the-shelf signal runtime: this library ships to end users and **bundle size is a hard priority** (see `CLAUDE.md` "Prioritise small file size") — the design space is "minimal dirty-flag + frame-boundary flush", not "port Reactively".

## Current state

Read all of these in full before designing — the doc must cite them:

**The value graph:**

- `packages/motion-dom/src/value/index.ts` — `MotionValue`. Key regions:
  - `:148-151` — `dependents?: Set<MotionValue>`, the "rough start" comment.
  - `:332-334` — `dirty()`: `this.events.change?.notify(this.current)` — notify-without-recompute, the stale-value footgun.
  - `:349-375` — `updateAndNotify`: timestamp + prev-frame bookkeeping on every set; equality cutoff (`current !== prev`); sync change notify; then `dependent.dirty()` loop.
  - `:384-390` — `get()` + `collectMotionValues` dependency-collection hook.
  - `:247-274` — `on("change")` and the unsubscribe-time `frame.read` auto-stop check.
  - `:406-428` — `getVelocity()`: depends on `updatedAt`/`prevUpdatedAt`/`prevFrameValue` maintained by `updateAndNotify`. Any laziness must not corrupt these.
- `packages/motion-dom/src/value/subscribe-value.ts` — the eager-push derivation channel (18 lines): inputs' `change` → `frame.preRender(update, false, true)` → `outputValue.set(getLatest())`.
- `packages/motion-dom/src/value/transform-value.ts` — creation-time static dependency collection via `collectMotionValues`; transformer contract "pure with no side-effects or conditional statements".
- `packages/motion-dom/src/value/map-value.ts`, `follow-value.ts`, `spring-value.ts` — other derived-value factories. Note `followValue` is *not* a pure computed (it runs an animation between values) — it stays on the push/passive-effect path; the design must say so explicitly.

**The consumers:**

- `packages/motion-dom/src/effects/MotionValueState.ts` — `:28-44`: per-key `change` subscription updates `latest[name]` and schedules a per-key render; `computed && value.addDependent(computed)` is the only current `addDependent` caller. The "computed" here is a notification proxy (e.g. the `transform` MotionValue created in `effects/style/index.ts:34-36` stays `"none"` forever; the real transform string is built at render time by `buildTransform(state)` — i.e. the effects render path is **already pull-at-render**).
- `packages/motion-dom/src/effects/style/index.ts` and `effects/style/transform.ts` — how transform/origin placeholder nodes and render callbacks compose.
- `packages/motion-dom/src/render/VisualElement.ts:538-608` (`bindToMotionValue`) and `:670-688` (`scheduleRender`/`render`) — the legacy per-element render path; relies on **synchronous** `change` notification to keep `latestValues` fresh and on the WAAPI `accelerate` bypass (`:543-567`).
- `packages/framer-motion/src/value/use-combine-values.ts`, `use-computed.ts`, `use-transform.ts` — the React adapter layer (see plan 011, which fixes its per-render churn independently of this spike).
- `packages/framer-motion/src/value/use-velocity.ts` — polls `getVelocity()` via self-rescheduling `frame.update`; a consumer of the velocity bookkeeping invariant.

**The frame loop:**

- `packages/motion-dom/src/frameloop/render-step.ts` and `batcher.ts` — step ordering (`setup, read, resolveKeyframes, preUpdate, update, preRender, render, postRender`), `Set`-based dedup, `immediate` scheduling into the currently-processing step. Today's derived-value updates run in `preRender`; animations tick in `update`. This ordering is why derived values are glitch-free and compute at most once per frame already.

## Semantic invariants the design MUST preserve

These are public API or load-bearing internal contracts, enumerated here so the design doc addresses each one explicitly with a "how it's preserved" line:

1. **Sources push synchronously.** `mv.set(x)` fires `on("change")` listeners in the same tick. User code and `VisualElement.bindToMotionValue` rely on it.
2. **Derived values already notify at the frame boundary** (`preRender`), not synchronously — laziness does not change *observable timing* for deriveds, and the doc should state this precisely, because it's what makes the migration tractable.
3. **`get()` always returns the latest value.** A dirty computed must recompute synchronously on read, at any point in the frame (e.g. user code reading a `useTransform` output inside a `frame.update` callback after the input changed in the same frame).
4. **`getVelocity()` keeps working on deriveds.** Velocity derives from `updatedAt`/`prevUpdatedAt`/`prevFrameValue` written in `updateAndNotify`. If a lazy computed only "updates" when read, two reads in the same frame after an input change must not produce velocity 0/Infinity artifacts. Decide: do computeds keep full velocity bookkeeping (status quo cost), or is velocity computed on demand from input timestamps, or do lazy nodes update bookkeeping at flush time?
5. **Auto-stop on listener removal** (`value/index.ts:258-270`) must keep stopping orphaned animations.
6. **`accelerate` metadata propagation** (`use-transform.ts:220-238`, `VisualElement.bindToMotionValue:543-567`): scroll-timeline WAAPI animations bypass the JS graph entirely; the graph must stay out of their way.
7. **Static dependency collection** (no conditional reads) is the current contract; keep it (cheapest) or consciously lift it (re-track per run, costs bytes) — a decision, not a default.
8. **Equality cutoff at every node** (`updateAndNotify:366`) must survive: converged chains go quiet.
9. **`dirty()`'s existing consumer semantics**: `MotionValueState`'s placeholder nodes need "input changed → schedule my render callback this frame". Whatever replaces `dirty()` must serve that use without the stale-value hazard.
10. **Bundle size**: net delta target ≤ 0 after accounting for what the unification deletes (`subscribe-value.ts`, parts of `use-combine-values.ts` subscription management). State the measured delta in the doc.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build (if prototyping against dist) | `yarn build` from repo root | exit 0 |
| motion-dom unit tests | `npx jest --config packages/motion-dom/jest.config.json` | pass (used to sanity-check prototype claims) |
| framer-motion value tests | `npx jest --config packages/framer-motion/jest.config.json --testPathPattern="value/"` | pass except known pre-existing failures (SSR `TextEncoder`, `use-velocity`) |
| Recompute-count evidence | a scratch Jest test instrumenting a transformer counter | n/a — evidence for the doc |

## Scope

**In scope:**

- Producing `plans/design/012-derivation-graph.md` (create the `plans/design/` directory).
- Throwaway prototype code in a git worktree or scratch branch, used only to answer open questions; deleted or left unmerged.

**Out of scope (hard):**

- Any committed change under `packages/`.
- Implementing the design (a follow-up plan, written after maintainer review of the doc).
- Redesigning `followValue`/`springValue` (animation-driven, not pure computeds) beyond stating how they coexist.
- The WAAPI acceleration design (plan 004's territory).

## Git workflow

- The deliverable doc is committed to the working branch as a normal file under `plans/design/`.
- Prototype work: separate scratch worktree (`git worktree add ../motion-spike-012`), never merged.

## Steps

### Step 1: Verify the substrate

Run the drift check and the `worktree-style-effect` branch check from the header. Read `git log --oneline -20 main` and note any commits touching `packages/motion-dom/src/value/` or `effects/` since `42bfbe3ed`. Record in the doc which substrate the design targets: current `main`, or the effects-unified VisualElement if that branch has landed/is imminent.

**Verify**: the doc's "Substrate" section names a commit SHA and a yes/no on whether `worktree-style-effect` content is included.

### Step 2: Read and map the current graph

Read every file in "Current state". Produce the doc's first section: a diagram (text is fine) of today's two channels — eager-push (`subscribeValue`) and dirty-notify (`dependents`) — annotated with where computation, notification, and rendering happen for: (a) a `useTransform` chain feeding a style, (b) an effects-system transform key, (c) a `followValue` spring.

**Verify**: the map names the frame step (`update`/`preRender`/`render`) where each arrow executes.

### Step 3: Measure the waste being targeted

Write scratch Jest tests (motion-dom config) that count:

1. Transformer executions for a `transformValue` whose output has **zero subscribers** while its input animates for N frames (expected today: N executions; the design's target: 0 until first read).
2. The per-hop overhead of a 3-deep chain (`x → a → b → c`) per input change: executions of `updateAndNotify` machinery vs. pure transformer runs.

Record the numbers in the doc. These are the before-figures any future implementation PR cites.

**Verify**: the doc contains a table of measured counts with the test code inlined in an appendix.

### Step 4: Design the unified model

Answer, with chosen option and rationale, at minimum:

1. **Node model**: do computeds remain `MotionValue` instances with a `compute` slot (smallest API churn, keeps `isMotionValue` checks working) or become a subclass? (Note `MotionValue` is a public class users `instanceof`-check and extend; prefer the slot.)
2. **Dirty propagation**: when a source sets, dependents get a dirty flag transitively. Does propagation mark eagerly through the whole downstream graph (simple, O(downstream) per set — but sets are equality-cut), or lazily per level? Where does the frame-boundary flush live (`preRender` keeps today's timing) and what schedules it?
3. **`get()` on a dirty node**: recompute synchronously, memoize, clear flag. How does this interact with `collectMotionValues` (which currently abuses `get()` for collection)?
4. **Change notification for computeds**: listeners on a computed must still fire once per frame with the fresh value when inputs changed. The flush recomputes dirty nodes **that have listeners or dependents-with-listeners** and notifies; truly unobserved nodes stay dirty and lazy. Define "observed" cheaply (listener count + dependents recursion, or an `observers` counter).
5. **`dirty()` API disposition**: rename/split so "schedule my render" (MotionValueState's need) and "your inputs changed" (graph-internal) are distinct; specify the deprecation path since `dirty` is on the public class (check whether it's in the published type surface and whether Framer uses it — note in doc).
6. **Velocity on computeds** (invariant 4): pick a strategy and show it preserves `useVelocity(useTransform(...))` behavior.
7. **What gets deleted**: `subscribe-value.ts` folds into the graph; `useCombineMotionValues` (post-plan-011) becomes a thin "create computed once, swap transformer ref" adapter. Show before/after responsibilities.
8. **Bundle delta**: estimate by prototyping the core (dirty flag + flush + lazy get) and running it through the repo's build; report minified size of touched bundles vs `main`.
9. **Migration order**: which call sites move first, what stays compatible during the transition, and how this sequences against the effects/VisualElement unification (the doc must give a concrete recommendation: before it lands / after / as part of it).

### Step 5: Go/no-go recommendation

End the doc with a recommendation: implement (with a sketch of the follow-up plan's steps), implement-partially (e.g. only fix the `dirty()` footgun + lazy unobserved computeds), or don't (if Step 3's measurements show the win doesn't justify the bytes/risk — that is an acceptable conclusion and should be stated plainly if true).

**Verify**: `plans/design/012-derivation-graph.md` exists, addresses all 10 invariants by number, answers all 9 design questions, includes the Step 3 measurements, and ends with an explicit recommendation.

## Test plan

Doc-only plan — no shipped tests. The scratch measurement tests from Step 3 are inlined in the doc's appendix so the implementation plan can resurrect them as regression gates.

## Done criteria

- [ ] `plans/design/012-derivation-graph.md` exists and contains: substrate statement (Step 1), graph map (Step 2), measured before-figures (Step 3), all invariants addressed by number, all design questions answered, bundle-delta estimate, migration order, go/no-go recommendation.
- [ ] `git status` shows no modifications under `packages/` (scratch worktree excluded).
- [ ] `plans/README.md` status row for 012 updated.

## STOP conditions

Stop and report back (do not improvise) if:

- The `worktree-style-effect` branch has merged AND reshaped `MotionValueState`/`VisualElement` beyond what 30 minutes of diff-reading can absorb — report what changed and ask whether the spike should target the new code.
- You find a third derivation channel not described here (search `addDependent|subscribeValue|attach\(` across `packages/` first; if something else drives derived values, the inventory above is incomplete and the design would be built on a wrong map).
- Step 3 measurement shows derived values do NOT recompute when unobserved (i.e. the premise is wrong) — re-verify against `subscribe-value.ts` and report.
- Answering a design question requires committing to a public API break (e.g. removing `dirty()` outright) — flag it as an open question for the maintainer instead of deciding.

## Maintenance notes

- This doc is an input to the effects/VisualElement unification work — whoever owns `worktree-style-effect` should review it before the implementation plan is written.
- Plan 011 (React adapter churn) is independent and should land regardless; its `useConstant`-based subscription state is what this design's adapter layer would replace.
- If the recommendation is "implement", the follow-up implementation plan must include the Step 3 counter tests as regression gates and a published-bundle size check in its done criteria.
