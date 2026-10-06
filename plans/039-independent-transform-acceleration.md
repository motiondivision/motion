# 039: Independent transform acceleration (prototype notes)

Prototype for PERFORMANCE_AUDIT.md item 1: "Transform shorthands (`x`/`scale`/`rotate`) run on the JS main thread, not the compositor".

## How it works

Independent transforms on an HTML element (`x`, `y`, `scale`, `rotate`, `skew` etc) all write one `transform` style. So each element gets one **transform group** (`waapi/transforms/TransformAnimation.ts`):

- Every transform animation on the element is a `TransformAnimation`, a `JSAnimation` whose frameloop driver stays off while the group is accelerated.
- The group samples every track (and the static transform values that aren't animating) every 10 ms, at most 400 samples, into **one** `transform` WAAPI animation with `linear` easing. Per-value easing, springs, keyframes, `times`, `repeatDelay` and `mirror` are therefore all exact to within one sample.
- A track that repeats forever is a second, looping WAAPI animation that starts when the finite part ends. All infinite tracks must share one cycle length.
- The group rebuilds on start, stop, pause, play, seek and speed changes. Rebuilds happen in this frame's render step (or a microtask outside the frame loop), so DOM reads in `postRender` see the new animation.
- Completion is a `setTimeout` at each track's end time. Then the final transform is written as an inline style and the WAAPI animation is cancelled.
- `stop()`, `pause()` and an interrupting animation read the value back by sampling the track at the current time, and pass the velocity across with `setWithVelocity`. So a spring that interrupts keeps its momentum.

### Moving to the main thread ("demotion")

The group hands **every** track back to its JS driver, with current values and velocity, when:

| Trigger | Why |
| --- | --- |
| A new animation that can't be accelerated: `onUpdate` prop, `transformTemplate`, `type: "inertia"`, `style.transform`, path rotation, a projecting element, optimised appear handoff, `attachTimeline` (scroll) | Needs a value each frame, or a transform we can't compose |
| Something outside the group writes a transform value twice within 100 ms (a user motion value, drag, `set()`) | One write rebuilds, a stream of writes would rebuild every frame |
| Seeking (`time =`) twice within 100 ms | Same: scrubbing is cheaper on JS |
| Projection `willUpdate()` on the element or an ancestor, or `resetTransform` | Layout must measure the real, current transform. Projection then owns `transform` for the layout animation |
| Negative `speed`, or infinite tracks with different cycle lengths | Not modelled by the sampler |
| `element.animate()` throws | Defensive |

When every remaining track can be accelerated again (e.g. the inertia finished), the group goes back to WAAPI. SVG elements stay on JS.

## What stays on the main thread

These animations stay on JS, because each needs a value every frame or a transform the group can't compose: `onUpdate`, `transformTemplate`, inertia, scroll-linked animations, layout animations (projection owns `transform`), SVG transforms, and values written every frame from outside (drag, `useMotionValue` streams).

These stay accelerated, because tracks are sampled and the group rebuilds:

- Several animations on one element, including interruption, with spring velocity carried over.
- Keyframes, `times`, `repeatDelay` and `repeatType` mirror/reverse.
- `repeat: Infinity`, which loops on the compositor.
- One seek or speed change, which rebuilds once. Only repeated seeking or negative speed falls back.

## Known gaps

- `motionValue.get()` returns the start value while the group is accelerated, as with today's accelerated opacity. Animation `time` is correct.
- Optimised appear handoff stays on JS. A follow-up could adopt the appear animation into the group.
- Bundle cost is about +1.35 kB gz for `motion`/`m` and +1.42 kB for `animate`.
- Not tested in WebKit or Firefox. Cypress can't run in the cloud environment, so the React E2E tests are Playwright specs.

## Follow-ups

- Native easing (no sampling) when a single track uses a cubic-bezier.
- Hand optimised appear animations into the group, so hydration stays on the compositor.
- SVG `transform` attribute support.
- Benchmark: 500 elements animating `x` on a busy main thread, before and after.
