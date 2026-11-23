"use client"

import { cancelFrame, frame, MotionValue } from "motion-dom"
import { isShallowEqual } from "../utils/is-shallow-equal"
import { useConstant } from "../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../utils/use-isomorphic-effect"
import { useMotionValue } from "./use-motion-value"

export function useCombineMotionValues<R>(
    values: MotionValue[],
    combineValues: () => R
) {
    /**
     * Initialise the returned motion value. This remains the same between renders.
     */
    const value = useMotionValue(useConstant(combineValues))

    /**
     * The latest combineValues, which can close over this render's props,
     * read when a source changes.
     */
    const latest = useConstant(() => ({ combineValues, values, isNew: true }))
    latest.combineValues = combineValues

    /**
     * Keep the last sources while they're the same values, so the
     * subscription below is only remade when they change.
     */
    if (!isShallowEqual(latest.values, values)) latest.values = values
    const sources = latest.values

    /**
     * Create a function that will update the template motion value with the latest values.
     * This is pre-bound so whenever a motion value updates it can schedule its
     * execution in Framesync. If it's already been scheduled it won't be fired twice
     * in a single frame.
     */
    const updateValue = useConstant(
        () => () => value.set(latest.combineValues())
    )

    /**
     * Synchronously update the motion value with the latest values during the render.
     * This ensures that within a React render, the styles applied to the DOM are up-to-date.
     * The first render made the value with them.
     */
    latest.isNew ? (latest.isNew = false) : updateValue()

    /**
     * Subscribe to all motion values found within the template. Whenever any of them change,
     * schedule an update.
     */
    useIsomorphicLayoutEffect(() => {
        const scheduleUpdate = () => frame.preRender(updateValue, false, true)
        const subscriptions = sources.map((v) => v.on("change", scheduleUpdate))

        /**
         * Catch up on changes made while unsubscribed. A source can change
         * between render and this subscription (e.g. in a child's layout
         * effect), and Strict Mode or <Activity> can re-run this effect
         * without a render after the cleanup cancelled a scheduled update.
         */
        updateValue()

        return () => {
            subscriptions.forEach((unsubscribe) => unsubscribe())
            cancelFrame(updateValue)
        }
    }, [sources])

    return value
}
