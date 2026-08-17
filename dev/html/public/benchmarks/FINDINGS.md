# Renderer & Style Invalidation Findings

Results from the renderer investigation (Aug 2026): can a new write mechanism
avoid the "massive style recalculation" failure mode of per-frame
`element.style` writes, and what should Motion's renderer(s) be?

Benchmark pages (serve `dev/html` on port 8000):

- `style-recalc-harness.html` — which environments make style writes expensive,
  across write mechanisms (inline, CSS vars, registered vars, adopted
  stylesheet). Supports `&flush` for vsync-independent style-cost timing.
- `renderer-test-1.html` — granularity: 5 paint values on 300 boxes, then 1.
- `renderer-test-2.html` — the same 5 values in a hostile invalidation
  environment (`[style*=]` attribute selectors + descendant subtrees).
- `renderer-test-3.html` — transforms in the hostile environment:
  inline vs var vs stylesheet, with/without `will-change`.

Protocol everywhere: 4 runs per condition without reload, first run discarded
(JIT warmup), results averaged over runs 2–4.

## What triggers the recalculation bomb

Per-frame inline writes of **non-inherited standard properties are cheap by
default** — Blink/WebKit invalidation is precise. The bomb requires one of
these subscriptions (flush-timed style cost, 100 boxes × 50 descendants,
5 props/frame, embedded Chromium):

| Environment | Inline writes | Sheet writes | Bomb? |
| --- | --- | --- | --- |
| plain | 0.36 ms/frame | — | no |
| 50 descendants/box (non-inherited props) | 0.47 | 1.09 | no |
| `:has()` keyed on classes | 0.30 | — | no |
| 20k-rule stylesheet (complex selectors, no `[style]`) | 1.08 | 1.53 | no |
| `[style*="…"]` selectors (1k rules) | **28.5** | **1.04** | yes |
| inherited property (`color`) + descendants | **27.8 ms frame** | 16.67 (fast path) | yes |
| unregistered `--var` + descendants (even unreferenced) | ~4 ms/frame hidden | — | at scale |
| `@container style(--p)` subscriptions in descendants | **22–28 ms frame** | **same** | yes, unavoidable |

Notes:

- `[style*=]` selectors are rare in hand-written CSS (mostly adblock cosmetic
  filters) but the other triggers are mainstream: animating `color` on an
  element with children, animating CSS variables, `@container style()` queries.
- `CSS.registerProperty({ inherits: false })` suppresses the var-inheritance
  fan-out (~5.7× cheaper) but does **not** help with `[style*=]` (the
  attribute still mutates) or `@container style()` (subscription is on the
  value).
- `@container style()` bombs **every** write mechanism, including adopted
  stylesheets and (by construction) WAAPI — the subscription is to the
  computed value. Document as a user-facing footgun; no renderer fixes it.
- `transition: all` vs named transitions: the `all` keyword itself is ~free;
  the cost is transition retargeting for any rule covering a JS-animated
  property (~few ms/frame at 500 transitions). Amplifier, not a bomb.
- 16.67 ms readings are the vsync floor. Use `&flush` to measure real style
  cost when under budget.

## Renderer comparison

### Test 1 — benign page (300 boxes, 5 paint props)

Chrome & Safari: **all renderers identical** (paint-bound or vsync floor).
legacy ≈ styleEffect ≈ varEffect ≈ GSAP ≈ WAAPI in frame time.
Granularity shows only in render JS/frame (phase B, 1 of 5 values animating):
legacy 0.36–0.47 ms, styleEffect 0.06–0.10 ms (≈5×), varEffect 0.22–0.26 ms.

### Test 2 — hostile page

Real Chrome, 300 boxes × 80 descendants, 2k `[style*=]` rules:

| Renderer | fps | mean frame |
| --- | --- | --- |
| WAAPI (element.animate) | **30.6** | **33 ms** |
| CSS transition | 26.3 | 38 ms |
| sheet (adopted stylesheet) | 26.4 | 40 ms |
| GSAP (inline writes) | 4.0 | 250 ms |
| styleEffect | 3.9 | 259 ms |
| legacy (re-apply all) | 3.7 | 267 ms |
| varEffect (registered vars, inline) | 2.8 | 354 ms |

Real Safari, same scale:

