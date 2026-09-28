"use client"

import {
    AnimationPlaybackControls,
    cancelMicrotask,
    microtask,
    MotionValue,
    MotionValueEventCallbacks,
    supportsScrollTimeline,
    supportsViewTimeline,
} from "motion-dom"
import { invariant } from "motion-utils"
import { RefObject, useCallback, useEffect, useRef } from "react"
import { scroll } from "../render/dom/scroll"
import { measureScrollInfo, scrollInfo } from "../render/dom/scroll/track"
import { ScrollInfo, ScrollInfoOptions } from "../render/dom/scroll/types"
import { offsetToViewTimelineRange } from "../render/dom/scroll/utils/offset-to-range"
import { useConstant } from "../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../utils/use-isomorphic-effect"

export interface UseScrollOptions
    extends Omit<ScrollInfoOptions, "container" | "target"> {
    container?: RefObject<HTMLElement | null>
    target?: RefObject<HTMLElement | null>
}

/**
 * useScroll only measures the scroll every frame while one of its values has
 * a `change` subscriber. Values that are only consumed by hardware-accelerated
 * animations, which follow the scroll natively, are otherwise measured on
 * demand when they're read.
 */
class ScrollMotionValue extends MotionValue<number> {
    tracksVelocity?: boolean

    constructor(private update: VoidFunction, private measure: VoidFunction) {
        super(0)
    }

    on<EventName extends keyof MotionValueEventCallbacks<number>>(
        eventName: EventName,
        callback: MotionValueEventCallbacks<number>[EventName]
    ): VoidFunction {
        // Catch up before subscribing, so the new subscriber isn't notified
        this.measure()
        const unsubscribe = super.on(eventName, callback)
        this.update()
        return unsubscribe
    }

    /**
     * Called a frame after the last `change` subscriber leaves.
     */
    stop() {
        super.stop()
        this.update()
    }

    get() {
        this.measure()
        return super.get()
    }

    /**
     * Velocity is measured between frames, so reading it keeps the scroll
     * tracked from then on. Until then, there aren't frames to measure.
     */
    getVelocity() {
        if (this.tracksVelocity) return super.getVelocity()
        this.tracksVelocity = true
        this.update()
        return 0
    }
}

function createScrollMotionValues() {
    let options: ScrollInfoOptions | undefined
    let stopTracking: VoidFunction | undefined

    const setValues = ({ x, y }: ScrollInfo) =>
        [x.current, y.current, x.progress, y.progress].forEach((v, i) =>
            values[i].set(v)
        )

    /**
     * MotionValue keeps a sole `change` subscriber directly, and moves them
     * into `events.change` once there's a second.
     */
    const update = () => {
        if (
            options &&
            values.some(
                (value) =>
                    value.tracksVelocity ||
                    value["changeSubscriber"] ||
                    value["events"].change?.getSize()
            )
        ) {
            stopTracking ||= scrollInfo(setValues, options)
        } else {
            stopTracking?.()
            stopTracking = undefined
        }
    }

    const measure = () =>
        stopTracking || (options && measureScrollInfo(setValues, options))

    const values = [0, 0, 0, 0].map(
        () => new ScrollMotionValue(update, measure)
    )
    const [scrollX, scrollY, scrollXProgress, scrollYProgress] =
        values as MotionValue<number>[]

    const start = (startOptions?: ScrollInfoOptions) => {
        options = startOptions
        update()
        return () => {
            start()
        }
    }

    return [
        { scrollX, scrollY, scrollXProgress, scrollYProgress },
        start,
    ] as const
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
    const [values, startTracking] = useConstant(createScrollMotionValues)

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

    const needsStart = useRef(false)

    const start = useCallback(
        () =>
            startTracking({
                ...options,
                container: container?.current || undefined,
                target: target?.current || undefined,
            }),
        [container, target, JSON.stringify(options.offset)]
    )

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
