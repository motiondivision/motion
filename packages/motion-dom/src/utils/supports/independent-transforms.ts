import { memoSupports } from "./memo"

/**
 * Accelerated independent transforms render through the individual
 * translate, scale and rotate CSS properties and join values into a
 * running animation with setKeyframes(). Browsers without either keep
 * rendering through the transform shorthand on the main thread.
 */
export const supportsIndependentTransforms = /*@__PURE__*/ memoSupports(
    () =>
        typeof CSS !== "undefined" &&
        CSS.supports("translate", "0px") &&
        typeof KeyframeEffect !== "undefined" &&
        "setKeyframes" in KeyframeEffect.prototype,
    "independentTransforms"
)
