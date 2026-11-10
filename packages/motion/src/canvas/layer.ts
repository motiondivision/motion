import {
    handOffElementState,
    isMotionValue,
    SubscriptionManager,
    time,
    visualElementStore,
    type MotionValue,
    type VisualElement,
} from "framer-motion/dom"
import {
    blurSamples,
    mixPose,
    poseMatrix,
    poseTransform,
    poseTravel,
    readPose,
    sweptBounds,
    type Camera,
    type CanvasPose,
    type CanvasPoseKey,
} from "./pose"
import {
    blurFormat,
    createRenderer,
    hasWebGPU,
    instanceSize,
    mapFormat,
    onDeviceLost,
    requestDevice,
    type GPU,
    type Program,
    type Renderer,
} from "./gpu"
import {
    parseUniforms,
    writeUniform,
    type CanvasUniform,
    type UniformLayout,
} from "./uniforms"
import { CanvasVisualElement } from "./visual-element"
import type { FXShader } from "./effects"

export interface CanvasLayerOptions {
    /**
     * How long the shutter stays open, from `0` (no motion blur) to `1`
     * (the whole frame). A moving element is drawn as the average of its
     * poses over this part of the last frame. Elements at rest are drawn
     * once, sharp. Defaults to `0`.
     */
    motionBlur?: number

    /**
     * The most sub-frame poses averaged for one blurred element. Fewer
     * are used for short moves. Defaults to `24`.
     */
    samples?: number

    /**
     * How far the viewer is from the canvas, in CSS pixels, as the CSS
     * `perspective` property. Elements with `z`, `rotateX` or `rotateY`
     * are then drawn in 3D, the nearest last, and `project()` in a shader
     * uses it. Defaults to `0`, which is none.
     */
    perspective?: number

    /**
     * Shaders run in order on everything the layer has drawn. See
     * `setShaders()`.
     */
    shaders?: FXShader[]
}

export type CanvasPoseValues = {
    [K in CanvasPoseKey]?: number | MotionValue<number>
}

export interface CanvasElementOptions extends CanvasPoseValues {
    /**
     * Where the element's layout box is in the canvas, in CSS pixels.
     * `x` and `y` move it from there, as a CSS transform would. Call
     * `add()` again to change them.
     */
    left?: number
    top?: number

    /**
     * WGSL with a function, `fn effect(uv: vec2f) -> vec4f`, that returns
     * the premultiplied colour of the element at `uv` (0-1, from its
     * top-left corner). It can read the element with `element(uv)`, its
     * size in CSS pixels as `layer.size`, the time in seconds as
     * `layer.time`, and the members of a `struct Uniforms` it declares
     * as `uniforms.name`. If it fails to compile, the element is drawn
     * without it.
     */
    shader?: string

    /**
     * Values for the members of the shader's `Uniforms`. Numbers and colours
     * become values of the element, so `animate(element, { progress: 1 })`
     * animates them. Motion values and arrays (which can hold motion
     * values) are read each frame.
     */
    uniforms?: Record<string, CanvasUniform>

    /**
     * Overrides the layer's `motionBlur` for this element.
     */
    motionBlur?: number

    /**
     * Another element of the layer that this one moves with, as if it
     * were inside it: the group's transform is applied after this
     * element's own. The group can have no size, to be drawn as nothing.
     */
    group?: HTMLElement | null
}

export interface CanvasLayer {
    readonly canvas: HTMLCanvasElement

    /**
     * Whether the browser can draw HTML in a canvas with WebGPU. Without
     * it, the layer does nothing and the canvas' children stay fallback
     * content. It becomes `false` if the GPU device can't be made or is
     * lost.
     */
    readonly supported: boolean

    /**
     * Resolves once the layer can draw, with `false` if it never will.
     * Getting a GPU device takes a few frames.
     */
    readonly ready: Promise<boolean>

    /**
     * Called if the layer stops drawing because the GPU device was lost.
     * Its elements are left with their last transform and opacity as
     * styles, ready to be displayed as normal DOM.
     */
    onLost(callback: VoidFunction): VoidFunction

    motionBlur: number

    samples: number

    perspective: number

    /**
     * Draw `element`, a child of the canvas (it's appended if it isn't
     * one, or slotted into it), with Motion values. `animate()` and `drag()` then animate those
     * values instead of the element's style. Elements are drawn in DOM
     * order, as they're stacked for hit testing.
     */
    add(element: HTMLElement, options?: CanvasElementOptions): void

    /**
     * Stop drawing `element`.
     */
    remove(element: HTMLElement): void

    has(element: Element): boolean

    /**
     * Run these shaders, in order, on everything the layer has drawn.
     * Each one reads the result of the one before it with `element(uv)`.
     * A `motionBlur()` entry sets the layer's motion blur instead.
     */
    setShaders(shaders?: FXShader[]): void

    /**
     * The point of the flat layout that's drawn at a point of the canvas,
     * both in CSS pixels from the canvas' top-left. They differ when a
     * shader with a vertex function bends what's drawn. `undefined` where
     * nothing is drawn.
     */
    unproject(x: number, y: number): { x: number; y: number } | undefined

    /**
     * Draw a new frame at the next rendering opportunity. Called for you
     * when values or the elements change.
     */
    invalidate(): void

    /**
     * Called after each frame is drawn, inside the canvas' `paint` event,
     * so the canvas can be captured.
     */
    onRender(callback: (layer: CanvasLayer) => void): VoidFunction

    destroy(): void
}

