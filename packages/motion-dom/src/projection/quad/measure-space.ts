import type { Box } from "motion-utils"
import { identity, Mat3, multiply } from "./mat3"

/**
 * The space an element is drawn in, as measured from the DOM.
 *
 * Elements Motion tracks with projection nodes have their transforms
 * reset or modelled by the projection engine. Every other element's
 * transform, other than a plain 2D translate, is a "layer": something the
 * engine doesn't control that turns, scales, shears or foreshortens the
 * elements inside it.
 */
export interface SpaceMeasurement {
    /**
     * The element's border box in the viewport with its own transform, and
     * every transform above it except plain translates on layers, removed.
     */
    rect: Box

    /**
     * Layers between the element's projection parent and the element, as
     * a viewport-space homography.
     */
    env: Mat3

    /**
     * Every layer above the element, as a viewport-space homography.
     */
    frame: Mat3

    /**
     * `perspective` on the element's parent, which applies to its own
     * transform, and its origin in the viewport. Distance 0 if none.
     */
    perspective: Float64Array

    /**
     * Every layer above the element, innermost first.
     */
    layers: Element[]
}

interface StyleInfo {
    /**
     * The transform as a row-major 4x4, about its origin, if it has one.
     */
    transform?: Float64Array
    origin?: string
    isTranslate: boolean
    perspective: number
    perspectiveOrigin?: string
}

/**
 * Computed styles, cached for one measurement pass so elements shared by
 * many nodes' ancestor chains are only read once. A pass ends with the
 * task it ran in, or when a different pass starts.
 */
let cache: WeakMap<Element, StyleInfo> | undefined
let cachePass: number | undefined

function styleOf(element: Element, pass: number): StyleInfo {
    if (!cache || pass !== cachePass) {
        cache = new WeakMap()
        cachePass = pass
        queueMicrotask(() => (cache = undefined))
    }

    let info = cache.get(element)
    if (info) return info

    const style = getComputedStyle(element)
    const list = readTransform(style)
    info = { isTranslate: true, perspective: 0 }

    if (list) {
        const matrix = new DOMMatrix(list)
        info.transform = fromDOMMatrix(matrix, new Float64Array(16))
        info.origin = style.transformOrigin
        info.isTranslate =
            matrix.is2D &&
            matrix.a === 1 &&
            matrix.b === 0 &&
            matrix.c === 0 &&
            matrix.d === 1
    }

    const { perspective } = style
    if (perspective && perspective !== "none") {
        info.perspective = parseFloat(perspective)
        info.perspectiveOrigin = style.perspectiveOrigin
    }

    cache.set(element, info)
    return info
}

const parentOf = (element: Element): Element | null =>
    element.parentElement ||
    ((element.parentNode as ShadowRoot | null)?.host ?? null)

/**
 * The element's transform as one CSS transform list: the individual
 * `translate`, `rotate` and `scale` properties, then `transform`.
 */
function readTransform(style: CSSStyleDeclaration): string | undefined {
    let list = ""
    const { translate, rotate, scale, transform } = style

    if (translate && translate !== "none") {
        const [x, y = "0px", z = "0px"] = translate.split(" ")
        list += `translate3d(${x}, ${y}, ${z}) `
    }

    if (rotate && rotate !== "none") {
        const parts = rotate.split(" ")
        if (parts.length === 1) {
            list += `rotate(${parts[0]}) `
        } else if (parts.length === 2) {
            list += `rotate${parts[0].toUpperCase()}(${parts[1]}) `
        } else {
            list += `rotate3d(${parts.join(", ")}) `
        }
    }

    if (scale && scale !== "none") {
        const [x, y = x, z = "1"] = scale.split(" ")
        list += `scale3d(${x}, ${y}, ${z}) `
    }

    if (transform && transform !== "none") list += transform

    return list || undefined
}

/**
 * Parse a CSS length list like "10px 20px 0px" into px numbers.
 */
function readOrigin(origin: string, out: number[]) {
    const parts = origin.split(" ")
    out[0] = parseFloat(parts[0]) || 0
    out[1] = parseFloat(parts[1]) || 0
    out[2] = parseFloat(parts[2]) || 0
    return out
}

