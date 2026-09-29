import { MotionValue, collectMotionValues } from "."
import { derivedValue } from "./lazy-value"

export type TransformInputRange = number[]
export type SingleTransformer<I, O> = (input: I) => O
export type MultiTransformer<I, O> = (input: I[]) => O
export type ValueTransformer<I, O> =
    | SingleTransformer<I, O>
    | MultiTransformer<I, O>

/**
 * Create a `MotionValue` that transforms the output of other `MotionValue`s by
 * passing their latest values through a transform function.
 *
 * While it's subscribed to, it's re-evaluated whenever a `MotionValue`
 * referred to in the provided function is updated. Otherwise, it's evaluated
 * when it's read.
 *
 * ```jsx
 * const x = motionValue(0)
 * const y = transformValue(() => x.get() * 2) // double x
 * ```
 *
 * @param transformer - A transform function. This function must be pure with no side-effects or conditional statements.
 * @returns `MotionValue`
 *
 * @public
 */
export function transformValue<O>(transform: () => O): MotionValue<O> {
    const collectedValues: MotionValue[] = []

    /**
     * Open session of collectMotionValues. Any MotionValue that calls get()
     * inside transform will be saved into this array.
     */
    collectMotionValues.current = collectedValues
    const initialValue = transform()
    collectMotionValues.current = undefined

    return derivedValue(collectedValues, transform, initialValue)
}
