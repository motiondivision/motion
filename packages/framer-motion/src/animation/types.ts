import { KeyframeResolver, OnKeyframesResolved } from "motion-dom"

export type ResolveKeyframes<V extends string | number> = (
    keyframes: V[],
    onComplete: OnKeyframesResolved<V>,
    name?: string,
    motionValue?: any
) => KeyframeResolver<V>
