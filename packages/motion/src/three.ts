import type { MotionValue } from "framer-motion/dom"
import {
    createUniformEffect,
    type UniformEffectValues,
} from "./utils/create-uniform-effect"

export interface ThreeUniform<T = unknown> {
    value: T
}

export type ThreeUniforms<T extends object> = {
    [K in keyof T]: ThreeUniform<T[K]>
}

export type { UniformEffectValues }

type Uniforms = Record<string, ThreeUniform>

const bindUniforms = createUniformEffect<Uniforms>((uniforms, values) => {
    for (const key in values) {
        uniforms[key].value = values[key]
    }
})

/**
 * Binds MotionValues to a Three.js uniforms object.
 */
export function uniformEffect<T extends object>(
    uniforms: ThreeUniforms<T>,
    values: UniformEffectValues<T>
): VoidFunction {
    return bindUniforms(
        uniforms as Uniforms,
        values as Record<string, MotionValue | undefined>
    )
}
