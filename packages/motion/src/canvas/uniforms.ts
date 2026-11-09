import {
    color,
    hslaToRgba,
    isMotionValue,
    type MotionValue,
} from "framer-motion/dom"

type UniformPrimitive = number | boolean | string

/**
 * A value for a shader uniform. Numbers and colour strings become motion
 * values of the element, so `animate()` can animate them. Arrays (vectors
 * and matrices) can hold numbers or motion values, and a motion value can
 * hold any of these.
 */
export type CanvasUniform =
    | UniformPrimitive
    | ArrayLike<number | MotionValue<number>>
    | MotionValue<UniformPrimitive | ArrayLike<number>>

/**
 * Flatten a uniform's current value into numbers. Colours become 0-1
 * RGBA, so `"#f00"` is `[1, 0, 0, 1]`. They stay sRGB encoded, like the
 * element's texture, so the two mix as they would in CSS.
 */
export function resolveUniform(value: unknown, out: number[] = []) {
    out.length = 0
    flatten(value, out)
    return out
}

function flatten(value: unknown, out: number[]) {
    if (isMotionValue(value)) value = value.get()

    if (typeof value === "number") {
        out.push(value)
    } else if (typeof value === "boolean") {
        out.push(+value)
    } else if (typeof value === "string") {
        if (color.test(value)) {
            const parsed = color.parse(value)
            const {
                red,
                green,
                blue,
                alpha = 1,
            } = "hue" in parsed ? hslaToRgba(parsed) : parsed
            out.push(red / 255, green / 255, blue / 255, alpha)
        } else {
            out.push(parseFloat(value) || 0)
        }
    } else if (value && typeof value === "object" && "length" in value) {
        const list = value as ArrayLike<unknown>
        for (let i = 0; i < list.length; i++) flatten(list[i], out)
    }
}

/**
 * GLSL uniform types by WebGL enum: [components, setter, integer].
 */
const types: Record<number, [number, string, boolean?]> = {
    0x1406: [1, "uniform1fv"], // FLOAT
    0x8b50: [2, "uniform2fv"], // FLOAT_VEC2
    0x8b51: [3, "uniform3fv"], // FLOAT_VEC3
    0x8b52: [4, "uniform4fv"], // FLOAT_VEC4
    0x8b5a: [4, "uniformMatrix2fv"], // FLOAT_MAT2
    0x8b5b: [9, "uniformMatrix3fv"], // FLOAT_MAT3
    0x8b5c: [16, "uniformMatrix4fv"], // FLOAT_MAT4
    0x1404: [1, "uniform1iv", true], // INT
    0x8b53: [2, "uniform2iv", true], // INT_VEC2
    0x8b54: [3, "uniform3iv", true], // INT_VEC3
    0x8b55: [4, "uniform4iv", true], // INT_VEC4
    0x8b56: [1, "uniform1iv", true], // BOOL
    0x8b57: [2, "uniform2iv", true], // BOOL_VEC2
    0x8b58: [3, "uniform3iv", true], // BOOL_VEC3
    0x8b59: [4, "uniform4iv", true], // BOOL_VEC4
}

export interface UniformInfo {
    location: WebGLUniformLocation
    type: number
    size: number
}

/**
 * Whether a uniform of this type can be set from numbers. Samplers can't.
 */
export const isSettable = (type: number) => type in types

/**
 * Fit `values` to the uniform's declared size, padding with zeroes, so a
 * colour can feed a vec3 or a number a float.
 */
export function fitUniform(values: number[], { type, size }: UniformInfo) {
    const [components, , integer] = types[type]
    const length = components * size
    const data = integer ? new Int32Array(length) : new Float32Array(length)
    for (let i = 0; i < length && i < values.length; i++) {
        data[i] = integer ? Math.round(values[i]) : values[i]
    }
    return data
}

export function setUniform(
    gl: WebGL2RenderingContext,
    info: UniformInfo,
    value: unknown,
    scratch: number[]
) {
    const [, setter] = types[info.type]
    const data = fitUniform(resolveUniform(value, scratch), info)

    setter.startsWith("uniformMatrix")
        ? (gl as any)[setter](info.location, false, data)
        : (gl as any)[setter](info.location, data)
}
