"use client"

import { motionValue } from "motion-dom"
import { invariant } from "motion-utils"
import { RefObject, useCallback, useEffect, useRef } from "react"
import { scroll } from "../render/dom/scroll"
import { requestMeasure } from "../render/dom/scroll/track"
import { ScrollInfoOptions } from "../render/dom/scroll/types"
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

export function useScroll({
    container,
    target,
    ...options
}: UseScrollOptions = {}) {
    const values = useConstant(createScrollMotionValues)
    const scrollAnimation = useRef<VoidFunction | null>(null)
    const needsStart = useRef(false)
    const targetOffsetRef = useRef<{ top: number; left: number } | null>(null)

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

    /**
     * When tracking a target element, detect if the target's position has changed
     * (e.g., after DOM reordering) and request re-measurement if needed.
     *
     * Fixes: #2746, #2748
     */
    useIsomorphicLayoutEffect(() => {
        if (!scrollAnimation.current || !target?.current) return

        const targetElement = target.current
        const currentOffset = {
            top: targetElement.offsetTop,
            left: targetElement.offsetLeft,
        }

        // Only request measurement if position has changed
        if (
            targetOffsetRef.current &&
            (targetOffsetRef.current.top !== currentOffset.top ||
                targetOffsetRef.current.left !== currentOffset.left)
        ) {
            requestMeasure(
                container?.current || (document.scrollingElement as Element)
            )
        }

        targetOffsetRef.current = currentOffset
    })

    return values
}
