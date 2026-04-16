"use client"

import { useContext, useMemo } from "react"
import { AnimationScope, GroupAnimationWithThen } from "motion-dom"
import { useConstant } from "../../utils/use-constant"
import { useUnmountEffect } from "../../utils/use-unmount-effect"
import { useReducedMotionConfig } from "../../utils/reduced-motion/use-reduced-motion-config"
import { MotionConfigContext } from "../../context/MotionConfigContext"
import { createScopedAnimate } from "../animate"

export function useAnimate<T extends Element = any>() {
    const scope: AnimationScope<T> = useConstant(() => ({
        current: null!, // Will be hydrated by React
        animations: [],
    }))

    const { skipAnimations } = useContext(MotionConfigContext)
    const reduceMotion = useReducedMotionConfig() ?? undefined

    const animate = useMemo(
        () =>
            skipAnimations
                ? createNoopAnimate(scope)
                : createScopedAnimate({ scope, reduceMotion }),
        [scope, reduceMotion, skipAnimations]
    )

    useUnmountEffect(() => {
        scope.animations.forEach((animation) => animation.stop())
        scope.animations.length = 0
    })

    return [scope, animate] as [AnimationScope<T>, typeof animate]
}

/**
 * When skipAnimations is true, return an animate function that resolves
 * immediately without creating any WAAPI animations. This prevents
 * browsers (particularly WebKit) from reporting running animations via
 * element.getAnimations(), which can break tools like Playwright that
 * check element stability.
 */
function createNoopAnimate<T extends Element>(scope: AnimationScope<T>) {
    return ((..._args: any[]) => {
        return new GroupAnimationWithThen([])
    }) as ReturnType<typeof createScopedAnimate>
}
