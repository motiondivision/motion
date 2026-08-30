import type { MotionValue } from "framer-motion/dom"
import {
    createUniformEffect,
    type UniformEffectValues,
} from "./utils/create-uniform-effect"

export interface UniformEffectSubject<T extends object> {
    set(values: Partial<T>): unknown
}

export type { UniformEffectValues }

interface VGPUUniforms {
    set(values: Record<string, unknown>): unknown
}

const bindUniforms = createUniformEffect<VGPUUniforms>((uniforms, values) =>
    uniforms.set(values)
)

/**
 * Binds MotionValues to vgpu SharedUniforms, batching changed values into one
 * GPU write per frame.
 */
export function uniformEffect<T extends object>(
    subject: UniformEffectSubject<T>,
    values: UniformEffectValues<T>
): VoidFunction {
    return bindUniforms(
        subject as unknown as VGPUUniforms,
        values as Record<string, MotionValue | undefined>
    )
}
