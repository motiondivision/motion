import type { Box } from "../../../projection/geometry/types"
import { MotionValue } from "../../../value"
import { number } from "../../../value/types/numbers"
import { px } from "../../../value/types/numbers/units"
import { ValueType } from "../../../value/types/types"
import { transformPropOrder } from "../../html/utils/keys-transform"
import type { VisualElement } from "../../VisualElement"

export const isNumOrPxType = (v?: ValueType): v is ValueType =>
    v === number || v === px

type GetActualMeasurementInPixels = (
    bbox: Box,
    computedStyle: Partial<CSSStyleDeclaration>
) => number

const getPosFromMatrix = (matrix: string, pos: number) =>
    parseFloat(matrix.split(", ")[pos])

const getTranslateFromMatrix =
    (pos2: number, pos3: number): GetActualMeasurementInPixels =>
    (_bbox, { transform }) => {
        if (transform === "none" || !transform) return 0

        const matrix3d = transform.match(/^matrix3d\((.+)\)$/u)

        if (matrix3d) {
            return getPosFromMatrix(matrix3d[1], pos3)
        } else {
            const matrix = transform.match(/^matrix\((.+)\)$/u) as string[]
            if (matrix) {
                return getPosFromMatrix(matrix[1], pos2)
            } else {
                return 0
            }
        }
    }

const transformKeys = new Set(["x", "y", "z"])
const nonTranslationalTransformKeys = transformPropOrder.filter(
    (key) => !transformKeys.has(key)
)

type RemovedTransforms = [string, string | number][]
export function removeNonTranslationalTransform(visualElement: VisualElement) {
    const removedTransforms: RemovedTransforms = []

    nonTranslationalTransformKeys.forEach((key) => {
        const value: MotionValue<string | number> | undefined =
            visualElement.getValue(key)
        if (value !== undefined) {
            removedTransforms.push([key, value.get()])
            value.set(key.startsWith("scale") ? 1 : 0)
        }
    })

    return removedTransforms
}

export const positionalValues: { [key: string]: GetActualMeasurementInPixels } =
    {
        // Dimensions
        width: ({ x }, { paddingLeft = "0", paddingRight = "0" }) =>
            x.max - x.min - parseFloat(paddingLeft) - parseFloat(paddingRight),
        height: ({ y }, { paddingTop = "0", paddingBottom = "0" }) =>
            y.max - y.min - parseFloat(paddingTop) - parseFloat(paddingBottom),

        top: (_bbox, { top }) => parseFloat(top as string),
        left: (_bbox, { left }) => parseFloat(left as string),
        bottom: ({ y }, { top }) => parseFloat(top as string) + (y.max - y.min),
        right: ({ x }, { left }) =>
            parseFloat(left as string) + (x.max - x.min),

        // Transform
        x: getTranslateFromMatrix(4, 13),
        y: getTranslateFromMatrix(5, 14),
    }

// Alias translate longform names
positionalValues.translateX = positionalValues.x
positionalValues.translateY = positionalValues.y
