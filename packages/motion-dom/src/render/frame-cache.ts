type ElementStyles = Record<string, string>

/**
 * Map<frameNumber, WeakMap<Element, styles>>
 *
 * WeakMap ensures cached entries are garbage-collected
 * if an element is unmounted.
 */
const styleCache = new Map<number, WeakMap<Element, ElementStyles>>()

/**
 * Separate cache for SVG attributes, keyed identically.
 */
const attrCache = new Map<number, WeakMap<Element, ElementStyles>>()

let currentFrame: number | undefined = undefined

export function setCurrentFrame(frame: number | undefined) {
    currentFrame = frame
}

export function getCurrentFrame(): number | undefined {
    return currentFrame
}

export function getCachedStyles(
    element: Element
): ElementStyles | undefined {
    if (currentFrame === undefined) return undefined
    return styleCache.get(currentFrame)?.get(element)
}

export function setCachedStyles(
    element: Element,
    styles: ElementStyles
) {
    if (currentFrame === undefined) return
    if (!styleCache.has(currentFrame)) {
        styleCache.set(currentFrame, new WeakMap())
    }
    styleCache.get(currentFrame)!.set(element, styles)
}

export function getCachedAttrs(
    element: Element
): ElementStyles | undefined {
    if (currentFrame === undefined) return undefined
    return attrCache.get(currentFrame)?.get(element)
}

export function setCachedAttrs(
    element: Element,
    attrs: ElementStyles
) {
    if (currentFrame === undefined) return
    if (!attrCache.has(currentFrame)) {
        attrCache.set(currentFrame, new WeakMap())
    }
    attrCache.get(currentFrame)!.set(element, attrs)
}

export function clearFrameCache() {
    styleCache.clear()
    attrCache.clear()
}

export function isFrameCacheActive(): boolean {
    return currentFrame !== undefined
}