const origin: number[] = [0, 0, 0]

/**
 * A row-major 4x4 from a DOMMatrix, which lists columns.
 */
function fromDOMMatrix(m: DOMMatrix, out: Float64Array) {
    out[0] = m.m11
    out[1] = m.m21
    out[2] = m.m31
    out[3] = m.m41
    out[4] = m.m12
    out[5] = m.m22
    out[6] = m.m32
    out[7] = m.m42
    out[8] = m.m13
    out[9] = m.m23
    out[10] = m.m33
    out[11] = m.m43
    out[12] = m.m14
    out[13] = m.m24
    out[14] = m.m34
    out[15] = m.m44
    return out
}

/**
 * `m = T(x, y, z) * m * T(-x, -y, -z)`
 */
function moveOrigin(m: Float64Array, x: number, y: number, z: number) {
    for (let r = 0; r < 16; r += 4) {
        m[r + 3] -= m[r] * x + m[r + 1] * y + m[r + 2] * z
    }
    for (let c = 0; c < 4; c++) {
        const w = m[12 + c]
        m[c] += x * w
        m[4 + c] += y * w
        m[8 + c] += z * w
    }
}

/**
 * `m = a * m`
 */
function premultiply4(a: Float64Array, m: Float64Array) {
    for (let c = 0; c < 4; c++) {
        const m0 = m[c]
        const m1 = m[4 + c]
        const m2 = m[8 + c]
        const m3 = m[12 + c]
        for (let r = 0; r < 16; r += 4) {
            m[r + c] = a[r] * m0 + a[r + 1] * m1 + a[r + 2] * m2 + a[r + 3] * m3
        }
    }
}

/**
 * The homography a 4x4 applies to the z = 0 plane.
 */
function reduce(m: Float64Array, out: Mat3) {
    out[0] = m[0]
    out[1] = m[1]
    out[2] = m[3]
    out[3] = m[4]
    out[4] = m[5]
    out[5] = m[7]
    out[6] = m[12]
    out[7] = m[13]
    out[8] = m[15]
    return out
}

function perspectiveMatrix(
    info: StyleInfo,
    rect: DOMRect,
    out: Float64Array
): Float64Array {
    out.fill(0)
    out[0] = out[5] = out[10] = out[15] = 1
    out[14] = -1 / info.perspective
    readOrigin(info.perspectiveOrigin!, origin)
    moveOrigin(out, rect.left + origin[0], rect.top + origin[1], 0)
    return out
}

interface SavedTransform {
    element: HTMLElement | SVGElement
    transform: string
    translate: string
    rotate: string
    scale: string
}

/**
 * Temporarily replace transforms with an identity. Not `none`, so a
 * transformed element stays the containing block for its fixed and
 * absolute descendants, and layout doesn't change.
 */
function neutralise(element: Element, saved: SavedTransform[]) {
    const { style } = element as HTMLElement
    if (!style) return
    saved.push({
        element: element as HTMLElement,
        transform: style.transform,
        translate: style.translate,
        rotate: style.rotate,
        scale: style.scale,
    })
    style.transform = "translate(0px)"
    style.translate = style.rotate = style.scale = "none"
}

function restore(saved: SavedTransform[]) {
    for (let i = saved.length - 1; i >= 0; i--) {
        const { element, transform, translate, rotate, scale } = saved[i]
        const { style } = element
        style.transform = transform
        style.translate = translate
        style.rotate = rotate
        style.scale = scale
    }
}

/**
 * Neutralise `layers` until the returned function is called, so boxes
 * measure in the space inside them.
 */
export function neutraliseLayers(layers: Element[]): VoidFunction {
    const saved: SavedTransform[] = []
    for (const layer of layers) neutralise(layer, saved)
    return () => restore(saved)
}

const m = /* @__PURE__ */ new Float64Array(16)
const p = /* @__PURE__ */ new Float64Array(16)
const h = /* @__PURE__ */ new Float64Array(9)

