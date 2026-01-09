"use client"

import {
    AnyResolvedKeyframe,
    cancelFrame,
    frame,
    MotionValue,
    transform,
    TransformOptions,
} from "motion-dom"
import { useConstant } from "../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../utils/use-isomorphic-effect"
import { useCombineMotionValues } from "./use-combine-values"
import { useComputed } from "./use-computed"
import { useMotionValue } from "./use-motion-value"

export type InputRange = number[]
type SingleTransformer<I, O> = (input: I) => O
type MultiTransformer<I, O> = (input: I[]) => O
type Transformer<I, O> =
    | SingleTransformer<I, O>
    /**
     * Ideally, this would be typed <I, O> in all instances, but to type this
     * more accurately requires the tuple support in TypeScript 4:
     * https://gist.github.com/InventingWithMonster/c4d23752a0fae7888596c4ff6d92733a
     */
    | MultiTransformer<AnyResolvedKeyframe, O>

interface OutputMap<O> {
    [key: string]: O[]
}

/**
 * Create a `MotionValue` that transforms the output of another `MotionValue` by mapping it from one range of values into another.
 *
 * @remarks
 *
 * Given an input range of `[-200, -100, 100, 200]` and an output range of
 * `[0, 1, 1, 0]`, the returned `MotionValue` will:
 *
 * - When provided a value between `-200` and `-100`, will return a value between `0` and  `1`.
 * - When provided a value between `-100` and `100`, will return `1`.
 * - When provided a value between `100` and `200`, will return a value between `1` and  `0`
 *
 *
 * The input range must be a linear series of numbers. The output range
 * can be any value type supported by Motion: numbers, colors, shadows, etc.
 *
 * Every value in the output range must be of the same type and in the same format.
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(0)
 *   const xRange = [-200, -100, 100, 200]
 *   const opacityRange = [0, 1, 1, 0]
 *   const opacity = useTransform(x, xRange, opacityRange)
 *
 *   return (
 *     <motion.div
 *       animate={{ x: 200 }}
 *       style={{ opacity, x }}
 *     />
 *   )
 * }
 * ```
 *
 * @param inputValue - `MotionValue`
 * @param inputRange - A linear series of numbers (either all increasing or decreasing)
 * @param outputRange - A series of numbers, colors or strings. Must be the same length as `inputRange`.
 * @param options -
 *
 *  - clamp: boolean. Clamp values to within the given range. Defaults to `true`
 *  - ease: EasingFunction[]. Easing functions to use on the interpolations between each value in the input and output ranges. If provided as an array, the array must be one item shorter than the input and output ranges, as the easings apply to the transition between each.
 *
 * @returns `MotionValue`
 *
 * @public
 */
export function useTransform<I, O>(
    value: MotionValue<number>,
    inputRange: InputRange,
    outputRange: O[],
    options?: TransformOptions<O>
): MotionValue<O>

/**
 * Create a `MotionValue` that transforms the output of another `MotionValue` through a function.
 * In this example, `y` will always be double `x`.
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(10)
 *   const y = useTransform(x, value => value * 2)
 *
 *   return <motion.div style={{ x, y }} />
 * }
 * ```
 *
 * @param input - A `MotionValue` that will pass its latest value through `transform` to update the returned `MotionValue`.
 * @param transform - A function that accepts the latest value from `input` and returns a new value.
 * @returns `MotionValue`
 *
 * @public
 */
export function useTransform<I, O>(
    input: MotionValue<I>,
    transformer: SingleTransformer<I, O>
): MotionValue<O>

/**
 * Pass an array of `MotionValue`s and a function to combine them. In this example, `z` will be the `x` multiplied by `y`.
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(0)
 *   const y = useMotionValue(0)
 *   const z = useTransform([x, y], ([latestX, latestY]) => latestX * latestY)
 *
 *   return <motion.div style={{ x, y, z }} />
 * }
 * ```
 *
 * @param input - An array of `MotionValue`s that will pass their latest values through `transform` to update the returned `MotionValue`.
 * @param transform - A function that accepts the latest values from `input` and returns a new value.
 * @returns `MotionValue`
 *
 * @public
 */
export function useTransform<I, O>(
    input:
        | MotionValue<string>[]
        | MotionValue<number>[]
        | MotionValue<AnyResolvedKeyframe>[],
    transformer: MultiTransformer<I, O>
): MotionValue<O>
export function useTransform<I, O>(transformer: () => O): MotionValue<O>