| Renderer | fps | mean frame |
| --- | --- | --- |
| CSS transition | 3.9 | 256 ms |
| WAAPI | **3.9** | **259 ms** |
| GSAP | 2.9 | 351 ms |
| styleEffect | 2.7 | 393 ms |
| legacy | 2.6 | 398 ms |
| sheet | 2.4 | **411 ms — no escape in WebKit** |
| varEffect | 1.9 | 588 ms |

Key engine difference: Blink has a scoped fast path for CSSOM rule-declaration
mutation (sheet ≈ WAAPI); WebKit does not (sheet ≈ inline). WAAPI/transitions
are the only mechanisms that win or tie in **both** engines.

### Test 3 — transforms in hostile env (embedded Chromium, 300 boxes)

`will-change` is useless while recalc-bound (style/var ≈50 ms with or without).
Escape recalc first (sheet ~33 ms), then `will-change` removes paint →
locked 60 fps (16.67 ms). Order of operations matters: attribute-invalidation
→ paint → compositing.

## Renderer decision

1. **Default to WAAPI for everything keyframeable** — including
   non-accelerated paint properties. Only strategy that never loses in either
   engine. Zero main-thread render JS (0.000 in every run). Springs already
   pregenerate keyframes. Measure retargeting cost (computed-style read forces
   a flush) before shipping.
2. **styleEffect (inline writes) remains the frame-driven fallback**
   (gestures, scroll, useTransform). Inline is ~2× *cheaper* than sheet
   writes in benign environments (0.47 vs 1.09 ms flush) — the common case.
3. **No sheet renderer.** Its only value was capping the hostile case, and it
   only does so in Blink. Not worth cross-engine complexity, cascade weirdness
   (rule loses to inline styles), and DevTools opacity.
4. **varEffect (registered vars written inline) is dead.** Worst renderer in
   both engines: pays attribute invalidation + var indirection.
   `CSS.registerProperty({ inherits: false })` remains useful for
   Motion-internal generated variables only — never re-register user vars
   (changes inheritance semantics).

## GSAP comparison (defensible claims)

- Clean pages: parity (~27 ms both, Chrome; both 60 fps, Safari).
- Hostile CSS, Chrome: **7.5× faster frames** (33 vs 250 ms) — structural:
  GSAP must mutate the style attribute from its ticker every frame.
- Hostile CSS, Safari: 1.4× (259 vs 351 ms).
- Moderate hostile scale: 1.4–2×.
- Structural claims: zero main-thread animation JS; compositor animations
  survive main-thread jank (categorical, not a multiplier).
- Motion's write-path JS is ~0.3% of frame time under load in Chrome
  (0.72–0.79 ms of ~260 ms). Caveat: WebKit charges invalidation to the
  setter (~7 ms/frame at 1,500 values). Frame cost is browser style/paint
  work triggered by writes — the leverage is the write mechanism, not JS.

## Layout projection performance (Aug 2026 follow-up)

Profiled `dev/react?example=layout-stress-transform` (1,513 projection
nodes, 1,008 animating) with a V8 sampling profiler via Playwright/CDP
(`dev/react/profile-layout.mjs`) and an interleaved A/B harness that
alternates baseline/optimized builds per boot (`dev/react/ab-test.sh`).

### What the "projection JS" actually is

- Skipping only the `style.transform = ...` write dropped total sampled JS
  from ~200 ms to ~94 ms per 2 s window — **the CSSOM setter (browser
  string parse + style invalidation, charged to JS) is over half of all
  "projection JS"**. This is the floor; no JS restructuring touches it.
