# 039: Additive `transform`

## Goal

Make the `transform` style/animation value compose additively with Motion's
independent transform props, instead of replacing them. This mirrors how CSS
composes the independent `translate`/`rotate`/`scale` properties with the
`transform` list: independent values apply first, then the user list.

```jsx
<motion.div animate={{ scale: 2, transform: "rotate(90deg)" }} />
// renders: transform: scale(2) rotate(90deg)
```

Motion values are injected via `useMotionTemplate`:

```jsx
<motion.div style={{ transform: useMotionTemplate`rotate(${rotate})` }} />
```

Layout projection treats the user `transform` string exactly like rotate/skew
today: reset before measurement, re-inject verbatim into the distorting slot of
the projection transform.

Out of scope: tuple/array transform APIs, named slots, WAAPI `composite: "add"`
optimisation, SVG behaviour changes, matrix decomposition for mismatched
keyframe interpolation.

## Composition rule

1. Build the independent transform string from `transformPropOrder` +
   `pathRotation` as today.
2. If `latestValues.transform` is present and is not `"none"` or `""`, append
   it after the independent string (space-separated).
3. If only the user transform is present, the output is the user transform
   alone.
4. If a `transformTemplate` is provided, it receives the fully composed string
   as its `generated` argument. The values dict passed to the template stays
   independent-props-only (do not add the `transform` key to it). The template
   contract does not otherwise change.
5. A user transform of `"none"` is treated as absent everywhere.

## Changes

### 1. `packages/motion-dom/src/render/html/utils/build-transform.ts`

- Accept the user transform (read from `latestValues.transform`).
- After the `pathRotation` block, append the user transform per the rule above.
  A non-empty user transform means `transformIsDefault = false`.
- Composed string goes through the existing template/`"none"` tail unchanged.

### 2. `packages/motion-dom/src/render/html/utils/build-styles.ts`

- `"transform"` is NOT in `transformProps`, so today it falls into the generic
  style branch and is written raw to `style.transform`. Special-case it in the
  key loop: skip the generic write, set `hasTransform = true`.
- Remove the `if (!latestValues.transform)` gate. Call `buildTransform`
  whenever there are transform values, a user transform, or a template.
- Preserve the existing "reset to none when transforms disappear" behaviour.

### 3. `packages/motion-dom/src/effects/style/transform.ts` (styleEffect build)

- Same composition rule: append `state.latest.transform` after the
  `pathRotation` block.

### 4. `packages/motion-dom/src/effects/style/index.ts` (`addStyleValue`)

- Route key `"transform"` into the computed transform channel (same branch as
  `transformProps`) instead of the raw `element.style[key]` write, so it
  composes rather than fights the built string.
- CAUTION: the internal computed channel in `MotionValueState` is also keyed
  `"transform"`. `state.set("transform", userValue, ...)` would collide with
  it. Resolve the collision cleanly, for example by renaming the internal
  computed channel key (it is internal state, grep for `state.get("transform")`
  consumers) or by another mechanism of your choice. The requirement: a user
  `transform` motion value and independent transform props on the same element
  must both work, composed per the rule, with one style write per frame.

### 5. Layout projection: treat `transform` as a distorting value

- `packages/motion-dom/src/projection/node/create-projection-node.ts`,
  `resetSkewAndRotation()` (~line 1915): include `latestValues.transform` in
  the has-distorting-transform check and reset it around measurement.
  `resetDistortingTransform` currently resets to `0`; the reset value for
  `transform` must be `"none"` (or extend the helper with a reset-value
  parameter). Keep the method name.
- `packages/motion-dom/src/projection/styles/transform.ts`
  (`buildProjectionTransform`): append `latestTransform.transform` (skip if
  `"none"`/empty) at the END of the distorting group, after the skews and
  before the final element scale. This matches the additive rule: independent
  distorting props first, then the user list.
- `packages/motion-dom/src/projection/utils/has-transform.ts`: audit each
  call-site before changing. `hasTransform` should report `true` for a
  non-`"none"` user transform where the question is "does this element have a
  visual transform" (e.g. `applyProjectionStyles`' decision to clear
  `targetStyle.transform` to `"none"` at ~line 2023 must NOT clear when a user
  transform exists). But `delta-apply.ts` folds x/y/scale into measured boxes
  mathematically and cannot fold an arbitrary string; the user transform is
  handled by reset-before-measure instead, same as rotate. If a call-site
  would break with the string included, split the util rather than overload
  it.
- Audit every place projection writes `transform: "none"` (e.g. the
  `needsReset` branch in `applyProjectionStyles` ~line 2007) and decide
  whether the user transform must be restored there. Follow whatever rotate
  does today: the regular render pass restores user values after projection
  hands back control.

### 6. WAAPI acceleration gate

`"transform"` is in `acceleratedValues`
(`packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts`) and
`VisualElement.bindToMotionValue` (~line 543) can hand it to a
`NativeAnimation`. Under additive semantics a WAAPI-driven `transform` fights
the per-frame `style.transform` writes from the independent props. Gate it:
do not accelerate `transform` when the element has any other transform values
in `latestValues` (or a `transformTemplate`). Acceleration stays allowed when
`transform` is the element's only transform value.

## Behaviour notes (encode in tests)

- `animate={{ scale: 2, transform: "rotate(90deg)" }}` renders
  `scale(2) rotate(90deg)`.
- `animate={{ transform: "rotate(90deg)" }}` alone renders `rotate(90deg)`
  (no leading identities, no regression of current pass-through).
- `transform: "none"` with `scale: 2` renders `scale(2)`.
- `transformTemplate` receives the composed string as `generated` and its
  values dict contains only independent props.
- Keyframe interpolation of `transform` strings uses the complex value type:
  lists must share structure across keyframes. Mismatched lists are a known,
  pre-existing limitation. Do not attempt matrix fallback.
- Layout animation with a user transform: element measures un-distorted, the
  user string re-appears in the projection transform after rotate/skew, and
  after the layout animation completes the normal render restores the composed
  string. Behavioural parity with `rotate` today.
- styleEffect: independent props + user `transform` motion value compose the
  same string as the React path.

## Tests

Follow existing test layout and runners (jest, `yarn test` per package):

- `packages/motion-dom/src/render/html/utils/__tests__/` (create if missing,
  match sibling test conventions): unit tests for `buildTransform` and
  `buildHTMLStyles` covering the behaviour notes above.
- `packages/motion-dom/src/effects/style/__tests__/`: styleEffect composition,
  including the state-key collision case.
- `packages/motion-dom/src/projection/styles/__tests__/transform.test.ts`:
  extend for the distorting-slot injection.
- `packages/framer-motion/src/motion/__tests__/` (or nearest equivalent):
  jsdom test that `<motion.div animate={{ scale: 2, transform: "rotate(90deg)" }}>`
  renders the composed string, and one with `transformTemplate`.
- A projection-level test for reset-before-measure if the existing projection
  test harness supports it cheaply; otherwise cover `resetSkewAndRotation`
  logic directly.

## Constraints

- Do NOT touch `CHANGELOG.md` (it has unrelated uncommitted edits).
- Do NOT commit anything you did not change for this task.
- Two-space indentation, no semicolons is NOT this repo's style: follow the
  motion repo's existing Prettier config exactly (it uses 4-space indentation
  and no semicolons in TS source; match surrounding code).
- Run only the targeted test files while iterating. Run the full
  `motion-dom` and `framer-motion` test suites once at the end.
- Keep the diff minimal: no refactors beyond what the collision in change 4
  requires.
