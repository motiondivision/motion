# Plan 003 — Step 1 notes

## linear() easing wiring (unblock condition 1)

**Confirmed wired into the WAAPI easing path.**

- `packages/motion-dom/src/animation/waapi/easing/map-easing.ts:14-16` — for function
  easings, `mapEasingToNativeEasing` returns `generateLinearEasing(easing, duration)`
  when `supportsLinearEasing()` is true.
- `packages/motion-dom/src/animation/generators/spring.ts:433` — springs also generate a
  `linear()` easing string for the WAAPI path.

The TODO's stated blocker ("until we implement support for linear() easing") is therefore
resolved. Function/spring easings on color values will serialize to `linear(...)` for WAAPI.

## Chromium issue 41491098 (unblock condition 2)

The referenced issue tracks **compositor (GPU) acceleration of `background-color`
animations** — an enhancement, not a rendering correctness bug.

Current status (per Chrome for Developers blog "Updates in hardware-accelerated animation
capabilities"): Chrome now composites `background-color` animations for elements whose paint
reduces to a solid-color swap. Known edge cases (the `<body>` element, table rows/columns,
transparent backgrounds) fall back to the main thread **gracefully** — they still animate
correctly, just not on the compositor.

This does **not** meet the plan's STOP condition (a rendering bug that affects accelerated
color animation). Importantly, the value of this change does not depend on compositor
acceleration: routing color animations through WAAPI is a **main-thread JS offload** (the
browser's animation engine drives the animation instead of Motion re-rendering styles every
frame on the JS main thread). That benefit holds in every browser, and any compositor
acceleration Chrome applies is a bonus on top.

Sources:
- https://developer.chrome.com/blog/hardware-accelerated-animations
