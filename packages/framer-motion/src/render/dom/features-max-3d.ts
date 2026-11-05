"use client"

import { HTMLProjectionNode, quadLayout, setLayoutEngine } from "motion-dom"
import { MeasureLayout } from "../../motion/features/layout/MeasureLayout"
import { FeatureBundle } from "../../motion/features/types"
import { domMax } from "./features-max"

/**
 * A projection node that installs quad projection before it's created, so
 * layout animations can run inside, and between, rotated, skewed and 3D
 * transformed spaces.
 */
class HTMLQuadProjectionNode extends HTMLProjectionNode {
    constructor(...args: ConstructorParameters<typeof HTMLProjectionNode>) {
        setLayoutEngine(quadLayout)
        super(...args)
    }
}

/**
 * `domMax`, plus layout animations that stay correct inside and between
 * CSS transforms Motion doesn't control: rotate, skew, scale and 3D
 * transforms with perspective.
 *
 * ```jsx
 * <LazyMotion features={domMax3D}>
 * ```
 *
 * @public
 */
export const domMax3D: FeatureBundle = /* @__PURE__ */ Object.assign(
    {},
    domMax,
    {
        layout: {
            ProjectionNode: HTMLQuadProjectionNode,
            MeasureLayout,
        },
    }
)
