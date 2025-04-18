import { pipe, warning } from "motion-utils"
import { isCSSVariableToken } from "../../animation/utils/is-css-variable"
import { color } from "../../value/types/color"
import {
    analyseComplexValue,
    complex,
    ComplexValueInfo,
    ComplexValues,
} from "../../value/types/complex"
import { HSLA, RGBA } from "../../value/types/types"
import { mixColor } from "./color"
import { mixImmediate } from "./immediate"
import { mixNumber as mixNumberImmediate } from "./number"
import { invisibleValues, mixVisibility } from "./visibility"

type MixableArray = Array<number | RGBA | HSLA | string>
type MixableObject = {
    [key: string]: string | number | RGBA | HSLA
}

function mixNumber(a: number, b: number) {
    return (p: number) => mixNumberImmediate(a, b, p)
}

export function getMixer<T>(a: T) {
    if (typeof a === "number") {
        return mixNumber
    } else if (typeof a === "string") {
        return isCSSVariableToken(a)
            ? mixImmediate
            : color.test(a)
            ? mixColor
            : mixComplex
    } else if (Array.isArray(a)) {
        return mixArray
    } else if (typeof a === "object") {
        return color.test(a) ? mixColor : mixObject
    }

    return mixImmediate
}

export function mixArray(a: MixableArray, b: MixableArray) {
    const output = [...a]
    const numValues = output.length

    const blendValue = a.map((v, i) => getMixer(v)(v as any, b[i] as any))

    return (p: number) => {
        for (let i = 0; i < numValues; i++) {
            output[i] = blendValue[i](p) as any
        }
        return output
    }
}

export function mixObject(a: MixableObject, b: MixableObject) {
    const output = { ...a, ...b }
    const blendValue: { [key: string]: (v: number) => any } = {}

    for (const key in output) {
        if (a[key] !== undefined && b[key] !== undefined) {
            blendValue[key] = getMixer(a[key])(
                a[key] as any,
                b[key] as any
            ) as any
        }
    }

    return (v: number) => {
        for (const key in blendValue) {
            output[key] = blendValue[key](v)
        }
        return output
    }
}

function matchOrder(
    origin: ComplexValueInfo,
    target: ComplexValueInfo
): ComplexValues {
    const orderedOrigin: ComplexValues = []

    const pointers = { color: 0, var: 0, number: 0 }

    for (let i = 0; i < target.values.length; i++) {
        const type = target.types[i]
        const originIndex = origin.indexes[type][pointers[type]]
        const originValue = origin.values[originIndex] ?? 0

        orderedOrigin[i] = originValue

        pointers[type]++
    }

    return orderedOrigin
}

export const mixComplex = (
    origin: string | number,
    target: string | number
) => {
    const template = complex.createTransformer(target)
    const originStats = analyseComplexValue(origin)
    const targetStats = analyseComplexValue(target)
    const canInterpolate =
        originStats.indexes.var.length === targetStats.indexes.var.length &&
        originStats.indexes.color.length === targetStats.indexes.color.length &&
        originStats.indexes.number.length >= targetStats.indexes.number.length

    if (canInterpolate) {
        if (
            (invisibleValues.has(origin as string) &&
                !targetStats.values.length) ||
            (invisibleValues.has(target as string) &&
                !originStats.values.length)
        ) {
            return mixVisibility(origin as string, target as string)
        }

        return pipe(
            mixArray(matchOrder(originStats, targetStats), targetStats.values),
            template
        )
    } else {
        warning(
            true,
            `Complex values '${origin}' and '${target}' too different to mix. Ensure all colors are of the same type, and that each contains the same quantity of number and color values. Falling back to instant transition.`
        )

        return mixImmediate(origin, target)
    }
}
