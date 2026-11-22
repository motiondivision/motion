"use client"

import { basicLayout } from "../../motion/features/basic-layout"
import { FeatureBundle } from "../../motion/features/types"
import { domAnimation } from "./features-animation"

/**
 * Animations, gestures, and single-element FLIP `layout` animations without
 * drag, shared-element `layoutId` crossfade, or default scale correctors.
 *
 * @public
 */
export const domBasicLayout: FeatureBundle = /* @__PURE__ */ Object.assign(
    {},
    domAnimation,
    basicLayout
)
