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
 * WGSL host-shareable types: [align, size, columns, rows], all in bytes
 * and components.
 */
const types: Record<string, [number, number, number, number]> = {
    "32": [4, 4, 1, 1],
    vec2: [8, 8, 1, 2],
    vec3: [16, 12, 1, 3],
    vec4: [16, 16, 1, 4],
    mat2x2: [8, 16, 2, 2],
    mat3x3: [16, 48, 3, 3],
    mat4x4: [16, 64, 4, 4],
}

export interface UniformInfo {
    /**
     * Byte offset in the uniform buffer.
     */
    offset: number
    columns: number
    rows: number
    integer: boolean
}

export interface UniformLayout {
    members: Map<string, UniformInfo>
    /**
     * Size of the buffer in bytes.
     */
    size: number
}

const roundUp = (value: number, to: number) => Math.ceil(value / to) * to

/**
 * Read the members of the shader's `struct Uniforms`, with the offsets
 * WGSL lays them out at. WebGPU has no way to ask a shader for these.
 */
export function parseUniforms(shader: string): UniformLayout | undefined {
    const body = shader
        .replace(/\/\/.*|\/\*[^]*?\*\//g, "")
        .match(/struct\s+Uniforms\s*\{([^}]*)\}/)?.[1]
    if (!body) return

    const members = new Map<string, UniformInfo>()
    let offset = 0

    for (const [, name, declared] of body.matchAll(
        /(\w+)\s*:\s*([\w<>\s]+)/g
    )) {
        // vec3<f32> and vec3f are the same type
        const [, shape, kind] =
            declared.replace(/\s/g, "").match(/^(\w*?)<?([fiu])(?:32)?>?$/) ||
            []
        const type = types[shape || "32"]
        if (!type) continue

        const [align, size, columns, rows] = type
        offset = roundUp(offset, align)
        members.set(name, { offset, columns, rows, integer: kind !== "f" })
        offset += size
    }

    return { members, size: roundUp(offset, 16) }
}

/**
 * Write `value` into the uniform buffer's data, padded with zeroes to the
 * member's size, so a colour can feed a vec3 or a number a float.
 */
export function writeUniform(
    floats: Float32Array,
    ints: Int32Array,
    { offset, columns, rows, integer }: UniformInfo,
    value: unknown,
    scratch: number[]
) {
    const values = resolveUniform(value, scratch)
    // Columns of three are padded to four
    const stride = rows === 3 ? 4 : rows

    for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows; row++) {
            const number = values[column * rows + row] || 0
            const index = offset / 4 + column * stride + row
            integer
                ? (ints[index] = Math.round(number))
                : (floats[index] = number)
        }
    }
}
