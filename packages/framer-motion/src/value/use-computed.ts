"use client"

import { collectMotionValues, type MotionValue } from "motion-dom"
import { useCombineMotionValues } from "./use-combine-values"

export function useComputed<O>(compute: () => O): MotionValue<O> {
    /**
     * Open session of collectMotionValues. Any MotionValue that calls get()
     * will be saved into this array.
     */
    collectMotionValues.current = []

    compute()

    const value = useCombineMotionValues(collectMotionValues.current, compute)

    /**
     * Synchronously close session of collectMotionValues.
     */
    collectMotionValues.current = undefined

    return value
}
