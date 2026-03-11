"use client"

import { useMemo } from "react"
import { AnimationScope } from "motion-dom"
import { useConstant } from "../../utils/use-constant"
import { useUnmountEffect } from "../../utils/use-unmount-effect"
import { useReducedMotionConfig } from "../../utils/reduced-motion/use-reduced-motion-config"
import { createScopedAnimate } from "../animate"

export function useAnimate<T extends Element = any>() {
    const scope: AnimationScope<T> = useConstant(() => ({
        current: null!, // Will be hydrated by React
        animations: [],
    }))

    const reduceMotion = useReducedMotionConfig() ?? undefined

    const animate = useMemo(
        () => createScopedAnimate({ scope, reduceMotion }),
        [scope, reduceMotion]
    )

    useUnmountEffect(() => {
        scope.animations.forEach((animation) => animation.stop())
        scope.animations.length = 0
    })

    return [scope, animate] as [AnimationScope<T>, typeof animate]
}
