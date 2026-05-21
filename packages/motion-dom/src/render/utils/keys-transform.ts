/**
 * Generate a list of every possible transform key.
 */
export const transformPropOrder = [
    "transformPerspective",
    "x",
    "y",
    "z",
    "translateX",
    "translateY",
    "translateZ",
    "scale",
    "scaleX",
    "scaleY",
    "rotate",
    "rotateX",
    "rotateY",
    "rotateZ",
    "skew",
    "skewX",
    "skewY",
]

/**
 * A quick lookup for transform props.
 *
 * `pathRotation` is a transform for routing purposes (skipped from raw
 * style application, wired to the transform composite, flags transform
 * dirty) but is intentionally NOT in `transformPropOrder` — it is
 * composed onto `rotate` at the build sites, not serialized in its own
 * slot, and must stay out of the order-array consumers (parse-transform,
 * unit-conversion, keys-position).
 */
export const transformProps = /*@__PURE__*/ (() =>
    new Set([...transformPropOrder, "pathRotation"]))()
