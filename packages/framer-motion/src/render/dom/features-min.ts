"use client"

import { animations } from "../../motion/features/animations"
import { FeatureBundle } from "../../motion/features/types"
import { createDomVisualElement } from "./create-visual-element"

/**
 * @public
 */
export const domMin: FeatureBundle = /* @__PURE__ */ Object.assign(
    { renderer: createDomVisualElement },
    animations
)
