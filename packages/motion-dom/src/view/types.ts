import { AnimationOptions, DOMKeyframesDefinition } from "../animation/types"

export type ViewTransitionAnimationDefinition = {
    keyframes: DOMKeyframesDefinition
    options: AnimationOptions
}

export type ViewTransitionTarget = {
    layout?: ViewTransitionAnimationDefinition
    enter?: ViewTransitionAnimationDefinition
    exit?: ViewTransitionAnimationDefinition
    new?: ViewTransitionAnimationDefinition
    old?: ViewTransitionAnimationDefinition
}

export interface ViewTransitionOptions extends AnimationOptions {
    interrupt?: "wait" | "immediate"
}

export type Target = string | Element
