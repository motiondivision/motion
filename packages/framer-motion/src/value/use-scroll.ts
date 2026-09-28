"use client"

import {
    AnimationPlaybackControls,
    cancelMicrotask,
    frame,
    microtask,
    MotionValue,
    MotionValueEventCallbacks,
    supportsScrollTimeline,
    supportsViewTimeline,
    time,
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

interface ScrollTracker {
    retain: VoidFunction
    release: VoidFunction
    measure: VoidFunction
}

/**
 * useScroll only measures the scroll every frame while one of its values has
 * a `change` subscriber. Values that are only consumed by hardware-accelerated
 * animations, which follow the scroll natively, are otherwise measured on
 * demand when they're read.
 */
class ScrollMotionValue extends MotionValue<number> {
    private tracksVelocity?: boolean

    constructor(private tracker: ScrollTracker) {
        super(0)
    }

    on<EventName extends keyof MotionValueEventCallbacks<number>>(
        eventName: EventName,
        callback: MotionValueEventCallbacks<number>[EventName]
    ): VoidFunction {
        if (eventName !== "change") return super.on(eventName, callback)

        // Catch up before subscribing, so the new subscriber isn't notified
        this.tracker.retain()
        const unsubscribe = super.on(eventName, callback)
        let isSubscribed = true

        return () => {
            unsubscribe()
            if (isSubscribed) {
                isSubscribed = false
                this.tracker.release()
            }
        }
    }

    get() {
        this.tracker.measure()
        return super.get()
    }

    /**
     * Velocity is measured between frames, so reading it keeps the scroll
     * tracked from then on.
     */
    getVelocity() {
        if (!this.tracksVelocity) {
            this.tracksVelocity = true
            this.tracker.retain()
        }
        return super.getVelocity()
    }
}

function createScrollMotionValues() {
    let observers = 0
    let options: ScrollInfoOptions | undefined
    let stopTracking: VoidFunction | undefined
    let measuredAt: number | undefined

    const setValues = (
        { x, y }: ScrollInfo,
        method: "set" | "jump" = "set"
    ) => {
        values.scrollX[method](x.current)
        values.scrollXProgress[method](x.progress)
        values.scrollY[method](y.current)
        values.scrollYProgress[method](y.progress)
    }

    const track = () => {
        if (observers && options && !stopTracking) {
            stopTracking = scrollInfo(setValues, options)
        }
    }

    const tracker: ScrollTracker = {
        retain: () => {
            observers++
            tracker.measure()
            track()
        },
        /**
         * Stopping is deferred to the next frame, so effects that re-subscribe
         * straight away keep the same tracking.
         */
        release: () => {
            if (--observers) return
            frame.read(() => {
                if (!observers && stopTracking) {
                    stopTracking()
                    stopTracking = undefined
                }
            })
        },
        /**
         * Jumping resets velocity, which would otherwise be measured from
         * however long ago the values were last set.
         */
        measure: () => {
            if (!stopTracking && options && measuredAt !== time.now()) {
                measuredAt = time.now()
                measureScrollInfo((info) => setValues(info, "jump"), options)
            }
        },
    }

    const values: Record<
        "scrollX" | "scrollY" | "scrollXProgress" | "scrollYProgress",
        MotionValue<number>
    > = {
        scrollX: new ScrollMotionValue(tracker),
        scrollY: new ScrollMotionValue(tracker),
        scrollXProgress: new ScrollMotionValue(tracker),
        scrollYProgress: new ScrollMotionValue(tracker),
    }

    const start = (startOptions: ScrollInfoOptions) => {
        options = startOptions
        measuredAt = undefined
        track()

        return () => {
            stopTracking?.()
            stopTracking = options = undefined
        }
    }

    return [values, start] as const
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
