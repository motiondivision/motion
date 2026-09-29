"use client"

import {
    derivedValue,
    DerivedSource,
    LazyMotionValue,
    MotionValue,
} from "motion-dom"
import { useIsomorphicLayoutEffect } from "../utils/use-isomorphic-effect"
import { useMotionValue } from "./use-motion-value"

export function useCombineMotionValues<R>(
    values: MotionValue[],
    combineValues: () => R
) {
    /**
     * Initialise the returned motion value. This remains the same between
     * renders. It only subscribes to the values while it's observed, and is
     * otherwise computed when it's read.
     */
    const value = useMotionValue(undefined as R, () =>
        derivedValue(values, combineValues)
    ) as LazyMotionValue<R, DerivedSource<R>>
    const { source } = value
    source.inputs = values
    source.compute = combineValues

    /**
     * Synchronously update the motion value during the render while it's
     * subscribed, so the styles applied to the DOM are up-to-date.
     */
    source.sync()

    /**
     * Resubscribe to the latest values after each render while subscribed.
     */
    useIsomorphicLayoutEffect(() => {
        value["stopSource"] && source.subscribe()
        return source.unsubscribe
    })

    return value
}
