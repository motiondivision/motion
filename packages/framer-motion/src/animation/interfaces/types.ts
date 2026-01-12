import type { AnimationType, Transition } from "motion-dom"

export type VisualElementAnimationOptions = {
    delay?: number
    transitionOverride?: Transition
    custom?: any
    type?: AnimationType
}
