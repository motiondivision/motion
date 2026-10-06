# 039: Independent transform acceleration (prototype notes)

Prototype for PERFORMANCE_AUDIT.md item 1: "Transform shorthands (`x`/`scale`/`rotate`) run on the JS main thread, not the compositor".

## How it works

Independent transforms on an HTML element (`x`, `y`, `scale`, `rotate`, `skew` etc) all write one `transform` style. So each element gets one **transform group** (`waapi/transforms/TransformAnimation.ts`):

-   Every transform animation on the element is a `TransformAnimation`, a `JSAnimation` whose frameloop driver stays off while the group is accelerated.
-   The group composes every track, and the static transform values that aren't animating, into **one** `transform` WAAPI animation:
    -   When every moving track follows the same eased progress (values that share a transition, including springs), it has **two keyframes** and that progress as a `linear()` easing (or `linear`). This is checked by sampling each track, not by comparing options, so it also covers a value still in its delay.
    -   Otherwise it has adaptive sampled keyframes: one per 100 ms, split where a track curves, down to 6.25 ms. Per-value easing, springs, keyframes, `times`, `repeatDelay` and `mirror` stay within 0.1 px, 0.1 deg or 0.001 scale.
-   A track that repeats forever is a second, looping WAAPI animation, built from a cycle boundary and started part way through with `iterationStart`, so it repeats seamlessly. All infinite tracks must share one cycle and phase.
-   The group only rebuilds when a track starts, stops or is interrupted, or something outside writes a transform. `pause()`, `play()`, `time =` and `speed =` that apply to every track are made to the WAAPI animation itself (`pause()`, `currentTime`, `startTime`, `playbackRate`). Builds happen in this frame's render step (or a microtask outside the frame loop), so DOM reads in `postRender` see them.
-   Tracks complete on WAAPI `finish` events: the main animation's, plus an empty `element.animate(null, …)` for each track that ends sooner. No timers or polling. Then the final transform is written as an inline style and the WAAPI animation is cancelled.
-   `stop()`, `pause()` and an interrupting animation read the value back by sampling the track at the current time, and pass the velocity across with `setWithVelocity`. So a spring that interrupts keeps its momentum.

Why few keyframes: in Chromium, 300 elements each animating `transform` with 400 keyframes took 399 ms to start and 65% of main-thread time while running. With 2 keyframes and `linear()` easing, 18 ms and 16%. Both ran on the compositor. (Chromium issue 41491098 reports the same.)

### Moving to the main thread ("demotion")

The group hands **every** track back to its JS driver, with current values and velocity, when:

| Trigger                                                                                                                                                                                                         | Why                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A new animation that can't be accelerated: `onUpdate` prop, `transformTemplate`, `type: "inertia"`, `style.transform`, path rotation, a projecting element, optimised appear handoff, `attachTimeline` (scroll) | Needs a value each frame, or a transform we can't compose                                                  |
| Something outside the group writes a transform value twice within 100 ms (a user motion value, drag, `set()`)                                                                                                   | One write rebuilds, a stream of writes would rebuild every frame                                           |
| Seeking (`time =`) outside the built WAAPI animation twice within 100 ms                                                                                                                                        | Same: scrubbing is cheaper on JS. Seeks inside it are free                                                 |
| Projection `willUpdate()` on the element or an ancestor, or `resetTransform`                                                                                                                                    | Layout must measure the real, current transform. Projection then owns `transform` for the layout animation |
| Negative `speed`, or infinite tracks with different cycle lengths                                                                                                                                               | Not modelled by the sampler                                                                                |
| `element.animate()` throws                                                                                                                                                                                      | Defensive                                                                                                  |

When the group moved because one animation couldn't be accelerated, the other tracks go back to WAAPI once it ends (e.g. the inertia finished). After the other triggers, tracks stay on JS until they end. SVG elements stay on JS.

Every hand-off writes the current transform as an inline style in the same frame, and the JS drivers carry on from the same time, so there's no jump or stalled frame. `tests/animate/independent-transforms-handoff.spec.ts` and `tests/react/independent-transforms-handoff.spec.ts` record every frame across each hand-off (inertia joining and leaving, outside writes, missed seeks, mid-spring, projection renders and layout animations) and check every frame's movement. They pass 8 times in a row with 4 parallel workers, and fail when the value sync on hand-off is removed.

## What stays on the main thread

These animations stay on JS, because each needs a value every frame or a transform the group can't compose: `onUpdate`, `transformTemplate`, inertia, scroll-linked animations, layout animations (projection owns `transform`), SVG transforms, and values written every frame from outside (drag, `useMotionValue` streams).

These stay accelerated, because tracks are sampled and the group rebuilds:

-   Several animations on one element, including interruption, with spring velocity carried over.
-   Keyframes, `times`, `repeatDelay` and `repeatType` mirror/reverse.
-   `repeat: Infinity`, which loops on the compositor.
-   `pause()`, `play()`, seeking and speed changes, on the WAAPI animation. Only repeated seeks outside it, or negative speed, fall back.

## Known gaps

-   `motionValue.get()` returns the start value while the group is accelerated, as with today's accelerated opacity. Animation `time` is correct.
-   Optimised appear handoff stays on JS. A follow-up could adopt the appear animation into the group.
-   Bundle cost is about +2.1 kB gz for `motion`/`m` bundles and +2.3 kB for `animate`.
-   A transition's own `onUpdate` (`animate(el, { x: 100 }, { onUpdate })`) isn't called while accelerated, as with accelerated opacity today. The `onUpdate` prop is handled.
-   Not tested in WebKit or Firefox. Cypress can't run in the cloud environment, so the React E2E tests are Playwright specs.

## Follow-ups

-   Native `cubic-bezier()` easing instead of `linear()` for named eases.
-   Reduce the bundle cost.
-   Hand optimised appear animations into the group, so hydration stays on the compositor.
-   SVG `transform` attribute support.
-   Benchmark: 500 elements animating `x` on a busy main thread, before and after.