/**
 * Create multiple `MotionValue`s that transform the output of another `MotionValue` by mapping it from one range of values into multiple output ranges.
 *
 * @remarks
 *
 * This is useful when you want to derive multiple values from a single input value.
 * The keys of the output map must remain constant across renders.
 *
 * ```jsx
 * export const MyComponent = () => {
 *   const x = useMotionValue(0)
 *   const { opacity, scale } = useTransform(x, [0, 100], {
 *     opacity: [0, 1],
 *     scale: [0.5, 1]
 *   })
 *
 *   return (
 *     <motion.div style={{ opacity, scale, x }} />
 *   )
 * }
 * ```
 *
 * @param inputValue - `MotionValue`
 * @param inputRange - A linear series of numbers (either all increasing or decreasing)
 * @param outputMap - An object where keys map to output ranges. Each output range must be the same length as `inputRange`.
 * @param options - Transform options applied to all outputs
 *
 * @returns An object with the same keys as `outputMap`, where each value is a `MotionValue`
 *
 * @public
 */
export function useTransform<K extends string, O>(
    inputValue: MotionValue<number>,
    inputRange: InputRange,
    outputMap: { [key in K]: O[] },
    options?: TransformOptions<O>
): { [key in K]: MotionValue<O> }

export function useTransform<I, O, K extends string>(
    input:
        | MotionValue<I>
        | MotionValue<string>[]
        | MotionValue<number>[]
        | MotionValue<AnyResolvedKeyframe>[]
        | (() => O),
    inputRangeOrTransformer?: InputRange | Transformer<I, O>,
    outputRangeOrMap?: O[] | OutputMap<O>,
    options?: TransformOptions<O>
): MotionValue<O> | { [key in K]: MotionValue<O> } {
    if (typeof input === "function") {
        return useComputed(input)
    }

    /**
     * Detect if outputRangeOrMap is an output map (object with keys)
     * rather than an output range (array).
     */
    const isOutputMap =
        outputRangeOrMap !== undefined &&
        !Array.isArray(outputRangeOrMap) &&
        typeof inputRangeOrTransformer !== "function"

    if (isOutputMap) {
        return useMapTransform(
            input as MotionValue<number>,
            inputRangeOrTransformer as InputRange,
            outputRangeOrMap as OutputMap<O>,
            options
        )
    }

    const outputRange = outputRangeOrMap as O[] | undefined
    const transformer =
        typeof inputRangeOrTransformer === "function"
            ? inputRangeOrTransformer
            : transform(inputRangeOrTransformer!, outputRange!, options)

    return Array.isArray(input)
        ? useListTransform(
              input,
              transformer as MultiTransformer<AnyResolvedKeyframe, O>
          )
        : useListTransform([input], ([latest]) =>
              (transformer as SingleTransformer<I, O>)(latest)
          )
}

function useListTransform<I, O>(
    values: MotionValue<I>[],
    transformer: MultiTransformer<I, O>
): MotionValue<O> {
    const latest = useConstant<I[]>(() => [])

    return useCombineMotionValues(values, () => {
        latest.length = 0
        const numValues = values.length
        for (let i = 0; i < numValues; i++) {
            latest[i] = values[i].get()
        }

        return transformer(latest)
    })
}

function useMapTransform<O>(
    inputValue: MotionValue<number>,
    inputRange: InputRange,
    outputMap: OutputMap<O>,
    options?: TransformOptions<O>
): { [key: string]: MotionValue<O> } {
    /**
     * Capture the keys once on first render. This ensures hooks are called
     * in a consistent order across renders, which is required by React's
     * rules of hooks.
     */
    const keys = useConstant(() => Object.keys(outputMap))

    /**
     * Create transform functions for each key. These are recreated when
     * inputRange or outputMap values change.
     */
    const transformers = keys.map((key) =>
        transform(inputRange, outputMap[key], options)
    )

    /**
     * Create the initial values for each output motion value.
     */
    const initialInputValue = inputValue.get()
    const initialValues = transformers.map((t) => t(initialInputValue))

    /**
     * Create stable motion values for each key. These are created once
     * and reused across renders.
     */
    const motionValues = useConstant(() =>
        keys.map((_, i) => new MotionValue(initialValues[i]))
    )

    /**
     * Create a function that will update all motion values with the latest
     * transformed values.
     */
    const updateValues = () => {
        const currentInputValue = inputValue.get()
        for (let i = 0; i < keys.length; i++) {
            motionValues[i].set(transformers[i](currentInputValue))
        }
    }

    /**
     * Synchronously update all motion values during render to ensure
     * DOM styles are up-to-date within a React render.
     */
    updateValues()

    /**
     * Subscribe to the input motion value. When it changes, schedule
     * an update to all output motion values.
     */
    useIsomorphicLayoutEffect(() => {
        const scheduleUpdate = () => frame.preRender(updateValues, false, true)
        const unsubscribe = inputValue.on("change", scheduleUpdate)

        return () => {
            unsubscribe()
            cancelFrame(updateValues)
        }
    })

    /**
     * Build and return the result object with the same keys as outputMap.
     */
    const result: { [key: string]: MotionValue<O> } = {}
    for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = motionValues[i]
    }

    return result
}
