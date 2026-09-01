import {
    type AnimationOptions,
    type AnimationPlaybackControlsWithThen,
    type MotionValue,
} from "framer-motion/dom"
import {
    createEffectAdapter,
    createEffectAnimate,
    type EffectAnimationTarget,
    type EffectValues,
} from "./utils/create-effect"

export interface UniformEffectSubject<T extends object> {
    set(values: Partial<T>): unknown
}

export type UniformEffectValues<T extends object> = EffectValues<T>
export type UniformAnimationTarget<T extends object> = EffectAnimationTarget<T>

interface VGPUUniforms {
    set(values: Record<string, unknown>): unknown
}

const uniformAdapter = createEffectAdapter<VGPUUniforms>((uniforms, values) =>
    uniforms.set(values)
)
const animateEffect = createEffectAnimate(
    [uniformAdapter],
    "vgpu uniform",
    (_subject, _key, target, adapter) => {
        const initial = Array.isArray(target) ? target[0] : undefined
        return typeof initial === "string" || typeof initial === "number"
            ? { adapter: adapter ?? uniformAdapter, initial }
            : undefined
    }
)

/**
 * Binds MotionValues to vgpu SharedUniforms, batching changed values into one
 * GPU write per frame.
 */
export function uniformEffect<T extends object>(
    subject: UniformEffectSubject<T>,
    values: UniformEffectValues<T>
): VoidFunction {
    return uniformAdapter.effect(
        subject as unknown as VGPUUniforms,
        values as Record<string, MotionValue | undefined>
    )
}

/**
 * Animates vgpu uniforms. Unregistered uniforms require explicit keyframes.
 */
export function animate<T extends object>(
    subject: UniformEffectSubject<T>,
    keyframes: UniformAnimationTarget<T>,
    options?: AnimationOptions
): AnimationPlaybackControlsWithThen {
    return animateEffect<T>(subject, keyframes, options)
}
