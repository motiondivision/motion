"use client"

import { layout } from "../../motion/features/layout"
import { FeatureBundle } from "../../motion/features/types"
import { domAnimation } from "./features-animation"

/**
 * Animations, gestures and layout animations — without drag or pan.
 *
 * @public
 */
export const domLayout: FeatureBundle = /* @__PURE__ */ Object.assign(
    {},
    domAnimation,
    layout
)
