import { supportsScrollTimeline, supportsViewTimeline } from "motion-dom"

/**
 * The JS path measures a target by adding up its offsetParents' offsets up
 * to the container. A fixed ancestor ends that chain early and stops the
 * target scrolling at all, so a ViewTimeline can't agree with it.
 */
function scrollsWithContainer(target: Element, container?: Element) {
    let node: any = target
    while (node && node !== container && node !== document.body) {
        node = "offsetParent" in node ? node.offsetParent : node.parentElement
    }
    return !!node
}

export function canUseNativeTimeline(target?: Element, container?: Element) {
    if (typeof window === "undefined") return false
    return target
        ? supportsViewTimeline() && scrollsWithContainer(target, container)
        : supportsScrollTimeline()
}
