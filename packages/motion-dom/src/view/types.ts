import { AnimationOptions, DOMKeyframesDefinition } from "../animation/types"

export type ViewTransitionAnimationDefinition = {
    keyframes: DOMKeyframesDefinition
    options: AnimationOptions
}

export type ViewTransitionTarget = {
    layout?: ViewTransitionAnimationDefinition
    /**
     * Presence-gated: `enter` animates a pure newcomer's new view, `exit` a
     * pure leaver's old view. A survivor (present in both snapshots) gets
     * neither - it just morphs.
     */
    enter?: ViewTransitionAnimationDefinition
    exit?: ViewTransitionAnimationDefinition
    /**
     * View-targeted (ungated): `new`/`old` animate the new/old view whenever it
     * exists - including a survivor's, for crossfades and slide-throughs.
     */
    new?: ViewTransitionAnimationDefinition
    old?: ViewTransitionAnimationDefinition
}

export type ViewTransitionOptions = AnimationOptions & {
    interrupt?: "wait" | "immediate"
}

export type ViewTransitionTargetDefinition = string | Element
