import type { Box } from "motion-utils"
import { parseValueFromTransform } from "../../../render/dom/parse-transform"
import { transformPropOrder } from "../../../render/utils/keys-transform"
import { MotionValue } from "../../../value"
import { number } from "../../../value/types/numbers"
import { px } from "../../../value/types/numbers/units"
import { ValueType } from "../../../value/types/types"
import { AnyResolvedKeyframe } from "../../types"
import { WithRender } from "../types"

export const isNumOrPxType = (v?: ValueType): v is ValueType =>
    v === number || v === px

/**
 * Measures a positional value in pixels from an element's computed style.
 * The bounding box is only measured on demand as it forces layout and is
 * affected by transforms.
 */
type GetActualMeasurementInPixels = (
    computedStyle: Partial<CSSStyleDeclaration>,
    measureBox: () => Box
) => number

const transformKeys = new Set(["x", "y", "z"])
const nonTranslationalTransformKeys = transformPropOrder.filter(
    (key) => !transformKeys.has(key)
)

type RemovedTransforms = [string, AnyResolvedKeyframe][]

/**
 * Reset any bounding box-changing transforms so the element can be
 * measured. Returns the values to restore. Values already at their
 * default don't change the box, so they're left alone: an element with
 * only `rotate: 0` doesn't need to be re-rendered before measuring.
 */
export function removeNonTranslationalTransform(visualElement: WithRender) {
    const removedTransforms: RemovedTransforms = []

    nonTranslationalTransformKeys.forEach((key) => {
        const value: MotionValue<AnyResolvedKeyframe> | undefined =
            visualElement.getValue(key)
        if (value !== undefined) {
            const current = value.get()
            const reset = key.startsWith("scale") ? 1 : 0

            if (current === reset) return

            removedTransforms.push([key, current])
            value.set(reset)
        }
    })

    return removedTransforms
}

/**
 * Values that can only be measured from the bounding box. Elements with
 * these values need bounding box-changing transforms removed first.
 */
export const boxDependentValues = new Set(["bottom", "right"])

/**
 * The used value of width/height is already in pixels and unaffected by
 * transforms. It's "auto" for elements without a layout box (e.g. inline),
 * in which case we fall back to measuring the bounding box.
 */
function usedLength(
    length: string | undefined,
    measureBox: () => Box,
    axis: "x" | "y",
    paddingStart: string,
    paddingEnd: string,
    boxSizing?: string
) {
    const used = parseFloat(length as string)
    if (!isNaN(used)) return used

    const { min, max } = measureBox()[axis]
    const size = max - min
    return boxSizing === "border-box"
        ? size
        : size - parseFloat(paddingStart) - parseFloat(paddingEnd)
}

export const positionalValues: { [key: string]: GetActualMeasurementInPixels } =
    {
        // Dimensions
        width: (
            { width, paddingLeft = "0", paddingRight = "0", boxSizing },
            measureBox
        ) =>
            usedLength(
                width,
                measureBox,
                "x",
                paddingLeft,
                paddingRight,
                boxSizing
            ),
        height: (
            { height, paddingTop = "0", paddingBottom = "0", boxSizing },
            measureBox
        ) =>
            usedLength(
                height,
                measureBox,
                "y",
                paddingTop,
                paddingBottom,
                boxSizing
            ),

        top: ({ top }) => parseFloat(top as string),
        left: ({ left }) => parseFloat(left as string),
        bottom: ({ top }, measureBox) => {
            const { y } = measureBox()
            return parseFloat(top as string) + (y.max - y.min)
        },
        right: ({ left }, measureBox) => {
            const { x } = measureBox()
            return parseFloat(left as string) + (x.max - x.min)
        },

        // Transform
        x: ({ transform }) => parseValueFromTransform(transform, "x"),
        y: ({ transform }) => parseValueFromTransform(transform, "y"),
    }

// Alias translate longform names
positionalValues.translateX = positionalValues.x
positionalValues.translateY = positionalValues.y