- **CSS Typed OM is slower**, not faster: retained
  `CSSTransformValue` + `attributeStyleMap.set` measured 291 ms vs 199 ms
  total (Blink's Typed OM set path does spec-mandated normalization).
- **Individual `translate`/`scale` properties are slower too** (two setter
  calls: 80.6 ms vs 56.4 ms self-time in `applyProjectionStyles`).
- **`matrix()` serialization is slower** (~85 vs ~62 ms self-time): it
  always carries six full-precision floats, while the composed
  `translate3d`/`scale` string omits identity segments and collapses to
  `"none"` near rest. Parse cost tracks string content, not function
  count. `DOMMatrix` has no other route into a style — `.toString()` is
  this same string plus allocation, and `CSSMatrixComponent` rides the
  Typed OM set path already measured slower.
- **Rounding transform values corrupts projection**: rounding
  translate/scale in `buildProjectionTransform` broke measure/unproject
  round-trips (measurements happen with the rounded transform in the DOM
  but are unprojected with exact values), leaving sub-pixel residuals that
  failed 22 Cypress layout tests. Reverted — don't retry.

### Shipped optimizations (all layout e2e + unit tests green, React 18+19)

1. **Memoized projection style writes**: `applyProjectionStyles` caches the
   last rendered transform/transformOrigin/opacity/visibility and skips
   redundant CSSOM writes.
2. **Projection-only renders**: per-frame projection renders no longer
   re-write the element's full style set; full renders only when values
   change. `renderStyles` skips transform/origin when projection owns them.
3. **Root render sweep**: nodes set a flag and the projection root
   schedules one frame callback that sweeps the tree, instead of ~1,000
   `frame.render` schedulings per frame (`schedule` self-time 19.6 ms → 0).
4. Hoisted `isDisplayContents` to `setOptions`, delta-reuse in
   `applyTransformsToTarget` when no user transforms, fused
   `mixBoxInto` (mix + equality + copy in one pass), keepAlive fast path in
   the frameloop, indexed loops in FlatTree/scale correctors.
5. On animation complete, a full render restores scale-corrected values
   (borderRadius etc.) — required by the sweep change.
6. **Cumulative path transforms**: each ancestor's projection delta is an
   axis-aligned affine map (p → a·p + b), so a node's full ancestor
   correction composes in closed form from its parent's cached transform
   (`updatePathTransform`, stamped per updateProjection sweep). Replaces
   the per-node walk over the whole ancestor path (`applyTreeDeltas`) —
   O(nodes × depth) → O(nodes). At depth 30 (1,201 nodes,
   `layout-stress-deep`): 31.1 ms → 9.2 ms for the path work, calc-side
   total ~37.5 → ~21 ms per 2 s. Break-even at shallow depth (~5), scales
   with depth. Shared transitions (layoutId/resumingFrom) keep the legacy
   walk: they interleave scroll offsets and ancestor `latestValues`
   transforms whose origins depend on the box being projected, so they
   don't compose into one per-layer map. Using `DOMMatrix` for this math
   instead of plain records was considered and rejected: identical idea,
   but every op crosses a C++ binding and `multiply()` allocates; the
   specialized {a, b, scale} record is the same matrix without the
   overhead (and the box {min,max} format itself was never the cost).

### Results (interleaved A/B, median of per-boot minimums)

- Whole-animation window: total sampled JS **−16%** (368 → 309 ms),
  projection-attributed **−14.5%** (217 → 186 ms). Mid-animation windows:
  −15–23% across three independent A/B rounds.
- Excluding the irreducible CSSOM write, the pure JS computation reduced
  ~25–30%. The original ≥50% target is not reachable by JS restructuring:
  ~60% of what profilers attribute to projection functions is the browser's
  style write cost, and both alternative write mechanisms measured slower.
- Remaining JS hotspots (per 2 s, optimized): `applyProjectionStyles`
  ~10 ms ex-write, `mixTargetDelta` 13 ms, `resolveTargetDelta` +
  `calcProjection` ~22 ms, `JSAnimation.tick` 10 ms. Halving further means
  fewer nodes doing per-frame math (e.g. WAAPI-driven pregenerated
  projection keyframes) — an architectural project, not an optimization.

### Layout measurement pitfalls

- Single-run profile comparisons swing ±40% with thermals; only the
  interleaved A/B (alternating builds per boot, min of repeated runs)
  produced stable deltas.
- Window placement matters: mid-animation windows exclude the ease tail
  where write-memoization wins; whole-animation windows include the
  unoptimized React didUpdate burst. Report which one you measured.

## Measurement pitfalls (repeat offenders)

- **Vsync floor**: 16.67 ms means "under budget", not "equal". Use the
  harness `&flush` metric or CDP `Performance.getMetrics`
  (RecalcStyleDuration deltas) to unclamp.
- **rAF throttling**: background/occluded tabs throttle rAF to ~1–2 fps.
  Force `Page.setWebLifecycleState { state: "active" }` via CDP, and verify
  tick rate before trusting a run.
- **Tween semantics**: `gsap.to()` from current values created zero-change
  tweens in alternating-phase benchmarks — use explicit endpoints
  (`fromTo`/keyframes) everywhere or fast runs are fake.
- **Embedded Chromium inflates paint cost** (software raster). Relative
  rankings held up in real browsers; absolute numbers did not.
- LoAF only reports frames ≥50 ms — useless for sub-budget costs.
