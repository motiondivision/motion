import { AnimationOptions, DOMKeyframesDefinition } from "../animation/types"

export type ViewTransitionAnimationDefinition = {
    keyframes: DOMKeyframesDefinition
    options: AnimationOptions
    /**
     * Set by `.crossfade()`. Marks an enter/exit that should run even on a
     * survivor (a persistent element that morphs), to dissolve its old <-> new.
     */
    crossfade?: boolean
}

export type ViewTransitionTarget = {
    layout?: ViewTransitionAnimationDefinition
    enter?: ViewTransitionAnimationDefinition
    exit?: ViewTransitionAnimationDefinition
}

export type ViewTransitionOptions = AnimationOptions & {
    interrupt?: "wait" | "immediate"
}

export type ViewTransitionTargetDefinition = string | Element
