"use client"

import {
    AnimationPlaybackControls,
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
    /**
     * When false, initializes scroll values to the current scroll position
     * instead of 0. This prevents springs attached to scroll values from
     * animating on page refresh or back navigation.
     *
     * @default true
     */
    startAtZero?: boolean
}

const createScrollMotionValues = () => ({
    scrollX: motionValue(0),
    scrollY: motionValue(0),
    scrollXProgress: motionValue(0),
    scrollYProgress: motionValue(0),
})

function readScrollPosition(el: Element) {
    const x = Math.abs(el.scrollLeft)
    const y = Math.abs(el.scrollTop)
    const xLen = el.scrollWidth - el.clientWidth
    const yLen = el.scrollHeight - el.clientHeight
    return {
        scrollX: motionValue(x),
        scrollY: motionValue(y),
        scrollXProgress: motionValue(xLen > 0 ? x / xLen : 0),
        scrollYProgress: motionValue(yLen > 0 ? y / yLen : 0),
    }
}

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
        factory: (animation: AnimationPlaybackControls) =>
            scroll(animation, {
                ...options,
                axis,
                container: container?.current || undefined,
                target: target?.current || undefined,
            }),
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
    startAtZero,
    ...options
}: UseScrollOptions = {}) {
    const values = useConstant(() => {
        if (startAtZero === false && typeof document !== "undefined") {
            const el = container?.current || document.scrollingElement
            if (el) return readScrollPosition(el)
        }
        return createScrollMotionValues()
    })

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

    const needsJump = useRef(startAtZero === false && !!container)

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
                if (needsJump.current) {
                    needsJump.current = false
                    values.scrollX.jump(x.current)
                    values.scrollXProgress.jump(x.progress)
                    values.scrollY.jump(y.current)
                    values.scrollYProgress.jump(y.progress)
                    return
                }
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
        if (needsStart.current) {
            invariant(
                !isRefPending(container),
                "Container ref is defined but not hydrated",
                "use-scroll-ref"
            )
            invariant(
                !isRefPending(target),
                "Target ref is defined but not hydrated",
                "use-scroll-ref"
            )
            return start()
        } else {
            return
        }
    }, [start])

    return values
}