/**
 * Compose `layers[0..count)` into `out`, outermost first, as homographies
 * of the untransformed page.
 */
function composeLayers(
    out: Mat3,
    layers: Element[],
    count: number,
    layerRects: DOMRect[],
    perspectiveRects: Array<DOMRect | undefined>,
    pass: number
) {
    identity(out)
    for (let i = count - 1; i >= 0; i--) {
        const layer = layers[i]
        const info = styleOf(layer, pass)
        const layerRect = layerRects[i]
        m.set(info.transform!)
        readOrigin(info.origin!, origin)
        moveOrigin(
            m,
            layerRect.left + origin[0],
            layerRect.top + origin[1],
            origin[2]
        )

        /**
         * `perspective` on a layer's parent applies to the layer's own
         * transform.
         */
        const perspectiveRect = perspectiveRects[i]
        if (perspectiveRect) {
            premultiply4(
                perspectiveMatrix(
                    styleOf(parentOf(layer)!, pass),
                    perspectiveRect,
                    p
                ),
                m
            )
        }

        multiply(out, out, reduce(m, h))
    }
}

/**
 * Measure the space `element` is drawn in. `until` is its projection
 * parent (null for the document), `isTracked` whether an element has a
 * projection node, and `pass` identifies the measurement pass, so styles
 * are cached across the nodes it measures.
 *
 * Returns false, without writing to the DOM, if no layer lies above the
 * element and its parent has no perspective. Otherwise every transform
 * from the element up to the document is briefly neutralised to read
 * untransformed boxes, then restored.
 */
export function measureSpace(
    element: Element,
    until: Element | null,
    isTracked: (element: Element) => boolean,
    pass: number,
    out: SpaceMeasurement
): boolean {
    if (typeof DOMMatrix === "undefined") return false

    const { layers } = out
    layers.length = 0

    /**
     * Elements whose transforms to neutralise when measuring.
     */
    const transformed: Element[] = []
    let envLayers = 0
    let reachedParent = false

    if (styleOf(element, pass).transform) transformed.push(element)

    const elementParent = parentOf(element)
    const parentStyle = elementParent && styleOf(elementParent, pass)

    let ancestor = elementParent
    while (ancestor) {
        if (ancestor === until) reachedParent = true

        const info = styleOf(ancestor, pass)
        if (info.transform) {
            const tracked = isTracked(ancestor)
            if (!tracked && !info.isTranslate) {
                layers.push(ancestor)
                if (!reachedParent) envLayers++
                transformed.push(ancestor)
            } else if (tracked) {
                transformed.push(ancestor)
            }
        }

        ancestor = parentOf(ancestor)
    }

    const hasPerspectiveParent = Boolean(parentStyle && parentStyle.perspective)

    if (!layers.length && !hasPerspectiveParent) return false

    const saved: SavedTransform[] = []
    for (const target of transformed) neutralise(target, saved)

    const rect = element.getBoundingClientRect()
    const layerRects = layers.map((layer) => layer.getBoundingClientRect())
    const perspectiveRects = layers.map((layer) => {
        const grandparent = parentOf(layer)
        return grandparent && styleOf(grandparent, pass).perspective
            ? grandparent.getBoundingClientRect()
            : undefined
    })
    const parentRect =
        hasPerspectiveParent && elementParent
            ? elementParent.getBoundingClientRect()
            : undefined

    restore(saved)

    out.rect.x.min = rect.left
    out.rect.x.max = rect.right
    out.rect.y.min = rect.top
    out.rect.y.max = rect.bottom

    composeLayers(
        out.frame,
        layers,
        layers.length,
        layerRects,
        perspectiveRects,
        pass
    )
    composeLayers(
        out.env,
        layers,
        envLayers,
        layerRects,
        perspectiveRects,
        pass
    )

    const perspective = out.perspective
    perspective[0] = 0
    if (parentRect && parentStyle) {
        perspective[0] = parentStyle.perspective
        readOrigin(parentStyle.perspectiveOrigin!, origin)
        perspective[1] = parentRect.left + origin[0]
        perspective[2] = parentRect.top + origin[1]
    }

    return true
}
