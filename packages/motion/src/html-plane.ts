import { cancelFrame, frame } from "framer-motion/dom"
import {
    supportsHTMLInCanvas,
    type CanvasPaintEvent,
    type DrawableCanvas,
    type DrawableWebGLContext,
} from "./html-in-canvas"

type ThreeObject = Record<string, any>
type ThreeClass = new (...args: any[]) => ThreeObject

/**
 * The three.js classes a plane is made from. Pass the `three` module, or
 * just these named imports.
 */
export interface HTMLPlaneThree {
    Mesh: ThreeClass
    ExternalTexture: ThreeClass

    /**
     * Used unless `geometry` is set.
     */
    PlaneGeometry?: ThreeClass

    /**
     * Used unless `material` is set.
     */
    MeshBasicMaterial?: ThreeClass
}

export interface HTMLPlaneOptions {
    three: HTMLPlaneThree

    /**
     * The `WebGLRenderer` the scene is drawn with. The element is drawn
     * into its canvas.
     */
    renderer: ThreeObject

    /**
     * The camera the scene is drawn with. Pointer events, focus and
     * accessibility follow the plane as this camera sees it.
     */
    camera: ThreeObject

    /**
     * World units per CSS pixel. Defaults to 1.
     */
    pixelSize?: number

    /**
     * Makes the plane's geometry, `width` by `height` world units, centred
     * on the origin. It's made again when the element resizes. Defaults to
     * a `PlaneGeometry`.
     *
     * Pointer events map to the rectangle that bounds the geometry's x and
     * y, so curved geometry gets approximate hit testing.
     */
    geometry?: (width: number, height: number) => ThreeObject

    /**
     * Makes the plane's material from the element's live texture. Defaults
     * to a transparent `MeshBasicMaterial` that isn't tone mapped, so the
     * plane matches the element.
     */
    material?: (texture: ThreeObject) => ThreeObject

    /**
     * Called after the element repaints, from the canvas `paint` event, for
     * scenes that only render on demand. Rendering here shows the new
     * texture in the same frame.
     */
    onRender?: VoidFunction
}

/**
 * A three.js `Mesh` that shows a live DOM element.
 */
export interface HTMLPlane extends ThreeObject {
    readonly element: HTMLElement

    /**
     * The live texture, for custom materials. Like other three.js image
     * textures it's sRGB, not premultiplied, and the right way up with a
     * `PlaneGeometry`'s UVs.
     */
    readonly texture: ThreeObject

    /**
     * False if the browser can't draw HTML into a canvas. The plane is then
     * hidden and the element is left where it is.
     */
    readonly isSupported: boolean

    /**
     * Removes the plane from the scene, puts the element back where it was
     * and disposes the texture, geometry and material.
     */
    dispose(): void
}

interface PlaneState {
    plane: HTMLPlane
    element: HTMLElement
    camera: ThreeObject
    texture: WebGLTexture
    pixelSize: number
    geometry: (width: number, height: number) => ThreeObject
    onRender?: VoidFunction
    width: number
    height: number
    textureWidth: number
    textureHeight: number
    isReady?: boolean
    isDirty?: boolean
    isPlaced?: boolean

    /**
     * Where the element was last placed, in canvas pixels.
     */
    quad: Float64Array
}

interface Layer {
    canvas: DrawableCanvas
    gl: DrawableWebGLContext
    renderer: ThreeObject
    planes: PlaneState[]
    width: number
    height: number
    size?: string
    paint: (event: CanvasPaintEvent) => void
}

const layers = new Map<HTMLCanvasElement, Layer>()

const corners = /* @__PURE__ */ new Float64Array(8)
let clip: ThreeObject | undefined

/**
 * Projects the corners of a rect at z = 0 in an object's local space into
 * canvas pixels, clockwise from top-left. `e` is the object's column-major
 * model-view-projection matrix. Returns false if a corner is behind the
 * camera.
 */
export function projectRect(
    e: ArrayLike<number>,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    width: number,
    height: number,
    out: Float64Array
) {
    for (let i = 0; i < 4; i++) {
        const x = i === 0 || i === 3 ? minX : maxX
        const y = i < 2 ? maxY : minY
        const w = e[3] * x + e[7] * y + e[15]
        if (!(w > 0)) return false
        out[i * 2] = (((e[0] * x + e[4] * y + e[12]) / w + 1) * width) / 2
        out[i * 2 + 1] = ((1 - (e[1] * x + e[5] * y + e[13]) / w) * height) / 2
    }

    return true
}

/**
 * Whether a quad, clockwise from top-left in canvas pixels, still runs
 * clockwise, so it shows its front.
 */
export function isFrontFacing(q: Float64Array) {
    return (q[2] - q[0]) * (q[7] - q[1]) - (q[3] - q[1]) * (q[6] - q[0]) > 0
}

/**
 * The CSS `matrix3d()`, column-major, that maps a `width` by `height` rect
 * at the origin onto `q`, clockwise from top-left. Undefined if `q` is
 * edge-on.
 */
