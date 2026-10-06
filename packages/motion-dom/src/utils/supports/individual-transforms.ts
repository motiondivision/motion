import { memoSupports } from "./memo"

/**
 * Whether the browser has the individual transform properties
 * (translate, scale and rotate). Without them x, scale and rotate can't
 * run as their own accelerated animations.
 */
export const supportsIndividualTransforms = /*@__PURE__*/ memoSupports(
    () =>
        typeof document !== "undefined" &&
        "translate" in document.documentElement.style,
    "individualTransforms"
)
