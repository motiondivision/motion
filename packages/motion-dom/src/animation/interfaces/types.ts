import type { AnimationType } from "../../render/types"
import type { Transition } from "../types"

export interface VisualElementAnimationOptions {
    delay?: number
    transitionOverride?: Transition
    custom?: any
    type?: AnimationType
    /**
     * Callback that fires when the first animation exits its delay phase.
     * This is used internally to fire the AnimationPlay event.
     */
    onDelayComplete?: () => void
}
