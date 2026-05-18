"use client"

import {
    AnimationPlaybackControls,
    cancelMicrotask,
    microtask,
    motionValue,
    supportsScrollTimeline,
    supportsViewTimeline,
} from "motion-dom"
import { invariant } from "motion-utils"
import { RefObject, useCallback, useEffect, useRef } from "react"
import { scroll } from "../render/dom/scroll"
import { ScrollInfoOptions } from "../render/dom/scroll/types"
import { offsetToViewTimelineRange } from "../render/dom/scroll/utils/offset-to-range"
import { useConstant } from "../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../utils/use-isomorphic-effect"

export interface UseScrollOptions
    extends Omit<ScrollInfoOptions, "container" | "target"> {
    container?: RefObject<HTMLElement | null>
    target?: RefObject<HTMLElement | null>
}

const createScrollMotionValues = () => ({
    scrollX: motionValue(0),
    scrollY: motionValue(0),
    scrollXProgress: motionValue(0),
    scrollYProgress: motionValue(0),
})

const isRefPending = (ref?: RefObject<HTMLElement | null>) => {
    if (!ref) return false
    return !ref.current
}

function makeAccelerateConfig(
    axis: "x" | "y",
    options: Omit<UseScrollOptions, "container" | "target">,
    container?: RefObject<HTMLElement | null>,
    target?: RefObject<HTMLElement | null>
) {
    return {
        // Refs attach child-first; defer so target.current is populated
        // before scroll() reads it.
        factory: (animation: AnimationPlaybackControls) => {
            let cleanup: VoidFunction | undefined
            const start = () => {
                // A provided ref may be hydrated by an effect declared after
                // useScroll (or in a parent). Don't attach to the window
                // scroll in the meantime — that result gets cached and would
                // permanently mistrack. Wait until the ref resolves.
                if (isRefPending(container) || isRefPending(target)) {
                    microtask.read(start)
                    return
                }
                cleanup = scroll(animation, {
                    ...options,
                    axis,
                    container: container?.current || undefined,
                    target: target?.current || undefined,
                })
            }
            microtask.read(start)
            return () => {
                cancelMicrotask(start)
                cleanup?.()
            }
        },
        times: [0, 1],
        keyframes: [0, 1],
        ease: (v: number) => v,
        duration: 1,
    }
}

function canAccelerateScroll(
    target?: RefObject<HTMLElement | null>,
    offset?: ScrollInfoOptions["offset"]
) {
    if (typeof window === "undefined") return false
    return target
        ? supportsViewTimeline() && !!offsetToViewTimelineRange(offset)
        : supportsScrollTimeline()
}

export function useScroll({
    container,
    target,
    ...options
}: UseScrollOptions = {}) {
    const values = useConstant(createScrollMotionValues)

    if (canAccelerateScroll(target, options.offset)) {
        values.scrollXProgress.accelerate = makeAccelerateConfig(
            "x",
            options,
            container,
            target
        )
        values.scrollYProgress.accelerate = makeAccelerateConfig(
            "y",
            options,
            container,
            target
        )
    }

    const scrollAnimation = useRef<VoidFunction | null>(null)
    const needsStart = useRef(false)

    const start = useCallback(() => {
        scrollAnimation.current = scroll(
            (
                _progress: number,
                {
                    x,
                    y,
                }: {
                    x: { current: number; progress: number }
                    y: { current: number; progress: number }
                }
            ) => {
                values.scrollX.set(x.current)
                values.scrollXProgress.set(x.progress)
                values.scrollY.set(y.current)
                values.scrollYProgress.set(y.progress)
            },
            {
                ...options,
                container: container?.current || undefined,
                target: target?.current || undefined,
            }
        )

        return () => {
            scrollAnimation.current?.()
        }
    }, [container, target, JSON.stringify(options.offset)])

    useIsomorphicLayoutEffect(() => {
        needsStart.current = false

        if (isRefPending(container) || isRefPending(target)) {
            needsStart.current = true
            return
        } else {
            return start()
        }
    }, [start])

    useEffect(() => {
        if (!needsStart.current) return

        // Defer to a microtask so any sibling/parent effect that hydrates the
        // ref has a chance to run first.
        let cleanup: VoidFunction | undefined
        const tryStart = () => {
            const containerPending = isRefPending(container)
            const targetPending = isRefPending(target)
            invariant(
                !containerPending,
                "Container ref is defined but not hydrated",
                "use-scroll-ref"
            )
            invariant(
                !targetPending,
                "Target ref is defined but not hydrated",
                "use-scroll-ref"
            )
            if (!containerPending && !targetPending) cleanup = start()
        }
        microtask.read(tryStart)

        return () => {
            cancelMicrotask(tryStart)
            cleanup?.()
        }
    }, [start])

    return values
}
