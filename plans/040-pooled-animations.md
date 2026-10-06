# 040: Pooled animations (prototype notes)

Builds on 039 (independent transform acceleration). 039 gives each element one transform group that composes every transform track into one WAAPI animation. This prototype adds **pools**: the values of one `animate()` call, or one transition on one element, start, run and finish as one unit.

## Pools and channels

-   A **pool** (`animation/PoolAnimation.ts`) is one animation of one or more values. `animateValues` (vanilla `animate()`) and `animateTarget` (React transitions and variants) make one pool per element per call, and return it as the controls. `animateMotionValue` makes a pool of one.
-   Each value is a **track** in the pool. The value's `animation` is its track, so another animation can take one value without touching the rest of the pool. A track that's taken stops where it was, with its velocity, and the new animation starts from there.
-   A track runs on one **channel**, chosen once its keyframes resolve (`animation/utils/start-resolved-animation.ts`):
    -   A `NativeAnimationExtended` for values the browser animates on their own (`opacity`, `filter`, `clipPath`, colours).
    -   A source in its element's transform group (039) for independent transforms.
    -   A `JSAnimation` otherwise.
-   Every JS track in a pool ticks from one frame loop subscription (the pool driver). It cancels itself once no track needs it.
-   A pool finishes, and resolves its promise, once every track has finished or been taken. Pool controls (`pause`, `play`, `time`, `speed`, `stop`, `complete`, `cancel`, `attachTimeline`) act on every track. A transform group sees the same change on all its tracks, so it makes it to its WAAPI animation (`retime()`), without a rebuild.

## Start

-   Keyframes resolve in the same call when nothing has to be read from the DOM (`DOMKeyframesResolver.canReadNow()`): an origin is known (given, or from the motion value) and no keyframe is a CSS variable. Otherwise they wait for the frame loop as before. This removes the per-value `AsyncMotionValueAnimation` wrapper and its frame of latency for most animations.
-   Values that share one tween (two keyframes, same start, duration and a named or cubic-bezier easing) are one WAAPI `transform` animation with two keyframes and native easing (`ease-in-out`, `cubic-bezier(...)`), instead of sampled `linear()` progress.
-   The transform group only reads and composes the transforms that are present.
-   Renders of style values (`styleEffect`) read the value as last set (`MotionValue.getCurrent()`), because an accelerated animation already renders the value. `get()` reads the live value.

## Read back and hand-off

-   `MotionValue.get()` returns the live value while a track runs on the compositor (`liveValue()`): sampled from the track at the current time. This fixes 039's known gap, where `get()` returned the start value.
-   A track that's stopped, paused or taken writes its current value and velocity (`setWithVelocity`) before it stops. WAAPI tracks sample at wall-clock time, also while paused and at any speed.
-   WAAPI springs pass their velocity in the right unit (`createGeneratorEasing` scales it by `100 / (target - origin)`).

## Fixes found on the way

-   A transition's own `onUpdate` now keeps transforms on the main thread, so it's called every frame (039 listed this as a known gap).
-   `JSAnimation.play()` after a speed change while paused jumped ahead: it set `startTime` from `holdTime` without the speed. This also affects `main`.

## Tests

-   `tests/animate/pooled-animations.spec.ts` records every frame and checks no frame jumps or stalls when: one value of a pool is interrupted while the rest carry on, a transform is interrupted by a spring (velocity is kept), a pool is paused, seeked and sped up, opacity moves from WAAPI to the main thread, a pool's transforms move to the main thread while its opacity stays on WAAPI, a paused value is interrupted, a pool is stopped, and a pool finishes. Also: shared tweens have two keyframes and native easing, and a transition's `onUpdate` keeps transforms on JS.
-   `tests/react/pooled-animations.spec.ts` (React 18 and 19): `get()` on a compositor value matches the element, and drag takes over from where the compositor had the element.
-   039's hand-off specs, and all other Playwright, Jest and SSR suites, pass.

## Cost

See the PR for start-time benchmarks and bundle sizes. In short: warm start matches `main` while transforms run on the compositor, interrupt start is still slower than `main`, which runs transforms on JS. The pool adds about 1.1 kB gzip over 039.

## Follow-ups

-   One shared JS tween for the values of a pool that share a tween, instead of one `JSAnimation` per value.
-   Trim `PoolAnimation` and the transform group for bundle size.
-   Cut interrupt cost: a value taken from a WAAPI animation builds a JS sampler to read it back.
