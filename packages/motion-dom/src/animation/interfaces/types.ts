import type { AnimationType } from "../../render/types"
import type { Transition } from "../types"

export interface VisualElementAnimationOptions {
    delay?: number
    transitionOverride?: Transition
    custom?: any
    type?: AnimationType
}
