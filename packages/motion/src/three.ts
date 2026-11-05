import {
    createEffect,
    createLayoutPlane,
    frame,
    type LayoutPlane,
    type LayoutPlaneOptions,
    type LayoutPlaneSource,
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
            () => setObjectValue(subject, key, value.get())
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

export interface ThreeLayoutPlaneOptions extends LayoutPlaneOptions {
    /**
     * The camera the scene is rendered with.
     */
    camera: ThreeObject

    /**
     * The canvas the scene is rendered to.
     */
    canvas: Element

    /**
     * Called after Motion changes how the plane is drawn, for scenes that
     * only render on demand.
     */
    onRender?: VoidFunction
}

/**
 * Let a flat mesh, like a `PlaneGeometry`, take part in layout animations
 * with DOM elements. Elements and planes with the same `layoutId` animate
 * between each other, in and out of the 3D scene, with `animateLayout()`:
 *
 * ```ts
 * const plane = layoutPlane(mesh, {
 *     layoutId: "card",
 *     camera,
 *     canvas: renderer.domElement,
 *     visible: false,
 * })
 *
 * animateLayout(() => {
 *     card.remove()
 *     plane.show()
 * })
 * ```
 *
 * While it animates, the mesh is drawn with a world matrix that projects
 * it exactly where Motion places it, so render the scene in
 * `frame.render`. Lighting and fog are approximate until it lands.
 */
export function layoutPlane(
    mesh: ThreeObject,
    {
        camera,
        canvas,
        onRender,
        visible = mesh.visible,
        ...options
    }: ThreeLayoutPlaneOptions
): LayoutPlane {
    const Matrix4 = mesh.matrixWorld.constructor
    const viewProjection = new Matrix4()
    const local = new Matrix4()
    const clip = new Matrix4()
    const inverse = new Matrix4()

    const { geometry } = mesh
    geometry.boundingBox || geometry.computeBoundingBox()
    const { min, max } = geometry.boundingBox

    let left = 0
    let top = 0
    let width = 1
    let height = 1

    const { matrixWorldAutoUpdate, frustumCulled } = mesh
    let isProjected = false

    /**
     * The materials' own opacity and transparency, while Motion fades them.
     */
    let fading: Array<[ThreeObject, number, boolean]> | undefined

    /**
     * `clip`: from the mesh's local space, where it's laid out, to clip
     * space.
     */
    function updateClip() {
        mesh.matrixAutoUpdate
            ? local.compose(mesh.position, mesh.quaternion, mesh.scale)
            : local.copy(mesh.matrix)

        if (mesh.parent) {
            mesh.parent.updateWorldMatrix(true, false)
            local.premultiply(mesh.parent.matrixWorld)
        }

        camera.updateWorldMatrix(true, false)
        viewProjection.multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse
        )
        return clip.multiplyMatrices(viewProjection, local).elements
    }

    function project(out: Float64Array) {
        const e = updateClip()
        let isInFront = true

        for (let i = 0; i < 4; i++) {
            const x = i === 0 || i === 3 ? min.x : max.x
            const y = i < 2 ? max.y : min.y
            const w = e[3] * x + e[7] * y + e[15]
            if (w <= 0) isInFront = false
            out[i * 2] =
                left + (((e[0] * x + e[4] * y + e[12]) / w + 1) * width) / 2
            out[i * 2 + 1] =
                top + ((1 - (e[1] * x + e[5] * y + e[13]) / w) * height) / 2
        }

        return isInFront
    }

    function fade(opacity: number) {
        if (opacity < 1 && !fading) {
            const { material } = mesh
            fading = (Array.isArray(material) ? material : [material]).map(
                (m: ThreeObject) => [m, m.opacity, m.transparent]
            )
        }

        if (!fading) return

        for (let i = 0; i < fading.length; i++) {
            const [material, base, transparent] = fading[i]
            material.opacity = base * opacity
            material.transparent = transparent || opacity < 1
        }

        if (opacity >= 1) fading = undefined
    }

    const source: LayoutPlaneSource = {
        measure(out) {
            const rect = canvas.getBoundingClientRect()
            left = rect.left
            top = rect.top
            width = rect.width || 1
            height = rect.height || 1
            return project(out)
        },

        track: project,

        render(transform, opacity, isVisible) {
            mesh.visible = isVisible
            fade(isVisible ? opacity : 1)

            if (transform && isVisible) {
                const e = updateClip()

                /**
                 * Where the mesh would be drawn, so it keeps its depth
                 * among the rest of the scene.
                 */
                const cx = (min.x + max.x) / 2
                const cy = (min.y + max.y) / 2
                const cw = e[3] * cx + e[7] * cy + e[15]
                const depth =
                    cw > 0
                        ? Math.min(
                              0.999,
                              Math.max(
                                  -0.999,
                                  (e[2] * cx + e[6] * cy + e[14]) / cw
                              )
                          )
                        : 0

                /**
                 * From the viewport to normalised device coordinates, then
                 * through `transform`, from the mesh's local rect to the
                 * unit square.
                 */
                const sx = 2 / width
                const tx = -1 - left * sx
                const sy = -2 / height
                const ty = 1 - top * sy
                const t = transform

                const a0 = sx * t[0] + tx * t[6]
                const a1 = sx * t[1] + tx * t[7]
                const a2 = sx * t[2] + tx * t[8]
                const b0 = sy * t[3] + ty * t[6]
                const b1 = sy * t[4] + ty * t[7]
                const b2 = sy * t[5] + ty * t[8]
                const c0 = t[6]
                const c1 = t[7]
                const c2 = t[8]

                const w = max.x - min.x
                const h = max.y - min.y
                const u = -min.x / w
                const v = max.y / h

                const n00 = a0 / w
                const n01 = -a1 / h
                const n02 = a0 * u + a1 * v + a2
                const n10 = b0 / w
                const n11 = -b1 / h
                const n12 = b0 * u + b1 * v + b2
                const n20 = c0 / w
                const n21 = -c1 / h
                const n22 = c0 * u + c1 * v + c2

                /**
                 * Clip coordinates at a constant depth. The z column, which
                 * a flat mesh's vertices don't use, keeps the mesh's own
                 * axis so normals stay usable.
                 */
                clip.set(
                    n00,
                    n01,
                    e[8],
                    n02,
                    n10,
                    n11,
                    e[9],
                    n12,
                    depth * n20,
                    depth * n21,
                    e[10],
                    depth * n22,
                    n20,
                    n21,
                    e[11],
                    n22
                )

                mesh.matrixWorld.multiplyMatrices(
                    inverse.copy(viewProjection).invert(),
                    clip
                )
                mesh.matrixWorldAutoUpdate = false
                mesh.frustumCulled = false
                isProjected = true
            } else if (isProjected) {
                isProjected = false
                mesh.matrixWorldAutoUpdate = matrixWorldAutoUpdate
                mesh.frustumCulled = frustumCulled
                mesh.matrixWorldNeedsUpdate = true
            }

            onRender?.()
        },
    }

    return createLayoutPlane(source, { ...options, visible })
}
