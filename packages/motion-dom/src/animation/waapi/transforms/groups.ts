import { frame } from "../../../frameloop"

/**
 * The independent transform (x, scale, rotate etc) animations running on
 * each element, composed into one hardware-accelerated `transform`.
 *
 * Kept apart from the group itself so renderers and projection can tell a
 * group about outside changes without importing the animation code.
 */
export interface TransformGroupHooks {
    /**
     * A transform value may have been set by something other than one of
     * the group's animations.
     */
    check(): void

    /**
     * Hand every animation in the group back to the main thread, with
     * up-to-date values, e.g. before layout is measured. Returns true if
     * this wrote the element's transform. If it can return, it moves back
     * to the compositor when it next builds.
     */
    demote(canReturn?: boolean): true | void

    /**
     * Rebuild or retime the WAAPI animation.
     */
    schedule(needsBuild: boolean): void
}

export const transformGroups = new WeakMap<object, TransformGroupHooks>()

/**
 * An element repainted every frame by a style animating on the main thread
 * is rastered again every frame. With a compositor layer for its
 * transforms, each element is rastered on its own; without, they're
 * rastered together. Up to this many, the layers cost about the same and
 * keep transforms smooth while the main thread is busy. From here they
 * cost more, so the transforms of these elements move to the main thread
 * until they stop repainting.
 */
export const repaintLimit = 6

/**
 * Elements that repainted in the last frame, and so far in this one.
 */
let repainted = new Set<object>()
let repainting = new Set<object>()

const isOver = (elements: Set<object>, element: object) =>
    elements.size >= repaintLimit && elements.has(element)

/**
 * Whether an element's transforms should stay on the main thread because
 * it's one of too many repainting elements.
 */
export const isRepainting = (element: object) =>
    isOver(repainting, element) || isOver(repainted, element)

const nextFrame = () => {
    const previous = repainted
    repainted = repainting
    repainting = new Set()

    /**
     * Elements held on the main thread that no longer repaint, or are no
     * longer too many, move back to the compositor.
     */
    previous.size >= repaintLimit &&
        previous.forEach(
            (element) =>
                isRepainting(element) ||
                transformGroups.get(element)?.schedule(true)
        )

    repainted.size && frame.postRender(nextFrame)
}

/**
 * Note that an element repaints this frame.
 */
export const markRepaint = (element: object) => {
    if (repainting.has(element)) return

    repainting.size || frame.postRender(nextFrame)
    repainting.add(element)

    const { size } = repainting
    if (size === repaintLimit) {
        repainting.forEach((e) => transformGroups.get(e)?.demote(true))
    } else if (size > repaintLimit) {
        transformGroups.get(element)?.demote(true)
    }
}
