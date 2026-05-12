"use client"

import { useContext, useMemo } from "react"
import { AnimationScope } from "motion-dom"
import { useConstant } from "../../utils/use-constant"
import { useUnmountEffect } from "../../utils/use-unmount-effect"
import { useReducedMotionConfig } from "../../utils/reduced-motion/use-reduced-motion-config"
import {
    MotionConfigContext,
    ReducedMotionConfig,
} from "../../context/MotionConfigContext"
import { createScopedAnimate } from "../animate"

export interface UseAnimateOptions {
    /**
     * Override the inherited `MotionConfig` reducedMotion setting for animations
     * created by this `useAnimate` instance.
     *
     * - `"always"`: Skip transform/layout animations (instant transition).
     * - `"never"`: Always animate transforms/layout, even if the user has
     *   `prefers-reduced-motion` enabled.
     * - `"user"`: Use the device preference.
     */
    reducedMotion?: ReducedMotionConfig
}

export function useAnimate<T extends Element = any>(
    { reducedMotion }: UseAnimateOptions = {}
) {
    const scope: AnimationScope<T> = useConstant(() => ({
        current: null!, // Will be hydrated by React
        animations: [],
    }))

    const reduceMotion = useReducedMotionConfig(reducedMotion) ?? undefined
    const { skipAnimations } = useContext(MotionConfigContext)

    const animate = useMemo(
        () => createScopedAnimate({ scope, reduceMotion, skipAnimations }),
        [scope, reduceMotion, skipAnimations]
    )

    useUnmountEffect(() => {
        scope.animations.forEach((animation) => animation.stop())
        scope.animations.length = 0
    })

    return [scope, animate] as [AnimationScope<T>, typeof animate]
}
