import { Box } from "motion-utils"
import type { MotionValue, Owner } from "../../value"
import type { AnimationPlaybackControls, ValueAnimationOptions } from "../types"
import type { KeyframeResolver } from "./KeyframesResolver"

/**
 * What the DOM keyframe resolver needs from the thing rendering a value:
 * a VisualElement, or an effect bound to a subject.
 */
export interface WithRender {
    /**
     * Write pending values to the subject so it can be measured.
     */
    render: () => void
    /**
     * The subject's current value for `name`, as the origin of an
     * animation. Normalised by the resolver.
     */
    readValue: (name: string, keyframe: any) => any
    /**
     * The motion value bound to `name`, if any.
     */
    getValue: (name: string) => MotionValue | undefined
    current?: HTMLElement | SVGElement
    measureViewportBox: () => Box
}

/**
 * The owner of an animating value. Either a VisualElement or an
 * EffectSubject.
 */
export interface AnimationElement
    extends Omit<WithRender, "current">,
        Owner {
    KeyframeResolver?: typeof KeyframeResolver
    /**
     * Start a value's animation in the renderer, for instance on React
     * Native's UI thread. Return nothing to animate it in JS.
     */
    createAnimation?: (
        options: ValueAnimationOptions<any>
    ) => AnimationPlaybackControls | undefined
    shouldSkipAnimations?: boolean
    shouldReduceMotion?: boolean | null
}