interface Item {
    element: HTMLElement
    visualElement: VisualElement
    ownsVisualElement: boolean
    shader?: string
    /**
     * The layout of the shader's `Uniforms`, with the vector or matrix
     * that feeds each member if it's not a value of the element.
     */
    layout?: UniformLayout
    sources: Map<string, unknown>
    motionBlur?: number
    left: number
    top: number
    width: number
    height: number
    isReady: boolean
    isDirty: boolean
    isCaptured?: boolean
    pose: CanvasPose
    prev?: CanvasPose
    matrix: Float32Array
    /**
     * How far its centre is from the viewer, as a part of the
     * perspective.
     */
    depth: number
    parent?: HTMLElement | null
    /**
     * Its own 3D transform, in its group's, and the frame it's from.
     */
    transform: Float32Array
    frameId?: number
    /**
     * Its group's transform.
     */
    outer?: Float32Array
    /**
     * The transform its CSS gives it, and the styles that's from.
     */
    base?: Float32Array
    baseKey?: string
    /**
     * Whether an element that's drawn on top of it is under the pointer.
     */
    isCovered?: boolean
    geometry: number[]
    cleanup: VoidFunction[]

    /**
     * GPU resources, made when the element is first drawn.
     */
    texture?: GPU
    textureWidth: number
    textureHeight: number
    frame?: GPU
    group?: GPU
    uniformData?: ArrayBuffer
    uniformBuffer?: GPU
    uniformGroup?: GPU
}

/**
 * A shader run on the whole layer.
 */
interface Post {
    wgsl: string
    uniforms: Record<string, CanvasUniform>
    segments: number[]
    extend: number[]
    layout?: UniformLayout
    data?: ArrayBuffer
    buffer?: GPU
    group?: GPU
    /**
     * The layer values and the target it reads, one for each target.
     */
    frame?: GPU
    sources?: GPU[]
    stop: VoidFunction[]
}

/**
 * The flat point drawn at each pixel of a small copy of the canvas, read
 * back from the GPU.
 */
interface HitMap {
    data: Float32Array
    width: number
    height: number
    /**
     * The scene the points are in, as in render().
     */
    scene: number[]
}

/**
 * Elements drawn by a canvas layer, for canvasEffect.
 */
export const canvasItems = new WeakMap<Element, Item>()

const noop = () => {}

const floatsPerInstance = instanceSize / 4

/**
 * Elements this far outside the scene, in CSS pixels, aren't drawn.
 */
const cullMargin = 100

/**
 * Columns of the hit map. Its rows are 256 bytes apart, as a texture
 * copy needs.
 */
const hitMapWidth = 256

/**
 * Far enough to put every element outside the canvas.
 */
const offscreen = 1e5

// GPUTextureUsage and GPUBufferUsage flags
const elementTextureUsage = 0x02 | 0x04 | 0x10
const targetUsage = 0x04 | 0x10
const uniformUsage = 0x40 | 0x08
const vertexUsage = 0x20 | 0x08

/**
 * Composite live HTML with WebGPU. Each element added to the layer is
 * drawn as a textured quad with Motion transform values, optionally
 * through a fragment shader and with motion blur, and its hit testing is
 * kept where it's drawn.
 *
 * ```javascript
 * const layer = canvasLayer(canvas, { motionBlur: 0.5 })
 * layer.add(card, { left: 40, top: 40 })
 * animate(card, { x: 400, rotate: 90 })
 * ```
 *
 * Needs a browser that can draw HTML in canvas with WebGPU. Elsewhere
 * `supported` is `false` and nothing is drawn.
 */
