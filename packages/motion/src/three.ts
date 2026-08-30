import {
    type AnimationOptions,
    type AnimationPlaybackControlsWithThen,
    type MotionValue,
} from "framer-motion/dom"
import { createEffectAdapter, createEffectAnimate } from "./utils/create-effect"

export interface ThreeUniform<T = unknown> {
    value: T
}

export type ThreeUniforms<T extends object> = {
    [K in keyof T]: ThreeUniform<T[K]>
}

export type UniformEffectValues<T extends object> = {
    [K in keyof T]?: MotionValue
}

export type UniformAnimationTarget<T extends object> = {
    [K in keyof T]?: string | number | Array<string | number | null>
}

export interface ObjectEffectValues {
    [key: string]: MotionValue | undefined
}

export interface ObjectAnimationTarget {
    [key: string]: string | number | Array<string | number | null> | undefined
}

type Uniforms = Record<string, ThreeUniform>
type ThreeObject = Record<string, any>

const uniformAdapter = createEffectAdapter<Uniforms>((uniforms, values) => {
    for (const key in values) {
        setProperty(uniforms[key], "value", values[key])
    }
})
const objectAdapter = createEffectAdapter<ThreeObject>(setObjectValues)
const animateEffect = createEffectAnimate(
    [uniformAdapter, objectAdapter],
    "Three.js uniform or object"
)

/**
 * Binds MotionValues to a Three.js uniforms object.
 */
export function uniformEffect<T extends object>(
    uniforms: ThreeUniforms<T>,
    values: UniformEffectValues<T>
): VoidFunction {
    return uniformAdapter.effect(
        uniforms as Uniforms,
        values as Record<string, MotionValue | undefined>
    )
}

/**
 * Binds MotionValues to flattened Three.js object properties.
 */
export function objectEffect(
    object: object,
    values: ObjectEffectValues
): VoidFunction {
    return objectAdapter.effect(object as ThreeObject, values)
}

/**
 * Animates MotionValues registered with a Three.js uniform or object effect.
 */
export function animate<T extends object>(
    subject: ThreeUniforms<T>,
    keyframes: UniformAnimationTarget<T>,
    options?: AnimationOptions
): AnimationPlaybackControlsWithThen
export function animate(
    subject: object,
    keyframes: ObjectAnimationTarget,
    options?: AnimationOptions
): AnimationPlaybackControlsWithThen
export function animate(
    subject: object,
    keyframes: ObjectAnimationTarget,
    options?: AnimationOptions
): AnimationPlaybackControlsWithThen {
    return animateEffect(subject, keyframes, options)
}

const transformMap = {
    x: ["position", "x"],
    y: ["position", "y"],
    z: ["position", "z"],
    rotateX: ["rotation", "x"],
    rotateY: ["rotation", "y"],
    rotateZ: ["rotation", "z"],
    scaleX: ["scale", "x"],
    scaleY: ["scale", "y"],
    scaleZ: ["scale", "z"],
} as const

function setObjectValues(object: ThreeObject, values: Record<string, unknown>) {
    for (const key in values) {
        setObjectValue(object, key, values[key])
    }
}

function setObjectValue(object: ThreeObject, key: string, value: unknown) {
    const transform = transformMap[key as keyof typeof transformMap]

    if (transform) {
        const [name, axis] = transform
        object[name][axis] = key.startsWith("rotate")
            ? (value as number) * (Math.PI / 180)
            : value
        return
    }

    if (key === "scale") {
        object.scale.x = object.scale.y = object.scale.z = value
        return
    }

    if (setProperty(object, key, value)) return

    const material = object.material
    if (setProperty(material, key, value)) return

    const uniforms = material?.uniforms ?? object.uniforms
    const uniform = uniforms?.[key]

    if (uniform) {
        setProperty(uniform, "value", value)
        return
    }

    if (
        setVectorComponent(object, key, value) ||
        setVectorComponent(material, key, value) ||
        setUniformComponent(uniforms, key, value)
    ) {
        return
    }

    object[key] = value
}

function setProperty(
    target: ThreeObject | undefined,
    key: string,
    value: unknown
) {
    if (!target || !(key in target)) return false

    const current = target[key]

    if (current && typeof current.set === "function") {
        Array.isArray(value) ? current.set(...value) : current.set(value)
    } else {
        target[key] = value
    }

    return true
}

function setVectorComponent(
    target: ThreeObject | undefined,
    key: string,
    value: unknown
) {
    const axis = key.slice(-1).toLowerCase()
    const vector = target?.[key.slice(0, -1)]

    if (!vector || !["x", "y", "z", "w"].includes(axis)) return false

    vector[axis] = value
    return true
}

function setUniformComponent(
    uniforms: Uniforms | undefined,
    key: string,
    value: unknown
) {
    const uniform = uniforms?.[key.slice(0, -1)]
    return uniform
        ? setVectorComponent(
              { value: uniform.value },
              `value${key.slice(-1)}`,
              value
          )
        : false
}
