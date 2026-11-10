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
    builtInUniforms,
    compileCopyProgram,
    compileElementProgram,
    type Program,
} from "./program"
import {
    isSettable,
    setUniform,
    type CanvasUniform,
    type UniformInfo,
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
     * are used for short moves. Defaults to `24`, or `8` where the GPU
     * can't render to half-float textures.
     */
    samples?: number

    /**
     * Attributes for the canvas' WebGL2 context. `preserveDrawingBuffer`
     * lets the canvas be read outside its `paint` event.
     */
    context?: WebGLContextAttributes
}

export type CanvasPoseValues = {
    [K in CanvasPoseKey]?: number | MotionValue<number>
}

export interface CanvasElementOptions extends CanvasPoseValues {
    /**
     * A GLSL ES 3.00 function, `vec4 effect(vec2 uv)`, that returns the
     * premultiplied colour of the element at `uv` (0-1, from its top-left
     * corner). It can read the element with `texture(uTexture, uv)`, its
     * size in CSS pixels as `uSize`, the time in seconds as `uTime`, and
     * the uniforms it declares.
     */
    shader?: string

    /**
     * Values for the uniforms `shader` declares. Numbers and colours
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
     * Whether the browser can draw HTML in a canvas. Without it, the layer
     * does nothing and the canvas' children stay fallback content.
     */
    readonly supported: boolean

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
    program: Program
    /**
     * Each uniform to set, with the vector or matrix that feeds it if
     * it's not a value of the element.
     */
    uniforms: [UniformInfo, string, unknown?][]
    motionBlur?: number
    texture: WebGLTexture
    textureWidth: number
    textureHeight: number
    width: number
    height: number
    isReady: boolean
    isDirty: boolean
    pose: CanvasPose
    prev?: CanvasPose
    matrix: Float32Array
    geometry: number[]
    cleanup: VoidFunction[]
}

/**
 * Elements drawn by a canvas layer, for canvasEffect.
 */
export const canvasItems = new WeakMap<Element, Item>()

const noop = () => {}

const quadVertices = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])

/**
 * Composite live HTML with WebGL2. Each element added to the layer is
 * drawn as a textured quad with Motion transform values, optionally
 * through a fragment shader and with motion blur, and its hit testing is
 * kept where it's drawn.
 *
 * ```javascript
 * const layer = canvasLayer(canvas, { motionBlur: 0.5 })
 * layer.add(card, { x: 40, y: 40 })
 * animate(card, { x: 400, rotate: 90 })
 * ```
 *
 * Needs a browser that can draw HTML in canvas. Elsewhere `supported` is
 * `false` and nothing is drawn.
 */