export function rectToQuad(width: number, height: number, q: Float64Array) {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = q
    const dx1 = x1 - x2
    const dx2 = x3 - x2
    const dy1 = y1 - y2
    const dy2 = y3 - y2
    const sx = x0 - x1 + x2 - x3
    const sy = y0 - y1 + y2 - y3
    const det = dx1 * dy2 - dx2 * dy1

    if (!det || !width || !height) return

    const g = (sx * dy2 - dx2 * sy) / det
    const h = (dx1 * sy - sx * dy1) / det

    // prettier-ignore
    return [
        (x1 - x0 + g * x1) / width, (y1 - y0 + g * y1) / width, 0, g / width,
        (x3 - x0 + h * x3) / height, (y3 - y0 + h * y3) / height, 0, h / height,
        0, 0, 1, 0,
        x0, y0, 0, 1,
    ]
}

/**
 * Put a live DOM element on a three.js plane:
 *
 * ```ts
 * const plane = htmlPlane(element, { three: THREE, renderer, camera })
 * scene.add(plane)
 * animate(plane.rotation, { y: 0.6 }, { type: "spring" })
 * ```
 *
 * The element moves into the renderer's canvas and stays a real element.
 * The plane's texture updates when it repaints, and pointer events, focus
 * and the accessibility tree follow the plane through the camera. Inside
 * the canvas it's laid out as a block, so give it a width and height.
 *
 * Render the scene however you like. Placing the element runs in
 * `frame.postRender`, after render loops scheduled with `frame.render`.
 *
 * Needs HTML-in-canvas. Without it, the plane is hidden and the element
 * stays where it is, so check `plane.isSupported`.
 */
export function htmlPlane(
    element: HTMLElement,
    {
        three,
        renderer,
        camera,
        pixelSize = 1,
        geometry = (width, height) => new three.PlaneGeometry!(width, height),
        material = (map) =>
            new three.MeshBasicMaterial!({
                map,
                transparent: true,
                toneMapped: false,
            }),
        onRender,
    }: HTMLPlaneOptions
): HTMLPlane {
    const canvas: HTMLCanvasElement = renderer.domElement
    const gl: DrawableWebGLContext = renderer.getContext()
    const isSupported =
        supportsHTMLInCanvas(canvas) && Boolean(gl?.texElementSubImage2D)

    const parent = element.parentNode
    const next = element.nextSibling
    const isDrawable = element.hasAttribute("drawable")

    if (isSupported) {
        canvas.contains(element) || canvas.appendChild(element)
        canvas.content = "drawable"
        element.toggleAttribute("drawable", true)
    }

    const glTexture = isSupported ? gl.createTexture()! : null
    const texture = new three.ExternalTexture(glTexture)
    texture.colorSpace = "srgb"

    const width = element.offsetWidth
    const height = element.offsetHeight
    const plane = new three.Mesh(
        geometry(width * pixelSize, height * pixelSize),
        material(texture)
    ) as HTMLPlane

    const state: PlaneState = {
        plane,
        element,
        camera,
        texture: glTexture!,
        pixelSize,
        geometry,
        onRender,
        width,
        height,
        textureWidth: 1,
        textureHeight: 1,
        isDirty: true,
        quad: new Float64Array(8),
    }

    let layer = layers.get(canvas)

    const dispose = () => {
        plane.removeFromParent()
        plane.geometry.dispose()
        const materials = plane.material
        ;(Array.isArray(materials) ? materials : [materials]).forEach(
            (m: ThreeObject) => m.dispose()
        )
        texture.dispose()

        if (!layer) return

        const { planes } = layer
        const index = planes.indexOf(state)
        if (index < 0) return
        planes.splice(index, 1)

        layer.canvas.clearElementGeometry(element)
        isDrawable || element.removeAttribute("drawable")
        parent
            ? parent.insertBefore(
                  element,
                  next?.parentNode === parent ? next : null
              )
            : element.remove()
        gl.deleteTexture(glTexture)

        if (!planes.length) {
            canvas.removeEventListener("paint", layer.paint as EventListener)
            layers.delete(canvas)
        }

        if (!layers.size) {
            cancelFrame(measure)
            cancelFrame(sync)
        }
    }

    Object.assign(plane, { element, texture, isSupported, dispose })

    if (!isSupported) {
        plane.visible = false
        return plane
    }

    /**
     * An empty 1x1 texture until the element first paints, so the plane
     * isn't drawn black.
     */
    gl.bindTexture(gl.TEXTURE_2D, glTexture)
    allocate(gl, 1, 1)
    gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const anisotropic = gl.getExtension("EXT_texture_filter_anisotropic")
    anisotropic &&
        gl.texParameterf(
            gl.TEXTURE_2D,
            anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
            8
        )
    renderer.resetState()

    if (!layer) {
        if (!layers.size) {
            frame.read(measure, true)
            frame.postRender(sync, true)
        }

        const newLayer: Layer = (layer = {
            canvas,
            gl,
            renderer,
            planes: [],
            width: canvas.clientWidth,
            height: canvas.clientHeight,
            paint: (event) => paint(newLayer, event),
        })
        layers.set(canvas, layer)
        canvas.addEventListener("paint", layer.paint as EventListener)
    }

    layer.planes.push(state)
    canvas.requestPaint()

    return plane
}