export function canvasLayer(
    canvas: HTMLCanvasElement,
    {
        motionBlur = 0,
        samples = 24,
        perspective = 0,
        shaders,
    }: CanvasLayerOptions = {}
): CanvasLayer {
    const items = new Map<Element, Item>()
    const listeners = new SubscriptionManager<(layer: CanvasLayer) => void>()
    const lostListeners = new SubscriptionManager<VoidFunction>()
    const previousContent = canvas.getAttribute("content")

    const layer = {
        canvas,
        supported: false,
        ready: Promise.resolve(false),
        motionBlur,
        samples,
        perspective,
        add: noop as CanvasLayer["add"],
        remove: noop as CanvasLayer["remove"],
        has: (element: Element) => items.has(element),
        setShaders: noop as CanvasLayer["setShaders"],
        unproject: ((x: number, y: number) => ({
            x,
            y,
        })) as CanvasLayer["unproject"],
        invalidate: noop,
        onRender: (callback: (layer: CanvasLayer) => void) =>
            listeners.add(callback),
        onLost: (callback: VoidFunction) => lostListeners.add(callback),
        destroy: noop,
    }

    const restoreContent = () =>
        previousContent === null
            ? canvas.removeAttribute("content")
            : canvas.setAttribute("content", previousContent)

    let context: GPU = null

    try {
        if (hasWebGPU()) {
            canvas.setAttribute("content", "drawable")
            if ((canvas as any).content === "drawable") {
                context = canvas.getContext("webgpu" as any)
            }
        }
    } catch {}

    if (!context) {
        restoreContent()
        return layer
    }

    const drawable = canvas as DrawableCanvas
    const invalidate = () => drawable.requestPaint()

    let renderer: Renderer | undefined
    let isDestroyed = false
    let isConfigured = false
    let stopLost: VoidFunction | undefined

    let instanceBuffer: GPU
    let instances = new Float32Array(0)
    let blurTexture: GPU
    let blurView: GPU
    let blurGroup: GPU

    /**
     * With shaders on the layer, the elements are drawn into the first of
     * two targets. Each shader then reads one and draws into the other,
     * and the last draws into the canvas.
     */
    let posts: Post[] = []
    let targets: GPU[] = []
    let targetViews: GPU[] = []
    let targetMips = 1

    /**
     * The scene is what the elements are drawn into: the canvas, or with
     * a shader that extends it, more of the layout around the canvas.
     * [x, y, width, height] in CSS pixels, with the canvas at (x, y).
     */
    let scene = [0, 0, 0, 0]

    /**
     * With a shader that has a vertex function, hit testing can't follow
     * the drawing with a matrix. So the element geometry is shifted to put
     * the flat point that's drawn under the pointer, under the pointer.
     */
    let hitMap: HitMap | undefined
    let hitKey = ""
    let hitPending = false
    let hitTexture: GPU
    let hitBuffer: GPU
    const shift = [0, 0]

    /**
     * The elements in the order they were drawn, and the flat point
     * under the pointer.
     */
    let order: Item[] = []
    let pointer: number[] | undefined
    let frameId = 0

    const resize = (entry?: ResizeObserverEntry) => {
        const box = entry?.devicePixelContentBoxSize?.[0]
        /**
         * Some builds report CSS pixels as the device pixel box, so never
         * go below the CSS size times the pixel ratio.
         */
        const width = Math.max(
            box?.inlineSize || 0,
            Math.round(canvas.clientWidth * devicePixelRatio)
        )
        const height = Math.max(
            box?.blockSize || 0,
            Math.round(canvas.clientHeight * devicePixelRatio)
        )

        // A canvas that's not displayed keeps the size it had
        if (!width || !height) return

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
            items.forEach((item) => (item.isDirty = true))
        }
        invalidate()
    }

    const observer = new ResizeObserver(([entry]) => resize(entry))
    try {
        observer.observe(canvas, { box: "device-pixel-content-box" })
    } catch {
        observer.observe(canvas)
    }
    resize()

    const upload = (
        { device, elementLayout, uniformsLayout, sampler }: Renderer,
        item: Item,
        changed?: Set<Element>
    ) => {
        const { element } = item
        const width = element.offsetWidth
        const height = element.offsetHeight

        if (!width || !height) {
            item.isReady = false
            return
        }

        if (!item.frame) {
            item.frame = device.createBuffer({ size: 48, usage: uniformUsage })

            if (item.layout) {
                const { size } = item.layout
                item.uniformData = new ArrayBuffer(size)
                item.uniformBuffer = device.createBuffer({
                    size,
                    usage: uniformUsage,
                })
                item.uniformGroup = device.createBindGroup({
                    layout: uniformsLayout,
                    entries: [
                        {
                            binding: 0,
                            resource: { buffer: item.uniformBuffer },
                        },
                    ],
                })
            }
        }

        if (
            item.isReady &&
            !item.isDirty &&
            changed &&
            !changed.has(element) &&
            width === item.width &&
            height === item.height
        ) {
            return
        }

        item.width = width
        item.height = height
        item.isDirty = false

        const size = drawable.getElementImageDefaultSize(element)
        const textureWidth = Math.max(1, Math.ceil(size.width))
        const textureHeight = Math.max(1, Math.ceil(size.height))

        if (
            textureWidth !== item.textureWidth ||
            textureHeight !== item.textureHeight
        ) {
            item.texture?.destroy()
            item.textureWidth = textureWidth
            item.textureHeight = textureHeight
            item.texture = device.createTexture({
                size: [textureWidth, textureHeight],
                format: "rgba8unorm",
                usage: elementTextureUsage,
            })
            item.group = device.createBindGroup({
                layout: elementLayout,
                entries: [
                    { binding: 0, resource: { buffer: item.frame } },
                    { binding: 1, resource: item.texture.createView() },
                    { binding: 2, resource: sampler },
                ],
            })
            // Nothing's in the new texture until the copy below succeeds
            item.isReady = false
        }

        const copy = (source: unknown) =>
            device.queue.drawElementImageToTexture(
                { source },
                { texture: item.texture, premultipliedAlpha: true }
            )

        try {
            /**
             * Some builds only take an element whose parent is the
             * canvas. A slotted one, as <motion-fx> has, is then
             * copied through a captured image of it.
             */
            try {
                if (item.isCaptured) throw 0
                copy(element)
            } catch {
                const image = drawable.captureElementImage(element)
                copy(image)
                image.close()
                item.isCaptured = true
            }
            item.isReady = true
        } catch {
            /**
             * The element has no snapshot yet, e.g. it was laid out
             * after this paint began. Try again in the next one.
             */
            item.isDirty = true
            invalidate()
        }
    }

    let seconds = 0
    const camera: Camera = [0, 0, 0]
    const scratch: number[] = []
    const frameData = new Float32Array(12)

    /**
     * Write the values the element's shader reads, and return the
     * program to draw it with: its own once it's known to compile, the
     * default shader until then or if it failed.
     */
    const useItem = ({ device, program }: Renderer, item: Item): Program => {
        frameData[0] = item.width
        frameData[1] = item.height
        frameData[2] = scene[2]
        frameData[3] = scene[3]
        frameData[4] = seconds
        frameData[5] = camera[0]
        frameData[8] = frameData[9] = 0
        device.queue.writeBuffer(item.frame, 0, frameData)

        const compiled = program(item.shader)
        if (!compiled.isValid) return program()

        if (item.layout) {
            const floats = new Float32Array(item.uniformData!)
            const ints = new Int32Array(item.uniformData!)
            item.layout.members.forEach((info, name) => {
                /**
                 * A member without a value is 0.
                 */
                writeUniform(
                    floats,
                    ints,
                    info,
                    item.sources.get(name) ??
                        item.visualElement.getValue(name) ??
                        0,
                    scratch
                )
            })
            device.queue.writeBuffer(item.uniformBuffer, 0, item.uniformData)
        }

        return compiled
    }

    let cursor = 0

    /**
     * Add an instance of the element drawn with `pose`.
     */
    const pushInstance = (item: Item, pose: CanvasPose, alpha: number) => {
        const matrix = poseMatrix(
            pose,
            item.width,
            item.height,
            item.matrix,
            camera,
            item.outer,
            item.base
        )
        // Moved by the scene's origin, which is scaled by w too
        for (let i = 0; i < 9; i++) {
            instances[cursor++] =
                matrix[i] + (i % 3 < 2 ? scene[i % 3] * matrix[i - (i % 3) + 2] : 0)
        }
        instances[cursor++] = alpha
    }

    const draw = (
        pass: GPU,
        pipeline: GPU,
        item: Item,
        hasUniforms: boolean,
        first: number,
        count: number
    ) => {
        pass.setPipeline(pipeline)
        pass.setBindGroup(0, item.group)
        hasUniforms && pass.setBindGroup(1, item.uniformGroup)
        pass.setVertexBuffer(0, instanceBuffer)
        pass.draw(4, count, 0, first)
    }

    const sample = {} as CanvasPose

    /**
     * Keep hit testing, focus rings and the accessibility tree where the
     * element is drawn.
     */
    const updateGeometry = ({
        element,
        matrix,
        geometry,
        isCovered,
    }: Item) => {
        const [a, b, wx, c, d, wy, e, f, w] = matrix
        const shiftX = isCovered ? offscreen : shift[0]
        const shiftY = isCovered ? offscreen : shift[1]
        // The 4x4 matrix that does the same to a point with no depth
        const next = [
            a + shiftX * wx,
            b + shiftY * wx,
            0,
            wx,
            c + shiftX * wy,
            d + shiftY * wy,
            0,
            wy,
            0,
            0,
            1,
            0,
            e + shiftX * w,
            f + shiftY * w,
            0,
            w,
        ]
        if (next.some((value, i) => value !== geometry[i])) {
            next.forEach((value, i) => (geometry[i] = value))
            drawable.updateElementGeometry(element, {
                canvasTransform: new DOMMatrix(next),
            })
        }
    }

    /**
     * The transform of an element others are grouped with.
     */
    const groupTransform = (element?: HTMLElement | null) => {
        const item = element && items.get(element)
        if (!item) return
        if (item.frameId !== frameId) {
            item.frameId = frameId
            const t = poseTransform(
                item.pose,
                element.offsetWidth,
                element.offsetHeight,
                item.transform,
                groupTransform(item.parent),
                item.base
            )
            /**
             * That's from the group's box to the canvas. The elements
             * in the group are already where they are in the canvas.
             */
            for (let i = 0; i < 3; i++) {
                t[9 + i] -= t[i] * item.left + t[3 + i] * item.top
            }
        }
        return item.transform
    }

    /**
     * The browser hit tests the elements in DOM order. With a
     * perspective they're drawn in depth order, so an element that's
     * under the pointer and under another element is moved away.
     */
    const cover = () => {
        let top: Item | undefined
        for (let i = order.length; i--; ) {
            const item = order[i]
            const [a, b, c, d, e, f, g, h, w] = item.matrix
            let isUnder = false
            if (pointer && camera[0]) {
                // The point of the element's box that's drawn at the pointer
                const [x, y] = pointer
                const xx = a - c * x
                const xy = d - f * x
                const yx = b - c * y
                const yy = e - f * y
                const px = x * w - g
                const py = y * w - h
                const det = xx * yy - xy * yx
                const u = (px * yy - xy * py) / det
                const v = (xx * py - yx * px) / det
                isUnder =
                    u >= 0 &&
                    v >= 0 &&
                    u <= item.element.offsetWidth &&
                    v <= item.element.offsetHeight &&
                    c * u + f * v + w > 0
            }
            item.isCovered = isUnder && Boolean(top)
            if (isUnder) top ||= item
        }
        items.forEach(updateGeometry)
    }

    /**
     * An element's CSS transform isn't drawn in a canvas, so the layer
     * reads it and draws the element with it. Motion's values are applied
     * after it. An element that had a visual element already has Motion's
     * own transform as its style, which isn't read.
     */
    const readBase = (item: Item) => {
        if (!item.ownsVisualElement) return
        const { transform, transformOrigin } = getComputedStyle(item.element)
        const key = transform + transformOrigin
        if (key === item.baseKey) return
        item.baseKey = key
        item.base = undefined
        if (transform !== "none") {
            const [x, y, z = 0] = transformOrigin.split(" ").map(parseFloat)
            const m = new DOMMatrix()
                .translate(x, y, z)
                .multiply(new DOMMatrix(transform))
                .translate(-x, -y, -z)
            item.base = new Float32Array([
                m.m11,
                m.m12,
                m.m13,
                m.m21,
                m.m22,
                m.m23,
                m.m31,
                m.m32,
                m.m33,
                m.m41,
                m.m42,
                m.m43,
            ])
        }
        item.prev = undefined
        invalidate()
    }

    const render = (changedElements?: Iterable<Element>) => {
        const { width, height } = canvas
        if (!renderer || !width || !height) return

        const { device, copy, copyLayout } = renderer

        /**
         * Configured here, not when the device arrives, because the
         * canvas needs a size first.
         */
        if (!isConfigured) {
            context.configure({
                device,
                format: renderer.format,
                alphaMode: "premultiplied",
            })
            isConfigured = true
        }

        const changed = changedElements && new Set(changedElements)
        const { clientWidth, clientHeight } = canvas
        let drawAgain = false

        const active = posts.filter(
            (post) => renderer!.program(post.wgsl).isValid
        )

        /**
         * The scene, and the size of the textures it's drawn into.
         */
        const extend = [0, 0, 0, 0]
        active.forEach((post) =>
            post.extend.forEach(
                (value, i) => (extend[i] = Math.max(extend[i], value))
            )
        )
        scene = [
            extend[3] * clientWidth,
            extend[0] * clientHeight,
            (1 + extend[1] + extend[3]) * clientWidth,
            (1 + extend[0] + extend[2]) * clientHeight,
        ]
        const limit = device.limits.maxTextureDimension2D
        const scaleX = Math.min(width / clientWidth, limit / scene[2])
        const scaleY = Math.min(height / clientHeight, limit / scene[3])
        const sceneWidth = Math.max(1, Math.round(scene[2] * scaleX))
        const sceneHeight = Math.max(1, Math.round(scene[3] * scaleY))

        seconds = time.now() / 1000
        camera[0] = layer.perspective
        camera[1] = clientWidth / 2
        camera[2] = clientHeight / 2

        /**
         * Every pose drawn this frame is an instance in one buffer, which
         * is written once, before the frame is submitted.
         */
        const capacity =
            (items.size * Math.max(2, Math.ceil(layer.samples)) + 1) *
            floatsPerInstance
        if (instances.length < capacity) {
            instances = new Float32Array(capacity)
            instanceBuffer?.destroy()
            instanceBuffer = device.createBuffer({
                size: capacity * 4,
                usage: vertexUsage,
            })
        }
        cursor = 0

        const encoder = device.createCommandEncoder()
        const canvasView = context.getCurrentTexture().createView()

        /**
         * A shader with a vertex function can draw the scene smaller than
         * it is, so it reads mipmaps of it.
         */
        const mips = active.some((post) => renderer!.program(post.wgsl).surface)
            ? Math.floor(Math.log2(Math.max(sceneWidth, sceneHeight))) + 1
            : 1
        if (
            active.length &&
            (!targets[0] ||
                targets[0].width !== sceneWidth ||
                targets[0].height !== sceneHeight ||
                targetMips !== mips)
        ) {
            targetMips = mips
            targets.forEach((target) => target.destroy())
            targets = [0, 1].map(() =>
                device.createTexture({
                    size: [sceneWidth, sceneHeight],
                    format: renderer!.format,
                    usage: targetUsage,
                    mipLevelCount: mips,
                })
            )
            targetViews = targets.map((target) =>
                target.createView({ mipLevelCount: 1 })
            )
            posts.forEach((post) => (post.sources = undefined))
        }
        const view = active.length ? targetViews[0] : canvasView
        const beginPass = (target: GPU, loadOp: string, clear = 0) =>
            encoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: target,
                        loadOp,
                        storeOp: "store",
                        clearValue: [clear, clear, 0, 0],
                    },
                ],
            })
        let pass = beginPass(view, "clear")

        /**
         * DOM order, as the elements are stacked for hit testing. With a
         * perspective, the furthest are drawn first.
         */
        order = []
        frameId++
        for (const element of drawOrder(canvas)) {
            const item = items.get(element)
            if (!item) continue

            const pose = readPose(item.visualElement.latestValues, item.pose)
            pose.x += item.left
            pose.y += item.top
            order.push(item)
        }
        for (const item of order) {
            const width0 = item.element.offsetWidth
            const height0 = item.element.offsetHeight
            item.outer = groupTransform(item.parent)
            const m = poseMatrix(
                item.pose,
                width0,
                height0,
                item.matrix,
                camera,
                item.outer,
                item.base
            )
            item.depth = (m[2] * width0 + m[5] * height0) / 2 + m[8]
        }
        camera[0] && order.sort((a, b) => b.depth - a.depth)

        for (const item of order) {
            const { pose } = item

            /**
             * An element that's outside the scene isn't copied or drawn.
             */
            const width0 = item.element.offsetWidth
            const height0 = item.element.offsetHeight
            const reach = sweptBounds(
                pose,
                pose,
                width0,
                height0,
                1,
                camera,
                item.outer,
                item.base
            )
            if (
                reach[2] < -scene[0] - cullMargin ||
                reach[3] < -scene[1] - cullMargin ||
                reach[0] > scene[2] - scene[0] + cullMargin ||
                reach[1] > scene[3] - scene[1] + cullMargin
            ) {
                item.isDirty = true
                item.width = width0
                item.height = height0
                item.pose = item.prev || ({} as CanvasPose)
                item.prev = pose
                continue
            }

            upload(renderer, item, changed)
            if (!item.isReady) continue

            const { prev } = item
            const shutter = item.motionBlur ?? layer.motionBlur
            const travel =
                prev && shutter > 0
                    ? poseTravel(
                          prev,
                          pose,
                          item.width,
                          item.height,
                          camera,
                          item.outer,
                item.base
                      ) *
                      shutter *
                      scaleX
                    : 0

            if (pose.opacity > 0) {
                const program = useItem(renderer, item)
                const hasUniforms = Boolean(program.uniforms)
                const first = cursor / floatsPerInstance
                let isBlurred = false

                if (travel > 0.5) {
                    /**
                     * Draw the average of the poses from `pose` back to
                     * `shutter` of the way to `prev` into the blur
                     * target, then composite the area they swept.
                     */
                    const [left, top, right, bottom] = sweptBounds(
                        mixPose(pose, prev!, shutter, sample),
                        pose,
                        item.width,
                        item.height,
                        8,
                        camera,
                        item.outer,
                item.base
                    )
                    const x = Math.max(
                        0,
                        Math.floor((left + scene[0]) * scaleX) - 1
                    )
                    const y = Math.max(
                        0,
                        Math.floor((top + scene[1]) * scaleY) - 1
                    )
                    const w =
                        Math.min(
                            sceneWidth,
                            Math.ceil((right + scene[0]) * scaleX) + 1
                        ) - x
                    const h =
                        Math.min(
                            sceneHeight,
                            Math.ceil((bottom + scene[1]) * scaleY) + 1
                        ) - y

                    if (w > 0 && h > 0) {
                        isBlurred = true

                        if (
                            !blurTexture ||
                            blurTexture.width !== sceneWidth ||
                            blurTexture.height !== sceneHeight
                        ) {
                            blurTexture?.destroy()
                            blurTexture = device.createTexture({
                                size: [sceneWidth, sceneHeight],
                                format: blurFormat,
                                usage: targetUsage,
                            })
                            blurView = blurTexture.createView()
                            blurGroup = device.createBindGroup({
                                layout: copyLayout,
                                entries: [{ binding: 0, resource: blurView }],
                            })
                        }

                        const count = blurSamples(
                            travel,
                            Math.max(2, Math.ceil(layer.samples))
                        )
                        for (let i = 0; i < count; i++) {
                            mixPose(
                                pose,
                                prev!,
                                (i / (count - 1)) * shutter,
                                sample
                            )
                            pushInstance(item, sample, sample.opacity / count)
                        }

                        pass.end()
                        const blurPass = beginPass(blurView, "clear")
                        blurPass.setScissorRect(x, y, w, h)
                        draw(
                            blurPass,
                            program.blur,
                            item,
                            hasUniforms,
                            first,
                            count
                        )
                        blurPass.end()

                        pass = beginPass(view, "load")
                        pass.setScissorRect(x, y, w, h)
                        pass.setPipeline(copy)
                        pass.setBindGroup(0, blurGroup)
                        pass.draw(3)
                        pass.setScissorRect(0, 0, sceneWidth, sceneHeight)

                        /**
                         * Draw again next frame, so an element that's
                         * come to rest ends sharp.
                         */
                        drawAgain = true
                    }
                }

                if (!isBlurred) {
                    pushInstance(item, pose, pose.opacity)
                    draw(pass, program.main, item, hasUniforms, first, 1)
                }

                if (program.usesTime) drawAgain = true
            }

            poseMatrix(
                pose,
                item.width,
                item.height,
                item.matrix,
                camera,
                item.outer,
                item.base
            )

            item.pose = prev || ({} as CanvasPose)
            item.prev = pose
        }

        pass.end()
        cover()

        let hitPost: Post | undefined

        if (active.length) {
            /**
             * One more instance: the whole scene, as it is.
             */
            const full = cursor / floatsPerInstance
            instances.set([1, 0, 0, 0, 1, 0, 0, 0, 1, 1], cursor)
            cursor += floatsPerInstance

            const { elementLayout, uniformsLayout, sampler, mip, mipLayout } =
                renderer

            active.forEach((post, i) => {
                const program = renderer!.program(post.wgsl)
                const { layout } = post
                const source = i % 2

                post.frame ||= device.createBuffer({
                    size: 48,
                    usage: uniformUsage,
                })
                post.sources ||= targets.map((target) =>
                    device.createBindGroup({
                        layout: elementLayout,
                        entries: [
                            { binding: 0, resource: { buffer: post.frame } },
                            { binding: 1, resource: target.createView() },
                            { binding: 2, resource: sampler },
                        ],
                    })
                )
                frameData[0] = scene[2]
                frameData[1] = scene[3]
                frameData[2] = clientWidth
                frameData[3] = clientHeight
                frameData[4] = seconds
                frameData[5] = camera[0]
                frameData[6] = post.segments[0]
                frameData[7] = post.segments[1]
                frameData[8] = scene[0]
                frameData[9] = scene[1]
                device.queue.writeBuffer(post.frame, 0, frameData)

                if (layout) {
                    if (!post.buffer) {
                        post.data = new ArrayBuffer(layout.size)
                        post.buffer = device.createBuffer({
                            size: layout.size,
                            usage: uniformUsage,
                        })
                        post.group = device.createBindGroup({
                            layout: uniformsLayout,
                            entries: [
                                {
                                    binding: 0,
                                    resource: { buffer: post.buffer },
                                },
                            ],
                        })
                    }
                    const floats = new Float32Array(post.data!)
                    const ints = new Int32Array(post.data!)
                    layout.members.forEach((info, name) =>
                        writeUniform(
                            floats,
                            ints,
                            info,
                            post.uniforms[name] ?? 0,
                            scratch
                        )
                    )
                    device.queue.writeBuffer(post.buffer, 0, post.data)
                }

                if (program.surface) {
                    hitPost = post
                    for (let level = 1; level < targetMips; level++) {
                        const mipPass = beginPass(
                            targets[source].createView({
                                baseMipLevel: level,
                                mipLevelCount: 1,
                            }),
                            "clear"
                        )
                        mipPass.setPipeline(mip)
                        mipPass.setBindGroup(
                            0,
                            device.createBindGroup({
                                layout: mipLayout,
                                entries: [
                                    {
                                        binding: 0,
                                        resource: targets[source].createView({
                                            baseMipLevel: level - 1,
                                            mipLevelCount: 1,
                                        }),
                                    },
                                    { binding: 1, resource: sampler },
                                ],
                            })
                        )
                        mipPass.draw(3)
                        mipPass.end()
                    }
                }

                const postPass = beginPass(
                    i === active.length - 1 ? canvasView : targetViews[1 - source],
                    "clear"
                )
                postPass.setBindGroup(0, post.sources[source])
                layout && postPass.setBindGroup(1, post.group)
                if (program.surface) {
                    postPass.setPipeline(program.surface)
                    postPass.draw(post.segments[0] * post.segments[1] * 6)
                } else {
                    postPass.setPipeline(program.main)
                    postPass.setVertexBuffer(0, instanceBuffer)
                    postPass.draw(4, 1, 0, full)
                }
                postPass.end()

                if (program.usesTime) drawAgain = true
            })
        }

        /**
         * Read back where the last mesh draws each flat point, when it
         * has changed.
         */
        let readHits: VoidFunction | undefined
        if (hitPost) {
            const post: Post = hitPost
            const key =
                post.wgsl +
                scene +
                [clientWidth, clientHeight, post.segments] +
                (post.data ? new Float32Array(post.data) : "")
            if (key !== hitKey && !hitPending) {
                hitKey = key
                hitPending = true
                const mapHeight = Math.max(
                    1,
                    Math.round((hitMapWidth * clientHeight) / clientWidth)
                )
                if (hitTexture?.height !== mapHeight) {
                    hitTexture?.destroy()
                    hitBuffer?.destroy()
                    hitTexture = device.createTexture({
                        size: [hitMapWidth, mapHeight],
                        format: mapFormat,
                        usage: 0x10 | 0x01,
                    })
                    hitBuffer = device.createBuffer({
                        size: hitMapWidth * mapHeight * 8,
                        usage: 0x08 | 0x01,
                    })
                }
                const mapPass = beginPass(hitTexture.createView(), "clear", -1)
                mapPass.setPipeline(renderer.program(post.wgsl).map)
                mapPass.setBindGroup(0, post.sources![0])
                post.layout && mapPass.setBindGroup(1, post.group)
                mapPass.draw(post.segments[0] * post.segments[1] * 6)
                mapPass.end()
                encoder.copyTextureToBuffer(
                    { texture: hitTexture },
                    { buffer: hitBuffer, bytesPerRow: hitMapWidth * 8 },
                    [hitMapWidth, mapHeight]
                )
                const buffer = hitBuffer
                const mapScene = scene
                readHits = () =>
                    buffer
                        .mapAsync(1)
                        .then(() => {
                            hitMap = {
                                data: new Float32Array(
                                    buffer.getMappedRange().slice(0)
                                ),
                                width: hitMapWidth,
                                height: mapHeight,
                                scene: mapScene,
                            }
                            buffer.unmap()
                        })
                        .catch(noop)
                        .then(() => {
                            hitPending = false
                            // The mesh may have changed in the meantime
                            invalidate()
                        })
            }
        } else if (hitMap || shift[0] || shift[1]) {
            hitMap = undefined
            hitKey = ""
            shift[0] = shift[1] = 0
            items.forEach(updateGeometry)
        }

        cursor &&
            device.queue.writeBuffer(instanceBuffer, 0, instances, 0, cursor)
        device.queue.submit([encoder.finish()])
        readHits?.()

        listeners.notify(layer)
        drawAgain && invalidate()
    }

    const unproject = (x: number, y: number) => {
        if (!hitMap) return hitKey ? undefined : { x, y }

        const { data, width, height, scene } = hitMap
        const mapX = (x / canvas.clientWidth) * width - 0.5
        const mapY = (y / canvas.clientHeight) * height - 0.5
        const column = Math.floor(mapX)
        const row = Math.floor(mapY)
        if (column < 0 || row < 0 || column > width - 2 || row > height - 2) {
            return
        }

        // Mix the four pixels around the point
        const mixX = mapX - column
        const mixY = mapY - row
        let u = 0
        let v = 0
        for (let i = 0; i < 4; i++) {
            const index = ((row + (i >> 1)) * width + column + (i & 1)) * 2
            if (data[index] < 0) return
            const weight =
                (i & 1 ? mixX : 1 - mixX) * (i >> 1 ? mixY : 1 - mixY)
            u += data[index] * weight
            v += data[index + 1] * weight
        }

        return { x: u * scene[2] - scene[0], y: v * scene[3] - scene[1] }
    }

    /**
     * Put the flat point that's drawn under the pointer, under the
     * pointer, so the browser hits the element that's drawn there.
     */
    const onPointer = (event: PointerEvent) => {
        const box = canvas.getBoundingClientRect()
        const x = event.clientX - box.left
        const y = event.clientY - box.top
        pointer = [x, y]
        if (hitMap) {
            const point = unproject(x, y)
            shift[0] = point ? x - point.x : offscreen
            shift[1] = point ? y - point.y : offscreen
            pointer = point && [point.x, point.y]
        }
        cover()
    }
    canvas.addEventListener("pointermove", onPointer, true)
    canvas.addEventListener("pointerdown", onPointer, true)

    const onPaint = (event: Event) =>
        render((event as CanvasPaintEventLike).changedElements)
    canvas.addEventListener("paint", onPaint)

    const add = (element: HTMLElement, options: CanvasElementOptions = {}) => {
        const {
            shader,
            uniforms = {},
            motionBlur,
            left = 0,
            top = 0,
            group,
            ...values
        } = options

        const added = items.get(element)
        if (added) {
            if (group !== undefined) added.parent = group
            readBase(added)
            /**
             * A move of the layout box isn't motion, so it's not blurred.
             */
            if (added.left !== left || added.top !== top) {
                added.left = left
                added.top = top
                added.prev = undefined
                invalidate()
            }
            return
        }

        const layout = shader ? parseUniforms(shader) : undefined
        const cleanup: VoidFunction[] = []

        /**
         * Any member of the shader's Uniforms can be animated, from 0
         * unless given a value.
         */
        const existing = visualElementStore.get(element)
        const visualElement =
            existing ||
            new CanvasVisualElement(
                invalidate,
                (key) => Boolean(layout?.members.has(key)),
                (key) => {
                    const value = uniforms[key]
                    const latest = isMotionValue(value) ? value.get() : value
                    return typeof latest === "object"
                        ? undefined
                        : typeof latest === "boolean"
                        ? +latest
                        : latest ?? 0
                }
            )

        if (existing) {
            /**
             * A visual element made before the layer drew the element,
             * e.g. by drag() or a motion component, renders to its
             * style, which the canvas doesn't draw. So each render it
             * schedules is a frame for the layer too, and its values
             * stay on the main thread, where the layer can read them.
             */
            const { scheduleRender } = existing
            existing.scheduleRender = () => {
                scheduleRender()
                invalidate()
            }
            existing.getProps = () => ({
                onUpdate: invalidate,
                ...existing.props,
            })
            cleanup.push(() => {
                existing.scheduleRender = scheduleRender
                delete (existing as Partial<VisualElement>).getProps
            })
        } else {
            /**
             * Values animate() was already rendering to the element's
             * style move to the layer.
             */
            handOffElementState(element, visualElement)
            const { style } = element
            style.transform = style.transformOrigin = style.opacity = ""
        }

        const bind = (key: string, value: unknown) =>
            isMotionValue(value)
                ? visualElement.addValue(key, value)
                : visualElement.getValue(key, value as number | string)

        for (const key in values) bind(key, values[key as CanvasPoseKey])

        const item: Item = {
            element,
            visualElement,
            ownsVisualElement: !existing,
            shader,
            layout,
            sources: new Map(),
            motionBlur,
            left,
            top,
            textureWidth: 0,
            textureHeight: 0,
            width: 0,
            height: 0,
            isReady: false,
            isDirty: true,
            pose: {} as CanvasPose,
            matrix: new Float32Array(9),
            depth: 0,
            parent: group,
            transform: new Float32Array(12),
            geometry: [],
            cleanup,
        }

        layout?.members.forEach((_, name) => {
            const value = uniforms[name]
            if (
                value !== null &&
                typeof value === "object" &&
                !isMotionValue(value)
            ) {
                /**
                 * Vectors and matrices aren't values of the element, so
                 * watch the motion values they hold.
                 */
                for (let i = 0; i < value.length; i++) {
                    const part = value[i]
                    isMotionValue(part) &&
                        cleanup.push(part.on("change", invalidate))
                }
                item.sources.set(name, value)
            } else {
                value !== undefined && bind(name, value)
            }
        })

        element.parentNode !== canvas &&
            element.assignedSlot?.parentNode !== canvas &&
            canvas.appendChild(element)
        element.setAttribute("drawable", "")
        existing || visualElement.mount(element)

        items.set(element, item)
        canvasItems.set(element, item)
        readBase(item)
        invalidate()
    }

    const remove = (element: HTMLElement) => {
        const item = items.get(element)
        if (!item) return

        items.delete(element)
        canvasItems.delete(element)
        item.cleanup.forEach((cleanup) => cleanup())

        if (item.ownsVisualElement) {
            item.visualElement.unmount()
            visualElementStore.delete(element)
        }

        item.texture?.destroy()
        item.frame?.destroy()
        item.uniformBuffer?.destroy()
        element.removeAttribute("drawable")
        drawable.clearElementGeometry(element)
        invalidate()
    }

    const watch = (value: unknown, stop: VoidFunction[]) => {
        if (isMotionValue(value)) {
            stop.push(value.on("change", invalidate))
        } else if (value && typeof value === "object") {
            const list = value as ArrayLike<unknown>
            for (let i = 0; i < list.length; i++) watch(list[i], stop)
        }
    }

    const stopPost = (post: Post) => {
        post.stop.forEach((stop) => stop())
        post.buffer?.destroy()
        post.frame?.destroy()
    }

    const setShaders = (list: FXShader[] = []) => {
        const next: Post[] = []

        for (const {
            wgsl,
            uniforms = {},
            motionBlur,
            samples,
            segments = [32, 32],
            extend = {},
        } of list) {
            if (motionBlur !== undefined) {
                layer.motionBlur = motionBlur
                layer.samples = samples ?? layer.samples
            }
            if (!wgsl) continue

            /**
             * The same shader in the same place keeps its GPU resources,
             * as a framework makes a new list on every render.
             */
            const previous = posts[next.length]
            const post: Post =
                previous?.wgsl === wgsl
                    ? previous
                    : {
                          wgsl,
                          uniforms,
                          segments,
                          extend: [],
                          layout: parseUniforms(wgsl),
                          stop: [],
                      }
            post.stop.forEach((stop) => stop())
            post.stop = []
            post.uniforms = uniforms
            post.segments = segments.map((count) =>
                Math.max(1, Math.round(count))
            )
            post.extend = [
                extend.top || 0,
                extend.right || 0,
                extend.bottom || 0,
                extend.left || 0,
            ]
            for (const name in uniforms) watch(uniforms[name], post.stop)
            next.push(post)
        }

        posts.forEach((post) => next.includes(post) || stopPost(post))
        posts = next
        invalidate()
    }

    const destroy = () => {
        if (isDestroyed) return
        isDestroyed = true
        posts.forEach(stopPost)
        posts = []
        targets.forEach((target) => target.destroy())
        hitTexture?.destroy()
        hitBuffer?.destroy()
        canvas.removeEventListener("pointermove", onPointer, true)
        canvas.removeEventListener("pointerdown", onPointer, true)
        items.forEach((_, element) => remove(element as HTMLElement))
        canvas.removeEventListener("paint", onPaint)
        observer.disconnect()
        listeners.clear()
        stopLost?.()
        instanceBuffer?.destroy()
        blurTexture?.destroy()
        try {
            context.unconfigure()
        } catch {}
        renderer = undefined
    }

    /**
     * Stop drawing for good. Each element gets the transform and opacity
     * it was drawn with as styles, so it looks the same as normal DOM.
     */
    const giveUp = () => {
        if (isDestroyed) return
        items.forEach((item, element) => {
            const {
                x,
                y,
                z,
                scale,
                scaleX,
                scaleY,
                rotate,
                rotateX,
                rotateY,
                opacity,
                originX,
                originY,
            } = readPose(item.visualElement.latestValues)
            remove(element as HTMLElement)
            const { style } = element as HTMLElement
            style.transformOrigin = `${originX * 100}% ${originY * 100}%`
            style.transform = `translate3d(${x}px, ${y}px, ${z}px) scale(${
                scale * scaleX
            }, ${
                scale * scaleY
            }) rotate(${rotate}deg) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
            if (opacity !== 1) style.opacity = `${opacity}`
        })
        destroy()
        layer.supported = false
        restoreContent()
        lostListeners.notify()
        lostListeners.clear()
    }

    layer.supported = true
    layer.ready = requestDevice().then((device) => {
        if (isDestroyed) return false

        if (!device) {
            giveUp()
            return false
        }

        try {
            renderer = createRenderer(device, invalidate)
        } catch {
            giveUp()
            return false
        }

        stopLost = onDeviceLost(giveUp)
        invalidate()
        return true
    })

    Object.assign(layer, {
        add,
        remove,
        setShaders,
        unproject,
        invalidate,
        destroy,
    })
    setShaders(shaders)

    return layer
}

/**
 * The canvas' children in the order they're drawn. A <slot>, as a canvas
 * in a shadow root has, stands for the elements assigned to it.
 */
function drawOrder(canvas: HTMLCanvasElement) {
    const elements: Element[] = []
    for (const child of canvas.children) {
        child instanceof HTMLSlotElement
            ? elements.push(...child.assignedElements())
            : elements.push(child)
    }
    return elements
}

/**
 * The parts of the HTML-in-canvas API the layer uses. Not yet in
 * TypeScript's DOM types.
 */
interface DrawableCanvas extends HTMLCanvasElement {
    requestPaint(): void
    getElementImageDefaultSize(element: Element): {
        width: number
        height: number
    }
    updateElementGeometry(
        element: Element,
        options: { canvasTransform: DOMMatrix }
    ): void
    clearElementGeometry(element: Element): void
    captureElementImage(element: Element): { close(): void }
}

interface CanvasPaintEventLike extends Event {
    changedElements?: Iterable<Element>
}
