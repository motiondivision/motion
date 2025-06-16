import { positionalKeys } from "../../render/utils/keys-position"
import { MotionValue } from "../../value"
import { findDimensionValueType } from "../../value/types/dimensions"
import { getVariableValue } from "../utils/css-variables-conversion"
import { isCSSVariableToken } from "../utils/is-css-variable"
import {
    KeyframeResolver,
    OnKeyframesResolved,
    UnresolvedKeyframes,
} from "./KeyframesResolver"
import { WithRender } from "./types"
import { isNone } from "./utils/is-none"
import { makeNoneKeyframesAnimatable } from "./utils/make-none-animatable"
import { isNumOrPxType, positionalValues } from "./utils/unit-conversion"

export class DOMKeyframesResolver<
    T extends string | number
> extends KeyframeResolver<T> {
    name: string
    element?: WithRender

    private removedTransforms?: [string, string | number][]
    private measuredOrigin?: string | number

    constructor(
        unresolvedKeyframes: UnresolvedKeyframes<string | number>,
        onComplete: OnKeyframesResolved<T>,
        name?: string,
        motionValue?: MotionValue<T>,
        element?: WithRender
    ) {
        super(unresolvedKeyframes, onComplete, name, motionValue, element, true)
    }

    readKeyframes() {
        const { unresolvedKeyframes, element, name } = this

        if (!element || !element.current) return

        super.readKeyframes()

        /**
         * If any keyframe is a CSS variable, we need to find its value by sampling the element
         */
        for (let i = 0; i < unresolvedKeyframes.length; i++) {
            let keyframe = unresolvedKeyframes[i]

            if (typeof keyframe === "string") {
                keyframe = keyframe.trim()

                if (isCSSVariableToken(keyframe)) {
                    const resolved = getVariableValue(keyframe, element.current)

                    if (resolved !== undefined) {
                        unresolvedKeyframes[i] = resolved as T
                    }

                    if (i === unresolvedKeyframes.length - 1) {
                        this.finalKeyframe = keyframe as T
                    }
                }
            }
        }

        /**
         * Resolve "none" values. We do this potentially twice - once before and once after measuring keyframes.
         * This could be seen as inefficient but it's a trade-off to avoid measurements in more situations, which
         * have a far bigger performance impact.
         */
        this.resolveNoneKeyframes()

        /**
         * Check to see if unit type has changed. If so schedule jobs that will
         * temporarily set styles to the destination keyframes.
         * Skip if we have more than two keyframes or this isn't a positional value.
         * TODO: We can throw if there are multiple keyframes and the value type changes.
         */
        if (!positionalKeys.has(name) || unresolvedKeyframes.length !== 2) {
            return
        }

        const [origin, target] = unresolvedKeyframes
        const originType = findDimensionValueType(origin)
        const targetType = findDimensionValueType(target)

        /**
         * Either we don't recognise these value types or we can animate between them.
         */
        if (originType === targetType) return

        /**
         * If both values are numbers or pixels, we can animate between them by
         * converting them to numbers.
         */
        if (isNumOrPxType(originType) && isNumOrPxType(targetType)) {
            for (let i = 0; i < unresolvedKeyframes.length; i++) {
                const value = unresolvedKeyframes[i]
                if (typeof value === "string") {
                    unresolvedKeyframes[i] = parseFloat(value as string)
                }
            }
        } else if (positionalValues[name]) {
            /**
             * Else, the only way to resolve this is by measuring the element.
             */
            this.needsMeasurement = true
        }
    }

    resolveNoneKeyframes() {
        const { unresolvedKeyframes, name } = this

        const noneKeyframeIndexes: number[] = []
        for (let i = 0; i < unresolvedKeyframes.length; i++) {
            if (
                unresolvedKeyframes[i] === null ||
                isNone(unresolvedKeyframes[i])
            ) {
                noneKeyframeIndexes.push(i)
            }
        }

        if (noneKeyframeIndexes.length) {
            makeNoneKeyframesAnimatable(
                unresolvedKeyframes,
                noneKeyframeIndexes,
                name
            )
        }
    }

    measureInitialState() {
        const { element, unresolvedKeyframes, name } = this

        if (!element || !element.current) return

        if (name === "height") {
            this.suspendedScrollY = window.pageYOffset
        }

        this.measuredOrigin = positionalValues[name](
            element.measureViewportBox(),
            window.getComputedStyle(element.current)
        )

        unresolvedKeyframes[0] = this.measuredOrigin

        // Set final key frame to measure after next render
        const measureKeyframe =
            unresolvedKeyframes[unresolvedKeyframes.length - 1]

        if (measureKeyframe !== undefined) {
            element.getValue(name, measureKeyframe).jump(measureKeyframe, false)
        }
    }

    measureEndState() {
        const { element, name, unresolvedKeyframes } = this

        if (!element || !element.current) return

        const value = element.getValue(name)
        value && value.jump(this.measuredOrigin, false)

        const finalKeyframeIndex = unresolvedKeyframes.length - 1
        const finalKeyframe = unresolvedKeyframes[finalKeyframeIndex]

        unresolvedKeyframes[finalKeyframeIndex] = positionalValues[name](
            element.measureViewportBox(),
            window.getComputedStyle(element.current)
        ) as any

        if (finalKeyframe !== null && this.finalKeyframe === undefined) {
            this.finalKeyframe = finalKeyframe as T
        }

        // If we removed transform values, reapply them before the next render
        if (this.removedTransforms?.length) {
            this.removedTransforms.forEach(
                ([unsetTransformName, unsetTransformValue]) => {
                    element
                        .getValue(unsetTransformName)!
                        .set(unsetTransformValue)
                }
            )
        }

        this.resolveNoneKeyframes()
    }
}
