import { AnyResolvedKeyframe } from "../../../animation/types"
import { CSSVariableToken } from "../../../animation/utils/is-css-variable"
import { color } from "../color"
import { Color } from "../types"
import { colorRegex } from "../utils/color-regex"
import { floatRegex } from "../utils/float-regex"
import { sanitize } from "../utils/sanitize"

function test(v: any) {
    return (
        isNaN(v) &&
        typeof v === "string" &&
        (v.match(floatRegex)?.length || 0) +
            (v.match(colorRegex)?.length || 0) >
            0
    )
}

const NUMBER_TOKEN = "number"
const COLOR_TOKEN = "color"
const VAR_TOKEN = "var"
const VAR_FUNCTION_TOKEN = "var("
const SPLIT_TOKEN = "${}"

export type ComplexValues = Array<
    CSSVariableToken | AnyResolvedKeyframe | Color
>

export interface ValueIndexes {
    color: number[]
    number: number[]
    var: number[]
}

export interface ComplexValueInfo {
    values: ComplexValues
    split: string[]
    indexes: ValueIndexes
    types: Array<keyof ValueIndexes>
}

// this regex consists of the `singleCssVariableRegex|rgbHSLValueRegex|digitRegex`
const complexRegex =
    /var\s*\(\s*--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)|#[\da-f]{3,8}|(?:rgb|hsl)a?\((?:-?[\d.]+%?[,\s]+){2}-?[\d.]+%?\s*(?:[,/]\s*)?(?:\b\d+(?:\.\d+)?|\.\d+)?%?\)|-?(?:\d+(?:\.\d+)?|\.\d+)/giu

export function analyseComplexValue(
    value: AnyResolvedKeyframe
): ComplexValueInfo {
    const originalValue = value.toString()

    const values: ComplexValues = []
    const indexes: ValueIndexes = {
        color: [],
        number: [],
        var: [],
    }
    const types: Array<keyof ValueIndexes> = []

    let i = 0
    const tokenised = originalValue.replace(complexRegex, (parsedValue) => {
        if (color.test(parsedValue)) {
            indexes.color.push(i)
            types.push(COLOR_TOKEN)
            values.push(color.parse(parsedValue))
        } else if (parsedValue.startsWith(VAR_FUNCTION_TOKEN)) {
            indexes.var.push(i)
            types.push(VAR_TOKEN)
            values.push(parsedValue)
        } else {
            indexes.number.push(i)
            types.push(NUMBER_TOKEN)
            values.push(parseFloat(parsedValue))
        }
        ++i
        return SPLIT_TOKEN
    })
    const split = tokenised.split(SPLIT_TOKEN)

    return { values, split, indexes, types }
}

function parseComplexValue(v: AnyResolvedKeyframe) {
    return analyseComplexValue(v).values
}

function buildTransformer({ split, types }: ComplexValueInfo) {
    const numSections = split.length
    return (v: Array<CSSVariableToken | Color | number | string>) => {
        let output = ""
        for (let i = 0; i < numSections; i++) {
            output += split[i]
            if (v[i] !== undefined) {
                const type = types[i]
                if (type === NUMBER_TOKEN) {
                    output += sanitize(v[i] as number)
                } else if (type === COLOR_TOKEN) {
                    output += color.transform(v[i] as Color)
                } else {
                    output += v[i]
                }
            }
        }

        return output
    }
}

function createTransformer(source: AnyResolvedKeyframe) {
    return buildTransformer(analyseComplexValue(source))
}

const convertNumbersToZero = (v: number | string) =>
    typeof v === "number" ? 0 : color.test(v) ? color.getAnimatableNone(v) : v

/**
 * Convert a parsed value to its zero equivalent, but preserve numbers
 * that act as divisors in CSS calc() expressions.
 *
 * analyseComplexValue extracts numbers from CSS strings and puts the
 * surrounding text into a `split` template array. For example:
 *   "calc(var(--gap) / 5)"  →  values: [var(--gap), 5]
 *                               split:  ["calc(", " / ", ")"]
 *
 * When building a zero-equivalent for animation, naively zeroing all
 * numbers turns the divisor into 0 → "calc(var(--gap) / 0)" → NaN.
 * We detect this by checking whether the text preceding a number
 * (split[i]) ends with "/" — the CSS calc division operator.
 */
const convertToZero = (
    value: ComplexValues[number],
    splitBefore: string
): ComplexValues[number] => {
    if (typeof value === "number") {
        return splitBefore?.trim().endsWith("/") ? value : 0
    }
    return convertNumbersToZero(value as string)
}

function getAnimatableNone(v: AnyResolvedKeyframe) {
    const info = analyseComplexValue(v)
    const transformer = buildTransformer(info)
    return transformer(
        info.values.map((value, i) => convertToZero(value, info.split[i]))
    )
}

export const complex = {
    test,
    parse: parseComplexValue,
    createTransformer,
    getAnimatableNone,
}