function allocate(gl: WebGL2RenderingContext, width: number, height: number) {
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.SRGB8_ALPHA8,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
    )
}

/**
 * Uploads elements that repainted. On the shipped API, `changedElements`
 * lists them. Without it, every element uploads.
 */
function paint(layer: Layer, { changedElements }: CanvasPaintEvent) {
    const callbacks = new Set<VoidFunction | undefined>()
    let isUploaded = false

    for (const state of layer.planes) {
        if (
            state.isDirty ||
            !changedElements ||
            changedElements.includes(state.element)
        ) {
            try {
                upload(layer, state)
                state.isReady = isUploaded = true
                state.isDirty = false
                callbacks.add(state.onRender)
            } catch (e) {
                /**
                 * The element can't be drawn, for instance because it's
                 * left the canvas. Try again on the next paint.
                 */
            }
        }
    }

    if (isUploaded) {
        layer.renderer.resetState()
        callbacks.forEach((callback) => callback?.())
    }
}

function upload(layer: Layer, state: PlaneState) {
    const { canvas, gl } = layer
    const { element, plane, pixelSize } = state

    /**
     * Fit the geometry to the element if it's resized.
     */
    const width = element.offsetWidth
    const height = element.offsetHeight
    if (width !== state.width || height !== state.height) {
        state.width = width
        state.height = height
        plane.geometry.dispose()
        plane.geometry = state.geometry(width * pixelSize, height * pixelSize)
    }

    /**
     * The texture is sized in canvas pixels, so follows the renderer's
     * pixel ratio.
     */
    const size = canvas.getElementImageDefaultSize(element)
    const textureWidth = Math.ceil(size.width)
    const textureHeight = Math.ceil(size.height)
    if (!textureWidth || !textureHeight) throw 0

    gl.bindTexture(gl.TEXTURE_2D, state.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)

    if (
        textureWidth !== state.textureWidth ||
        textureHeight !== state.textureHeight
    ) {
        allocate(
            gl,
            (state.textureWidth = textureWidth),
            (state.textureHeight = textureHeight)
        )
    }

    gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, element)
    gl.generateMipmap(gl.TEXTURE_2D)
}

/**
 * Reads canvas sizes at the start of the frame. A resize redraws every
 * element at the new size.
 */
function measure() {
    layers.forEach((layer) => {
        const { canvas } = layer
        const width = canvas.clientWidth
        const height = canvas.clientHeight
        const size = [width, height, canvas.width, canvas.height].join()

        if (layer.size && layer.size !== size) {
            layer.planes.forEach((state) => (state.isDirty = true))
            canvas.requestPaint()
        }

        layer.size = size
        layer.width = width
        layer.height = height
    })
}

function sync() {
    layers.forEach((layer) =>
        layer.planes.forEach((state) => place(layer, state))
    )
}

/**
 * Whether an object, and everything above it, is shown in a scene.
 */
function isInScene(object: ThreeObject): boolean {
    return (
        object.visible &&
        (object.parent ? isInScene(object.parent) : Boolean(object.isScene))
    )
}

/**
 * Places the element where the plane is drawn, so pointer events, focus
 * rings and the accessibility tree follow it.
 */
function place(layer: Layer, state: PlaneState) {
    const { canvas } = layer
    const { plane, camera, element, quad } = state
    let transform: number[] | undefined

    if (state.isReady && plane.material.visible !== false && isInScene(plane)) {
        plane.updateWorldMatrix(true, false)
        camera.updateWorldMatrix(true, false)
        clip ||= new plane.matrixWorld.constructor()
        clip!
            .multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse
            )
            .multiply(plane.matrixWorld)

        const { geometry } = plane
        geometry.boundingBox || geometry.computeBoundingBox()
        const { min, max } = geometry.boundingBox

        if (
            projectRect(
                clip!.elements,
                min.x,
                min.y,
                max.x,
                max.y,
                layer.width,
                layer.height,
                corners
            )
        ) {
            if (
                state.isPlaced &&
                corners.every((value, i) => value === quad[i])
            ) {
                return
            }

            /**
             * Materials draw front faces (side 0), back faces (1) or both
             * (2). A back face shows the element mirrored, and so does its
             * transform.
             */
            const { side } = plane.material
            if (side === 2 || (side === 1) !== isFrontFacing(corners)) {
                transform = rectToQuad(state.width, state.height, corners)
            }
        }
    }

    if (transform) {
        quad.set(corners)
        state.isPlaced = true
        canvas.updateElementGeometry(element, {
            canvasTransform: new DOMMatrix(transform),
        })
    } else if (state.isPlaced) {
        state.isPlaced = false
        canvas.clearElementGeometry(element)
    }
}