export function canvasLayer(
    canvas: HTMLCanvasElement,
    { motionBlur = 0, samples = 24, context }: CanvasLayerOptions = {}
): CanvasLayer {
    const items = new Map<Element, Item>()
    const listeners = new SubscriptionManager<(layer: CanvasLayer) => void>()
    const previousContent = canvas.getAttribute("content")

    const layer: CanvasLayer = {
        canvas,
        supported: false,
        motionBlur,
        samples,
        add: noop,
        remove: noop,
        has: (element) => items.has(element),
        invalidate: noop,
        onRender: (callback) => listeners.add(callback),
        destroy: noop,
    }

    let webgl: WebGL2RenderingContext | null = null

    try {
        canvas.setAttribute("content", "drawable")
        if ((canvas as any).content === "drawable") {
            webgl = canvas.getContext("webgl2", {
                premultipliedAlpha: true,
                ...context,
            })
        }
    } catch {}

    if (!webgl) {
        previousContent === null
            ? canvas.removeAttribute("content")
            : canvas.setAttribute("content", previousContent)
        return layer
    }

    const gl = webgl

    const drawable = canvas as DrawableCanvas
    const invalidate = () => drawable.requestPaint()

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)

    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW)

    const programs = new Map<string, Program>()
    const getProgram = (shader = "") => {
        let program = programs.get(shader)
        if (!program) {
            program = compileElementProgram(gl, shader || undefined)
            programs.set(shader, program)
        }
        return program
    }
    const copy = compileCopyProgram(gl)

    /**
     * Motion blur averages many faint poses, which 8-bit targets can't
     * hold without banding and tinting, so it needs half-float targets.
     * Without them, fewer, stronger samples keep it close.
     */
    const isFloat = Boolean(
        gl.getExtension("EXT_color_buffer_float") ||
            gl.getExtension("EXT_color_buffer_half_float")
    )
    let blurTarget: [WebGLTexture, WebGLFramebuffer] | undefined

    const sizeBlurTarget = () => {
        if (!blurTarget) return
        const { width, height } = canvas
        gl.bindTexture(gl.TEXTURE_2D, blurTarget[0])
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            isFloat ? gl.RGBA16F : gl.RGBA8,
            width,
            height,
            0,
            gl.RGBA,
            isFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
            null
        )
    }

    const getBlurTarget = () => {
        if (!blurTarget) {
            const texture = createTexture(gl)
            const framebuffer = gl.createFramebuffer()!
            blurTarget = [texture, framebuffer]
            sizeBlurTarget()
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                texture,
                0
            )
        }
        return blurTarget[1]
    }

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

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
            sizeBlurTarget()
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

    const upload = (item: Item, changed?: Set<Element>) => {
        const { element } = item
        const width = element.offsetWidth
        const height = element.offsetHeight

        if (!width || !height) {
            item.isReady = false
            return
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
        const textureWidth = Math.ceil(size.width)
        const textureHeight = Math.ceil(size.height)

        gl.bindTexture(gl.TEXTURE_2D, item.texture)

        if (
            textureWidth !== item.textureWidth ||
            textureHeight !== item.textureHeight
        ) {
            item.textureWidth = textureWidth
            item.textureHeight = textureHeight
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA8,
                textureWidth,
                textureHeight,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                null
            )
        }

        try {
            ;(gl as DrawableContext).texElementSubImage2D(
                gl.TEXTURE_2D,
                0,
                0,
                0,
                element
            )
            item.isReady = true
        } catch {
            /**
             * The element has no snapshot yet, e.g. it's not been laid
             * out. It'll be in a later paint.
             */
            item.isDirty = true
        }
    }

    let seconds = 0
    const scratch: number[] = []

    const useItem = ({ program, texture, uniforms, visualElement }: Item) => {
        const { program: glProgram, uniforms: locations } = program
        gl.useProgram(glProgram)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.uniform2f(
            locations.get("uCanvas")!.location,
            canvas.clientWidth,
            canvas.clientHeight
        )
        const timeUniform = locations.get("uTime")
        timeUniform && gl.uniform1f(timeUniform.location, seconds)
        for (const [info, name, source] of uniforms) {
            /**
             * Elements with the same shader share a program, so a uniform
             * without a value is reset to 0 rather than left as the last
             * element set it.
             */
            setUniform(
                gl,
                info,
                source ?? visualElement.getValue(name) ?? 0,
                scratch
            )
        }
    }

    const drawPose = (item: Item, pose: CanvasPose, alpha: number) => {
        const { uniforms } = item.program
        gl.uniformMatrix3fv(
            uniforms.get("uMatrix")!.location,
            false,
            poseMatrix(pose, item.width, item.height, item.matrix)
        )
        const size = uniforms.get("uSize")
        size && gl.uniform2f(size.location, item.width, item.height)
        gl.uniform1f(uniforms.get("uAlpha")!.location, alpha)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const sample = {} as CanvasPose

    /**
     * Draw the average of the poses from `pose` back to `shutter` of the
     * way to `prev` into the blur target, then composite it. Only the
     * swept area is touched.
     */
    const drawBlurred = (
        item: Item,
        prev: CanvasPose,
        pose: CanvasPose,
        shutter: number,
        travel: number
    ) => {
        const { width, height } = canvas
        const scaleX = width / canvas.clientWidth
        const scaleY = height / canvas.clientHeight
        const [left, top, right, bottom] = sweptBounds(
            mixPose(pose, prev, shutter, sample),
            pose,
            item.width,
            item.height
        )
        const x = Math.max(0, Math.floor(left * scaleX) - 1)
        const y = Math.max(0, Math.floor(height - bottom * scaleY) - 1)
        const w = Math.min(width, Math.ceil(right * scaleX) + 1) - x
        const h = Math.min(height, Math.ceil(height - top * scaleY) + 1) - y

        if (w <= 0 || h <= 0) return

        gl.enable(gl.SCISSOR_TEST)
        gl.scissor(x, y, w, h)
        gl.bindFramebuffer(gl.FRAMEBUFFER, getBlurTarget())
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.blendFunc(gl.ONE, gl.ONE)
        useItem(item)

        const count = blurSamples(
            travel,
            isFloat ? layer.samples : Math.min(layer.samples, 8)
        )
        for (let i = 0; i < count; i++) {
            mixPose(pose, prev, (i / (count - 1)) * shutter, sample)
            drawPose(item, sample, sample.opacity / count)
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.useProgram(copy.program)
        gl.bindTexture(gl.TEXTURE_2D, blurTarget![0])
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.disable(gl.SCISSOR_TEST)
    }

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
        const changed = changedElements && new Set(changedElements)
        const scale = canvas.width / canvas.clientWidth
        let drawAgain = false

        seconds = time.now() / 1000

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, canvas.width, canvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.bindBuffer(gl.ARRAY_BUFFER, quad)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

        for (const element of drawOrder(canvas)) {
            const item = items.get(element)
            if (!item) continue

            upload(item, changed)
            if (!item.isReady) continue

            const pose = readPose(item.visualElement.latestValues, item.pose)
            const { prev } = item
            const shutter = item.motionBlur ?? layer.motionBlur
            const travel =
                prev && shutter > 0
                    ? poseTravel(prev, pose, item.width, item.height) *
                      shutter *
                      scale
                    : 0

            if (pose.opacity > 0) {
                if (travel > 0.5) {
                    drawBlurred(item, prev!, pose, shutter, travel)
                    /**
                     * Draw again next frame, so an element that's come
                     * to rest ends sharp.
                     */
                    drawAgain = true
                } else {
                    useItem(item)
                    drawPose(item, pose, pose.opacity)
                }
                if (item.program.usesTime) drawAgain = true
            }

            poseMatrix(pose, item.width, item.height, item.matrix)
            updateGeometry(item)

            item.pose = prev || ({} as CanvasPose)
            item.prev = pose
        }

        listeners.notify(layer)
        drawAgain && invalidate()
    }

    const onPaint = (event: Event) =>
        render((event as CanvasPaintEventLike).changedElements)
    canvas.addEventListener("paint", onPaint)

    const add = (element: HTMLElement, options: CanvasElementOptions = {}) => {
        if (items.has(element)) return

        const { shader, uniforms = {}, motionBlur, ...values } = options
        const program = getProgram(shader)
        const cleanup: VoidFunction[] = []

        /**
         * The uniforms the shader declares that the element can set. Any
         * of them can be animated, from 0 like GLSL unless given a value.
         */
        const settable = new Map<string, UniformInfo>()
        program.uniforms.forEach((info, name) => {
            !builtInUniforms.has(name) &&
                isSettable(info.type) &&
                settable.set(name, info)
        })

        const existing = visualElementStore.get(element)
        const visualElement =
            existing ||
            new CanvasVisualElement(
                invalidate,
                (key) => settable.has(key),
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
            program,
            uniforms: [],
            motionBlur,
            texture: createTexture(gl),
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

        settable.forEach((info, name) => {
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
                item.uniforms.push([info, name, value])
            } else {
                value !== undefined && bind(name, value)
                item.uniforms.push([info, name])
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

        gl.deleteTexture(item.texture)
        drawable.clearElementGeometry(element)
        element.removeAttribute("drawable")
        invalidate()
    }

    const destroy = () => {
        items.forEach((_, element) => remove(element as HTMLElement))
        canvas.removeEventListener("paint", onPaint)
        observer.disconnect()
        listeners.clear()
    }

    return Object.assign(layer, {
        supported: true,
        add,
        remove,
        invalidate,
        destroy,
    })
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

function createTexture(gl: WebGL2RenderingContext) {
    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
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
}

interface CanvasPaintEventLike extends Event {
    changedElements?: Iterable<Element>
}

interface DrawableContext extends WebGL2RenderingContext {
    texElementSubImage2D(
        target: GLenum,
        level: GLint,
        xoffset: GLint,
        yoffset: GLint,
        element: Element
    ): void
}
