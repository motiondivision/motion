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
    poseTravel,
    readPose,
    sweptBounds,
    type CanvasPose,
    type CanvasPoseKey,
} from "./pose"
import {
    blurFormat,
    createRenderer,
    hasWebGPU,
    instanceSize,
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
 * Elements drawn by a canvas layer, for canvasEffect.
 */
export const canvasItems = new WeakMap<Element, Item>()

const noop = () => {}

const floatsPerInstance = instanceSize / 4

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
    { motionBlur = 0, samples = 24 }: CanvasLayerOptions = {}
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
        add: noop as CanvasLayer["add"],
        remove: noop as CanvasLayer["remove"],
        has: (element: Element) => items.has(element),
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
            item.frame = device.createBuffer({ size: 32, usage: uniformUsage })

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
             * canvas. A slotted one, as <motion-canvas> has, is then
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
    const scratch: number[] = []
    const frameData = new Float32Array(8)

    /**
     * Write the values the element's shader reads, and return the
     * program to draw it with: its own once it's known to compile, the
     * default shader until then or if it failed.
     */
    const useItem = ({ device, program }: Renderer, item: Item): Program => {
        frameData[0] = item.width
        frameData[1] = item.height
        frameData[2] = canvas.clientWidth
        frameData[3] = canvas.clientHeight
        frameData[4] = seconds
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
        const matrix = poseMatrix(pose, item.width, item.height, item.matrix)
        instances[cursor++] = matrix[0]
        instances[cursor++] = matrix[1]
        instances[cursor++] = matrix[3]
        instances[cursor++] = matrix[4]
        instances[cursor++] = matrix[6]
        instances[cursor++] = matrix[7]
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
    const updateGeometry = ({ element, matrix, geometry }: Item) => {
        const [a, b, , c, d, , e, f] = matrix
        const next = [a, b, c, d, e, f]
        if (next.some((value, i) => value !== geometry[i])) {
            next.forEach((value, i) => (geometry[i] = value))
            drawable.updateElementGeometry(element, {
                canvasTransform: new DOMMatrix(next),
            })
        }
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
        const scaleX = width / canvas.clientWidth
        const scaleY = height / canvas.clientHeight
        let drawAgain = false

        seconds = time.now() / 1000

        /**
         * Every pose drawn this frame is an instance in one buffer, which
         * is written once, before the frame is submitted.
         */
        const capacity =
            items.size *
            Math.max(2, Math.ceil(layer.samples)) *
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
        const view = context.getCurrentTexture().createView()
        const beginPass = (target: GPU, loadOp: string) =>
            encoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: target,
                        loadOp,
                        storeOp: "store",
                        clearValue: [0, 0, 0, 0],
                    },
                ],
            })
        let pass = beginPass(view, "clear")

        for (const element of drawOrder(canvas)) {
            const item = items.get(element)
            if (!item) continue

            upload(renderer, item, changed)
            if (!item.isReady) continue

            const pose = readPose(item.visualElement.latestValues, item.pose)
            pose.x += item.left
            pose.y += item.top

            const { prev } = item
            const shutter = item.motionBlur ?? layer.motionBlur
            const travel =
                prev && shutter > 0
                    ? poseTravel(prev, pose, item.width, item.height) *
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
                        item.height
                    )
                    const x = Math.max(0, Math.floor(left * scaleX) - 1)
                    const y = Math.max(0, Math.floor(top * scaleY) - 1)
                    const w = Math.min(width, Math.ceil(right * scaleX) + 1) - x
                    const h =
                        Math.min(height, Math.ceil(bottom * scaleY) + 1) - y

                    if (w > 0 && h > 0) {
                        isBlurred = true

                        if (
                            !blurTexture ||
                            blurTexture.width !== width ||
                            blurTexture.height !== height
                        ) {
                            blurTexture?.destroy()
                            blurTexture = device.createTexture({
                                size: [width, height],
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
                        pass.setScissorRect(0, 0, width, height)

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

            poseMatrix(pose, item.width, item.height, item.matrix)
            updateGeometry(item)

            item.pose = prev || ({} as CanvasPose)
            item.prev = pose
        }

        pass.end()
        cursor &&
            device.queue.writeBuffer(instanceBuffer, 0, instances, 0, cursor)
        device.queue.submit([encoder.finish()])

        listeners.notify(layer)
        drawAgain && invalidate()
    }

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
            ...values
        } = options

        const added = items.get(element)
        if (added) {
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

        if (!existing) {
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

    const destroy = () => {
        if (isDestroyed) return
        isDestroyed = true
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
                scale,
                scaleX,
                scaleY,
                rotate,
                opacity,
                originX,
                originY,
            } = readPose(item.visualElement.latestValues)
            remove(element as HTMLElement)
            const { style } = element as HTMLElement
            style.transformOrigin = `${originX * 100}% ${originY * 100}%`
            style.transform = `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${
                scale * scaleX
            }, ${scale * scaleY})`
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

    return Object.assign(layer, { add, remove, invalidate, destroy })
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
