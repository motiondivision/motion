import { Box } from "motion-utils"
import type { KeyframeResolver } from "./KeyframesResolver"

/**
 * Temporary subset of VisualElement until VisualElement is
 * moved to motion-dom
 */
export interface WithRender {
    render: () => void
    readValue: (name: string, keyframe: any) => any
    getValue: (name: string, defaultValue?: any) => any
    current?: HTMLElement | SVGElement
    measureViewportBox: () => Box
}

/**
 * What animateMotionValue needs from the thing that owns a value: a
 * VisualElement, or the lighter ElementState behind animate()'s effects.
 */
export interface AnimationElement extends Omit<WithRender, "current"> {
    current?: unknown
    KeyframeResolver?: typeof KeyframeResolver
    shouldSkipAnimations?: boolean
    shouldReduceMotion?: boolean | null
}
