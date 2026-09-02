import {
    createEffect,
    frame,
    type MotionValue,
    type MotionValueState,
} from "framer-motion/dom"

export interface ThreeUniform<T = unknown> {
    value: T
}

export type ThreeUniforms<T extends object> = {
    [K in keyof T]: ThreeUniform<T[K]>
}

export type ThreeEffectValues = Record<string, MotionValue>

type Uniforms = Record<string, ThreeUniform>
type ThreeObject = Record<string, any>

/**
 * Binds motion values to Three.js objects, materials and uniforms.
 *
 * Register with `animate.addEffect(threeEffect)` so `animate()` can target
 * meshes, lights, cameras, materials and uniforms directly, or call it
 * yourself to wire up existing motion values:
 *
 * ```ts
 * threeEffect(mesh, { x, rotateY, color })
 * threeEffect(uniforms, { progress })
 * ```
 *
 * Writes happen once per frame in `frame.preRender`, ahead of render loops
 * scheduled with `frame.render`.
 */
export const threeEffect = createEffect<ThreeObject>(
    (subject, state: MotionValueState, key, value) =>
        state.set(
            key,
            value,
            () => setObjectValue(subject, key, state.latest[key]),
            undefined,
            false
        ),
    {
        test: isThreeSubject,
        read: getObjectValue,
        step: frame.preRender,
    }
)

/**
 * Claims Three.js objects, materials and uniforms objects. Vectors, colors
 * and Eulers aren't claimed so `animate(mesh.position, { x })` keeps working
 * as a plain object animation.
 */
function isThreeSubject(subject: unknown): subject is ThreeObject {
    if (!subject || typeof subject !== "object") return false

    const object = subject as ThreeObject

    return Boolean(object.isObject3D || object.isMaterial || isUniforms(object))
}

function isUniforms(object: ThreeObject): object is Uniforms {
    const keys = Object.keys(object)
    return keys.length > 0 && keys.every((key) => isUniform(object[key]))
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

function getObjectValue(object: ThreeObject, key: string) {
    if (isUniform(object[key])) return getAnimatableValue(object[key].value)

    const transform = transformMap[key as keyof typeof transformMap]

    if (transform) {
        const [name, axis] = transform
        const value = object[name]?.[axis]
        return key.startsWith("rotate") && typeof value === "number"
            ? value * (180 / Math.PI)
            : getAnimatableValue(value)
    }

    if (key === "scale") {
        return getAnimatableValue(object.scale?.x)
    }

    const node = getNodeUniform(object, key)
    if (node) return getAnimatableValue(node.value)

    const uniforms = getUniforms(object)

    return (
        getProperty(object, key) ??
        getProperty(object.material, key) ??
        getUniformValue(uniforms, key) ??
        getVectorComponent(object, key) ??
        getVectorComponent(object.material, key) ??
        getUniformComponent(uniforms, key) ??
        getUniformComponent(object, key)
    )
}

/**
 * Uniforms live on ShaderMaterials, on the mesh itself or the subject can
 * be a bare uniforms object.
 */
function getUniforms(object: ThreeObject): Uniforms | undefined {
    return object.material?.uniforms ?? object.uniforms
}

/**
 * Resolves TSL uniform nodes assigned to node material slots, e.g.
 * material.colorNode = uniform(color). Non-uniform nodes are compiled
 * into the shader so can't be animated via their value.
 */
function getNodeUniform(object: ThreeObject, key: string) {
    const node = object[key + "Node"] ?? object.material?.[key + "Node"]
    return node?.isUniformNode ? (node as ThreeUniform) : undefined
}

function getProperty(target: ThreeObject | undefined, key: string) {
    return target && key in target ? getAnimatableValue(target[key]) : undefined
}

function getUniformValue(uniforms: Uniforms | undefined, key: string) {
    return getAnimatableValue(uniforms?.[key]?.value)
}

function getVectorComponent(target: ThreeObject | undefined, key: string) {
    const axis = key.slice(-1).toLowerCase()
    const vector = target?.[key.slice(0, -1)]
    return vector && ["x", "y", "z", "w"].includes(axis)
        ? getAnimatableValue(vector[axis])
        : undefined
}

function getUniformComponent(uniforms: ThreeObject | undefined, key: string) {
    const uniform = uniforms?.[key.slice(0, -1)]
    return isUniform(uniform)
        ? getVectorComponent(uniform, `value${key.slice(-1)}`)
        : undefined
}

function getAnimatableValue(value: unknown) {
    if (typeof value === "string" || typeof value === "number") return value

    return value && typeof (value as ThreeObject).getStyle === "function"
        ? (value as ThreeObject).getStyle()
        : undefined
}

function isUniform(value: unknown): value is ThreeUniform {
    return Boolean(value && typeof value === "object" && "value" in value)
}

function setObjectValue(object: ThreeObject, key: string, value: unknown) {
    if (isUniform(object[key])) {
        setProperty(object[key], "value", value)
        return
    }

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

    const node = getNodeUniform(object, key)
    if (node) {
        setProperty(node, "value", value)
        return
    }

    if (setProperty(object, key, value)) return

    const material = object.material
    if (setProperty(material, key, value)) return

    const uniforms = getUniforms(object)
    const uniform = uniforms?.[key]

    if (uniform) {
        setProperty(uniform, "value", value)
        return
    }

    if (
        setVectorComponent(object, key, value) ||
        setVectorComponent(material, key, value) ||
        setUniformComponent(uniforms, key, value) ||
        setUniformComponent(object, key, value)
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
    uniforms: ThreeObject | undefined,
    key: string,
    value: unknown
) {
    const uniform = uniforms?.[key.slice(0, -1)]
    return isUniform(uniform)
        ? setVectorComponent(uniform, `value${key.slice(-1)}`, value)
        : false
}
