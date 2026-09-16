import { AnimationPlaybackControls, Transition } from "../animation/types"
import { TargetAndTransition } from "../node/types"

export type ViewAnimationType = "enter" | "exit" | "share" | "update"

export type ViewAnimationStartCallback = (
    animation: AnimationPlaybackControls,
    type: ViewAnimationType
) => void

export type ViewAnimationCompleteCallback = (type: ViewAnimationType) => void

export interface ViewAnimationOptions {
    transition?: Transition
    enter?: TargetAndTransition | ((types: string[]) => TargetAndTransition)
    exit?: TargetAndTransition | ((types: string[]) => TargetAndTransition)
    share?: TargetAndTransition | ((types: string[]) => TargetAndTransition)
    update?: TargetAndTransition | ((types: string[]) => TargetAndTransition)
    onAnimationStart?: ViewAnimationStartCallback
    onAnimationComplete?: ViewAnimationCompleteCallback
}
