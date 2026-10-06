import { independentTransformProperty } from "../html/utils/independent-transforms"
import { transformPropOrder } from "../utils/keys-transform"

const radToDeg = (rad: number) => (rad * 180) / Math.PI

type MatrixParser = (values: number[]) => number

type MatrixParsers = Record<
    (typeof transformPropOrder)[number],
    number | MatrixParser
>

const rotate = (v: number[]) => {
    const angle = radToDeg(Math.atan2(v[1], v[0]))
    return rebaseAngle(angle)
}

const matrix2dParsers: MatrixParsers = {
    x: 4,
    y: 5,
    translateX: 4,
    translateY: 5,
    scaleX: 0,
    scaleY: 3,
    scale: (v) => (Math.abs(v[0]) + Math.abs(v[3])) / 2,
    rotate,
    rotateZ: rotate,
    skewX: (v) => radToDeg(Math.atan(v[1])),
    skewY: (v) => radToDeg(Math.atan(v[2])),
    skew: (v) => (Math.abs(v[1]) + Math.abs(v[2])) / 2,
} as const

const rebaseAngle = (angle: number) => {
    angle = angle % 360
    if (angle < 0) angle += 360
    return angle
}

const rotateZ = rotate

const scaleX = (v: number[]) => Math.sqrt(v[0] * v[0] + v[1] * v[1])
const scaleY = (v: number[]) => Math.sqrt(v[4] * v[4] + v[5] * v[5])

const matrix3dParsers: MatrixParsers = {
    x: 12,
    y: 13,
    z: 14,
    translateX: 12,
    translateY: 13,
    translateZ: 14,
    scaleX,
    scaleY,
    scale: (v) => (scaleX(v) + scaleY(v)) / 2,
    rotateX: (v) => rebaseAngle(radToDeg(Math.atan2(v[6], v[5]))),
    rotateY: (v) => rebaseAngle(radToDeg(Math.atan2(-v[2], v[0]))),
    rotateZ,
    rotate: rotateZ,
    skewX: (v) => radToDeg(Math.atan(v[4])),
    skewY: (v) => radToDeg(Math.atan(v[1])),
    skew: (v) => (Math.abs(v[1]) + Math.abs(v[4])) / 2,
} as const

export function defaultTransformValue(name: string): number {
    return name.includes("scale") ? 1 : 0
}

export function parseValueFromTransform(
    transform: string | undefined,
    name: string
): number {
    if (!transform || transform === "none") {
        return defaultTransformValue(name)
    }

    const matrix3dMatch = transform.match(/^matrix3d\(([-\d.e\s,]+)\)$/u)

    let parsers: MatrixParsers
    let match: RegExpMatchArray | null

    if (matrix3dMatch) {
        parsers = matrix3dParsers
        match = matrix3dMatch
    } else {
        const matrix2dMatch = transform.match(/^matrix\(([-\d.e\s,]+)\)$/u)

        parsers = matrix2dParsers
        match = matrix2dMatch
    }

    if (!match) {
        return defaultTransformValue(name)
    }

    const valueParser = parsers[name]
    const values = match[1].split(",").map(convertTransformToNumber)

    return typeof valueParser === "function"
        ? valueParser(values)
        : values[valueParser]
}

const individualIndex: Record<string, number> = {
    x: 0,
    y: 1,
    z: 2,
    scale: 0,
    scaleX: 0,
    scaleY: 1,
}

/**
 * Read a transform value from the individual translate, scale and rotate
 * properties. Returns undefined when the property isn't set so the caller
 * can fall back to parsing the transform matrix.
 */
export function parseIndividualTransform(
    computed: CSSStyleDeclaration,
    name: string
): number | undefined {
    const property = independentTransformProperty[name]
    const value = property && computed[property]

    if (!value || value === "none") return undefined

    const parts = value.split(" ")

    if (property === "rotate") {
        return parts.length > 1
            ? defaultTransformValue(name)
            : parseFloat(value)
    }

    const part =
        parts[individualIndex[name]] ?? (name === "scaleY" ? parts[0] : "0")

    return parseFloat(part)
}

export const readTransformValue = (instance: HTMLElement, name: string) => {
    const computed = getComputedStyle(instance)
    return (
        parseIndividualTransform(computed, name) ??
        parseValueFromTransform(computed.transform || "none", name)
    )
}

function convertTransformToNumber(value: string): number {
    return parseFloat(value.trim())
}
