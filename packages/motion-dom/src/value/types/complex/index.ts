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

function getAnimatableNone(v: AnyResolvedKeyframe) {
    const info = analyseComplexValue(v)
    const transformer = buildTransformer(info)
    return transformer(
        info.values.map((value, i) => {
            if (typeof value === "number") {
                // Don't zero out divisors in calc() to avoid division by zero (NaN)
                if (info.split[i]?.trim().endsWith("/")) return value
                return 0
            }
            return convertNumbersToZero(value as string)
        })
    )
}

export const complex = {
    test,
    parse: parseComplexValue,
    createTransformer,
    getAnimatableNone,
}
